# ───── 표준 라이브러리 ───────────────────────────────
import json, re
from typing import TypedDict, List

# ───── 환경 변수 로드 ────────────────────────────────
from dotenv import load_dotenv

# ───── LangChain Core & Schema ──────────────────────
from langchain_core.documents import Document
from langchain.schema import HumanMessage

# ───── LangChain Chat 모델 ──────────────────────────
from langchain_community.chat_models import ChatOpenAI

# ───── LangChain 벡터 스토어 ────────────────────────
from langchain_community.vectorstores import Chroma
from langchain.vectorstores.base import VectorStoreRetriever
from langchain_community.embeddings import OpenAIEmbeddings

# ───── LangGraph ────────────────────────────────────
from langgraph.graph import StateGraph, END

# ───── 사용자 정의 모듈 ──────────────────────────────
from chroma_setup import vectorstore

load_dotenv()

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Chroma DB 연결
vectorstore = Chroma(
    collection_name="my_log_db",
    embedding_function=embeddings,
    client=vectorstore,
)

collection = vectorstore._collection

retriever = vectorstore.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"score_threshold": 0.7},  # 유사도 임계값 설정
)


llm = ChatOpenAI(model="gpt-4o", temperature=0)

# ------- 상태 정의 ------- #


class TraceState(TypedDict):
    trace_id: str  # 트레이스 ID
    cleaned_trace: str
    similar_logs: List[str]
    similar_metadata: List[dict]  # 유사 로그의 메타데이터
    llm_output: str
    decision: str
    reason: str
    retriever: VectorStoreRetriever  # 벡터 DB 검색기


# ----------------------- #

# ------- 노드 정의 ------- #


# 유사 로그 검색: 벡터 DB에서 유사 로그 검색
def search_similar_logs(state: TraceState) -> TraceState:
    retriever = state["retriever"]
    query = " ".join(state["cleaned_trace"])

    try:
        results: List[Document] = retriever.get_relevant_documents(query)
    except AttributeError:
        results: List[Document] = retriever.invoke(query)

    similar_logs = [doc.page_content for doc in results]
    similar_metadata = [doc.metadata for doc in results]

    print(
        f"[DEBUG] 유사 로그 검색 결과: similar_logs={similar_logs}, similar_metadata={similar_metadata}"
    )

    return {
        **state,
        "similar_logs": similar_logs,
        "similar_metadata": similar_metadata,
    }


# 이상 여부 판단
# 유사 로그가 있는 경우 유사 로그의 메타데이터를 활용해 이상 여부 판단
# 유사 로그가 없는 경우 전체 판단을 위해 LLM을 호출
def llm_judgment(state: TraceState) -> TraceState:
    query = " ".join(state["cleaned_trace"])

    similar_logs = state.get("similar_logs", [])
    similar_metadata = state.get("similar_metadata", [])

    # 1. 유사 로그가 없는 경우: LLM에게 전체 로그 판단 요청
    if not similar_logs:

        prompt = f"""
        다음 로그를 보고 정상(normal), 이상(anomaly), 또는 의심(suspicious) 중 하나로 분류해줘.
        로그: {query}

        출력은 정확히 이 JSON 형식으로만 줘:
        {{"decision": "<normal|anomaly|suspicious>", "reason": "<간단한 설명>"}}
        """

        messages = [HumanMessage(content=prompt)]
        response = llm.invoke(messages)
        text = response.content if hasattr(response, "content") else str(response)

        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())  # 앞부분 제거
        cleaned = re.sub(r"\n?```$", "", cleaned.strip())

        result = json.loads(cleaned)

        decision = result.get("decision", "suspicious").lower()
        reason = result.get("reason", "")

        output = f"유사 로그 없음. LLM 판단: {decision} — {reason}"

        print(f"[DEBUG] LLM 판단 결과: {output}")

        return {**state, "llm_output": output, "decision": decision, "reason": reason}

    # 2. 유사 로그가 있는 경우: 메타데이터 기반 보조 설명/초기 판단
    label_counts = {"anomaly": 0, "suspicious": 0, "normal": 0, "unknown": 0}
    reasons = []
    for meta in similar_metadata:
        label = meta.get("label", "unknown").lower()
        label_counts[label] += 1
        if label != "unknown":
            reasons.append(f"유사 로그 라벨: {label}")

    # 기본 판단: anomaly > suspicious > normal
    if label_counts["anomaly"] > 0:
        base_decision = "anomaly"
    elif label_counts["suspicious"] > 0:
        base_decision = "suspicious"
    elif label_counts["normal"] > 0:
        base_decision = "normal"
    else:
        base_decision = "suspicious"  # 불확실할 때 보수적으로

    # reason 조합
    reason_parts = []
    reason_parts.append(f"유사 로그 라벨 분포: {label_counts}")
    if reasons:
        reason_parts.append("유사 로그 사유: " + " | ".join(reasons))
    else:
        decision = base_decision

    reason = " / ".join(reason_parts)

    output = f"유사 로그 기반 보조 판단: {base_decision}"

    # base_decision 확정
    return {**state, "llm_output": output, "decision": base_decision, "reason": reason}


