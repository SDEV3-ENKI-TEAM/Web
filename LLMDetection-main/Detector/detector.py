import json
import pandas as pd
from kafka import KafkaConsumer, KafkaProducer
from collections import defaultdict
from langgraph_node import (
    search_similar_logs,
    llm_judgment,
    final_decision,
    save_final_decision_to_chroma,
    TraceState,
    retriever,
)
from langgraph.graph import StateGraph, END

# -------------------------------
# Kafka 토픽 2 Producer 설정
# -------------------------------
producer = KafkaProducer(bootstrap_servers="localhost:9092",
                         value_serializer=lambda v: json.dumps(v, ensure_ascii=False).encode("utf-8"))

# -------------------------------
# LangGraph Workflow 설정
# -------------------------------
workflow = StateGraph(TraceState)

workflow.add_node("SimilaritySearch", search_similar_logs)
workflow.add_node("LLMJudgment", llm_judgment)
workflow.add_node("Decision", final_decision)
workflow.add_node("SaveToChroma", save_final_decision_to_chroma)

workflow.set_entry_point("SimilaritySearch")
workflow.add_edge("SimilaritySearch", "LLMJudgment")
workflow.add_edge("LLMJudgment", "Decision")
workflow.add_edge("Decision", "SaveToChroma")
workflow.add_edge("SaveToChroma", END)

graph = workflow.compile()

# -------------------------------
# Kafka 토픽 1 Consumer 설정
# -------------------------------
trace_buffer = defaultdict(list)
trace_end_flags = defaultdict(dict)

consumer = KafkaConsumer(
    'raw_trace',
    bootstrap_servers='localhost:9092',
    value_deserializer=lambda m: json.loads(m.decode('utf-8'))
)

print("[Kafka Consumer Started] Waiting for messages...")

def handle_completed_trace(trace_id, df):
    """
    완성된 trace DataFrame을 LangGraph에 넘기고 처리
    """
    print(f"\n=== Trace Completed: {trace_id} ===")
    print(df)

    # DataFrame → LangGraph 입력용 cleaned_trace
    cleaned_trace = df.to_json(orient="records", force_ascii=False)

    input_state = {
        "trace_id": trace_id,
        "cleaned_trace": cleaned_trace,
        "similar_logs": [],
        "llm_output": "",
        "decision": "",
        "reason": "",
        "retriever": retriever,
    }

    # LangGraph 실행
    result = graph.invoke(input_state)

    print(f"\n[LangGraph Result for Trace {trace_id}]")
    for k, v in result.items():
        print(f"{k}: {v}")

    # Kafka로 결과 전송(JSON + key=trace_id)
    out = {
        "trace_id": trace_id,
        "decision": result.get("decision"),
        "reason": result.get("reason"),
        "llm_output": result.get("llm_output"),
    }
    producer.send(
        "ai-result-topic",
        key=str(trace_id).encode("utf-8"),
        value=out,
    )
    producer.flush()
    print(f"[Producer] 전송 완료(JSON): Trace {trace_id}")


# -------------------------------
# Kafka 토픽 1 Consumer 
# -------------------------------
for message in consumer:
    data = message.value
    
    try:
        for resource_span in data.get("resourceSpans", []):
            for scope_span in resource_span.get("scopeSpans", []):
                for span in scope_span.get("spans", []):
                    trace_id = span.get("traceId")
                    span_id = span.get("spanId")

                    # attributes 변환
                    attributes = {
                        attr["key"]: list(attr["value"].values())[0]
                        for attr in span.get("attributes", [])
                    }

                    # span 데이터 저장
                    row = {
                        "traceId": trace_id,
                        "spanId": span_id,
                        "parentSpanId": span.get("parentSpanId"),
                        "name": span.get("name"),
                        "startTime": span.get("startTimeUnixNano"),
                        "endTime": span.get("endTimeUnixNano"),
                        "status_code": span.get("status", {}).get("code"),
                        "status_message": span.get("status", {}).get("message")
                    }
                    row.update(attributes)

                    trace_buffer[trace_id].append(row)

                    # 종료 여부 기록
                    is_ended = bool(span.get("endTimeUnixNano"))
                    trace_end_flags[trace_id][span_id] = is_ended

                    # traceId 내 모든 span이 종료되었는지 확인
                    if trace_end_flags[trace_id] and all(trace_end_flags[trace_id].values()):
                        df = pd.DataFrame(trace_buffer[trace_id])

                        # DataFrame을 LangGraph 처리 함수로 전달
                        handle_completed_trace(trace_id, df)

                        # 사용한 데이터 정리
                        trace_buffer.pop(trace_id, None)
                        trace_end_flags.pop(trace_id, None)

    except Exception as e:
        print(f"[Error] Failed to process message: {e}")
