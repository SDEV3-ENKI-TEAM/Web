import os, boto3, openai
import pandas as pd
from requests_aws4auth import AWS4Auth
from opensearchpy import OpenSearch, RequestsHttpConnection
from dotenv import load_dotenv
from datetime import datetime
from openai import OpenAI

load_dotenv()

# ─── OpenSearch 클라이언트 설정 ─────────────────────────────
session = boto3.Session()
credentials = session.get_credentials().get_frozen_credentials()
awsauth = AWS4Auth(
    credentials.access_key,
    credentials.secret_key,
    "ap-northeast-2",  # REGION
    "es",
    session_token=credentials.token,
)

ALLOWED_FMTS = ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"]
OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST")
TRACE_INDEX = os.getenv("TRACE_INDEX_PATTERN")

opensearch_client = OpenSearch(
    hosts=[
        {
            "host": OPENSEARCH_HOST,
            "port": 443,
        }
    ],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection,
)


# 전체 트레이스 ID 목록 가져오기
def list_trace_ids(client: OpenSearch, limit: int = 100, order: str = "desc"):

    body = {
        "size": 0,
        "query": {"match_all": {}},
        "aggs": {
            "traces": {
                "terms": {
                    "field": "traceID",
                    "size": limit,
                    "order": {"max_start": order},
                },
                "aggs": {
                    "max_start": {"max": {"field": "startTimeMillis"}},
                    "first_span": {
                        "top_hits": {
                            "size": 1,
                            "_source": ["startTimeMillis", "sigma.alert"],
                        }
                    },
                },
            }
        },
    }

    res = client.search(index=TRACE_INDEX, body=body, size=0)
    traces = []
    for b in res["aggregations"]["traces"]["buckets"]:
        traces.append({"trace_id": b["key"]})
    return traces


# 트레이스 ID로 스팬 정보 가져와서 필요한 필드만 뽑아 DataFrame으로 반환
def get_trace_spans(trace_id: str, size: int = 1000) -> pd.DataFrame:
    body = {
        "query": {"term": {"traceID": trace_id}},
        "sort": [{"startTimeMillis": {"order": "asc"}}],
        "size": size,
    }

    data = opensearch_client.search(index=TRACE_INDEX, body=body)

    # 필요한 정보를 저장할 리스트
    processed_data = []

    for item in data["hits"]["hits"]:
        source = item["_source"]
        event = {
            "traceID": source["traceID"],
            "spanID": source["spanID"],
            "operationName": source["operationName"],
            "startTime": datetime.fromtimestamp(source["startTimeMillis"] / 1000),
            "duration": source["duration"],
        }

        # tag 정보 추출
        if "tag" in source:
            event.update(
                {
                    "EventName": source["tag"].get("EventName", ""),
                    "Image": source["tag"].get("Image", ""),
                    "ProcessId": source["tag"].get("ProcessId", ""),
                    "User": source["tag"].get("User", ""),
                    "CommandLine": source["tag"].get("CommandLine", ""),
                    "ParentImage": source["tag"].get("ParentImage", ""),
                    "sigma_alert": source["tag"].get("sigma@alert", ""),
                }
            )

        processed_data.append(event)

    df = pd.DataFrame(processed_data)

    return df


def summarize_chunk_korean(df):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI()

    CHAT_MODEL = "gpt-4o"

    # df를 문자열로 변환 (예: json이나 tabular format)
    log_text = df.to_json(orient="records", force_ascii=False, indent=2)

    user_prompt = (
        "다음은 하나의 trace 청크에서 추출된 로그입니다.\n\n"
        f"{log_text}\n\n"
        "이 로그를 실행 파일, 명령어 등을 보고 어떤 행위가 있었는지 구체적으로 요약하되 1~2문장으로 요약해줘."
    )

    resp = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {
                "role": "system",
                "content": "당신은 사이버 보안 분석가입니다. 로그를 보고 어떤 행위가 있었는지 요약해 주세요.",
            },
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    # 첫번째 응답의 응답 텍스트에서 앞뒤 공백 제거
    return resp.choices[0].message.content.strip()


# # 트레이스 요약 결과
summarized = []

# import 할 때 자동 실행
all_trace_ids = list_trace_ids(opensearch_client)
for trace in all_trace_ids:
    trace_id = trace["trace_id"]
    spans = get_trace_spans(trace_id, size=5000)
    summary = summarize_chunk_korean(spans)

    summarized.append(
        {
            "trace_id": trace_id,
            "summary": summary,
        }
    )