def final_decision(state: TraceState) -> TraceState:
    decision = state.get("decision", "unknown").lower()
    if decision != "suspicious":

        return state

    query = " ".join(state["cleaned_trace"])

    similar_logs = state.get("similar_logs", [])[:5]  # 최대 5개
    similar_metadata = state.get("similar_metadata", [])[:5] if similar_logs else []

    if similar_logs:
        summary = ""
        for log, meta in zip(similar_logs, similar_metadata):
            summary += f"- 로그: {log}\n  라벨: {meta.get('label', 'unknown')}, 사유: {meta.get('reason', '')}\n"

        prompt = f"""
        원래 로그: {query}
        유사 로그 요약 및 메타데이터:
        {summary}

        이 상태가 정상(normal), 이상(anomaly), 또는 의심(suspicious)인지 다시 판단해줘.
        불확실하면 suspicious으로 유지하고, 가능한 명확하면 normal 또는 anomaly를 내줘.
        출력은 JSON 형식으로:
        {{"decision": "<normal|anomaly|suspicious>", "reason": "<간단한 설명>"}}
        """
    else:
        prompt = f"""
        원래 로그: {query}

        이 상태가 정상(normal), 이상(anomaly), 또는 의심(suspicious)인지 판단해줘.
        불확실하면 suspicious으로 유지하고, 가능한 명확하면 normal 또는 anomaly를 내줘.
        출력은 JSON 형식으로:
        {{"decision": "<normal|anomaly|suspicious>", "reason": "<간단한 설명>"}}
        """

    response = llm.invoke([HumanMessage(content=prompt)])
    text = response.content if hasattr(response, "content") else str(response)

    # LLM 응답 정제
    cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", text.strip())
    cleaned = re.sub(r"\n?```$", "", cleaned.strip())

    result = json.loads(cleaned)

    decision = result.get("decision", "suspicious").lower()
    reason = result.get("reason", "")

    output = f"최종 판단: {decision}"
    return {**state, "llm_output": output, "decision": decision, "reason": reason}


def save_final_decision_to_chroma(state: TraceState) -> None:
    trace_id = state.get("trace_id")
    cleaned_trace = state.get("cleaned_trace")
    decision = state.get("decision")
    reason = state.get("reason")

    document = " ".join(cleaned_trace)
    metadata = {
        "decision": decision,
        "reason": reason,
    }

    collection.add(
        documents=[document],
        metadatas=[metadata],
        ids=[trace_id],  # ID 중복 시 overwrite ..
    )

    print(f"[INFO] 최종 판단 결과 저장 완료 \n")


# ----------------------- #

# opensearch_setup.py 실행
from opensearch_setup import summarized


# LangGraph 생성
workflow = StateGraph(TraceState)

workflow.add_node("SimilaritySearch", search_similar_logs)
workflow.add_node("LLMJudgment", llm_judgment)
workflow.add_node("Decision", final_decision)
workflow.add_node("SaveToChroma", save_final_decision_to_chroma)

workflow.set_entry_point("SimilaritySearch")  # 시작 노드
workflow.add_edge("SimilaritySearch", "LLMJudgment")
workflow.add_edge("LLMJudgment", "Decision")
workflow.add_edge("Decision", "SaveToChroma")
workflow.add_edge("SaveToChroma", END)  # 종료 노드

graph = workflow.compile()

results = []
for trace in summarized:
    input_state = {
        "trace_id": trace["trace_id"],
        "cleaned_trace": trace["summary"],
        "similar_logs": [],
        "llm_output": "",
        "decision": "",
        "reason": "",
        "retriever": retriever,
    }
    result = graph.invoke(input_state)
    results.append(result)

# 결과 출력
for i, res in enumerate(results):
    print(f"==== 로그 {i+1} 결과 ====")
    for k, v in res.items():
        print(f"{k}: {v}")
