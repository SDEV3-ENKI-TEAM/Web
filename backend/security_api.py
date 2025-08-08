import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from auth_api import router as auth_router
from auth_deps import get_current_user_with_roles
from opensearch_analyzer import OpenSearchAnalyzer

try:
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path, encoding='utf-8')
except Exception as e:
    print(f".env 파일 로드 중 오류: {e}")
    try:
        load_dotenv(env_path, encoding='cp949')
    except Exception as e2:
        print(f"cp949 인코딩도 실패: {e2}")
        load_dotenv()

logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logging.getLogger('sqlalchemy.engine').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy.pool').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy.dialects').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy').setLevel(logging.CRITICAL)

logging.getLogger('uvicorn.access').setLevel(logging.INFO)
logging.getLogger('uvicorn.error').setLevel(logging.WARNING)
logging.getLogger('fastapi').setLevel(logging.WARNING)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

opensearch_analyzer = OpenSearchAnalyzer()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "security")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "rules")

try:
    mongo_client = MongoClient(MONGO_URI)
    mongo_db = mongo_client[MONGO_DB]
    mongo_collection = mongo_db[MONGO_COLLECTION]
except Exception as e:
    mongo_client = None
    mongo_collection = None

def to_korea_time(utc_timestamp_ms: int) -> str:
    """UTC 타임스탬프를 한국 시간으로 변환합니다."""
    utc_dt = datetime.fromtimestamp(utc_timestamp_ms / 1000, tz=timezone.utc)
    korea_tz = timezone(timedelta(hours=9))
    korea_dt = utc_dt.astimezone(korea_tz)
    return korea_dt.strftime('%Y-%m-%dT%H:%M:%S')

class LogEntry(BaseModel):
    timestamp: datetime
    source_ip: str
    destination_ip: str
    event_type: str
    severity: str
    message: str
    user: Optional[str] = None
    protocol: Optional[str] = None
    port: Optional[int] = None
    bytes: Optional[int] = None
    status: Optional[str] = None

class SearchQuery(BaseModel):
    query: str
    start_time: Optional[datetime] = None

@app.get("/api/traces/search/{trace_id}")
async def search_trace_by_id(
    trace_id: str, 
    current_user: dict = Depends(get_current_user_with_roles)
):
    """특정 Trace ID로 트레이스를 검색합니다."""
    try:
        # 일시적으로 사용자별 필터링 제거 - 모든 trace에 접근 허용
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"traceID": trace_id}}
                    ]
                }
            },
            "size": 1
        }
        
        user_access = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        if not user_access['hits']['hits']:
            return {
                "data": None,
                "found": False,
                "message": f"Trace ID '{trace_id}'를 찾을 수 없습니다."
            }
        
        events = opensearch_analyzer.get_process_tree_events(trace_id)
        
        if not events:
            return {
                "data": None,
                "found": False,
                "message": f"Trace ID '{trace_id}'를 찾을 수 없습니다."
            }
        
        events.sort(key=lambda x: x.get('timestamp', ''))
        
        first_event = events[0] if events else {}
        
        alert_events = [event for event in events if event.get('has_alert', False)]
        has_any_alert = len(alert_events) > 0
        
        if events:
            first_event_source = events[0].get('_source', {})
            process_tag = first_event_source.get('process', {}).get('tag', {})
            host_info = {
                "hostname": process_tag.get("host@name", "-"),
                "ip": process_tag.get("ip@address", "-"),
                "os": process_tag.get("os@type", "-")
            }
        
        trace_data = {
            "trace_id": trace_id,
            "host": host_info,
            "events": events,
            "timestamp": first_event.get('timestamp', ''),
            "label": "이상" if has_any_alert else "정상",
            "severity": "high" if has_any_alert else "low",
        }
        
        return {
            "data": trace_data,
            "found": True,
            "message": f"Trace ID '{trace_id}'를 찾았습니다."
        }
        
    except Exception as e:
        return {
            "data": None,
            "found": False,
            "message": f"검색 중 오류가 발생했습니다: {str(e)}"
        }

@app.get("/api/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user_with_roles)):
    """사용자별 대시보드 통계"""
    try:
        user_id = current_user["id"]
        username = current_user["username"]

        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 10000
        }
        
        response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
        spans_data = response['hits']['hits']
        
        trace_groups = {}
        
        for span in spans_data:
            src = span['_source']
            trace_id = src.get('traceID', '')
            
            if trace_id not in trace_groups:
                trace_groups[trace_id] = {
                    'has_anomaly': False
                }
            
            tag = src.get('tag', {})
            is_anomaly = (
                tag.get('error') is True or
                tag.get('otel@status_code') == 'ERROR' or
                tag.get('sigma@alert') is not None
            )
            
            if is_anomaly:
                trace_groups[trace_id]['has_anomaly'] = True
        
        total_traces = len(trace_groups)
        anomaly_traces = sum(1 for trace in trace_groups.values() if trace['has_anomaly'])
        
        return {
            "totalEvents": total_traces,
            "anomalies": anomaly_traces,
            "user_id": user_id,
            "username": username
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarms")
async def get_alarm_traces(
    offset: int = 0, 
    limit: int = 50,
    current_user: dict = Depends(get_current_user_with_roles)
):
    """사용자별 알람(에러) 조건에 해당하는 Trace만 알람 리스트로 반환합니다."""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "should": [
                        {"term": {"tag.otel@status_code": "ERROR"}},
                        {"exists": {"field": "tag.sigma@alert"}},
                        {"term": {"tag.error": True}}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": max(limit * 5, 10000),
            "from": 0
        }
        

        query["query"]["bool"]["must"] = [
            {"bool": {
                "should": [
                    {"term": {"tag.user_id": str(user_id)}},  
                    {"term": {"tag.user_id": username}}  
                ]
            }}
        ]
        
        response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)                                               
        alarms = []
        seen_trace_ids = set()
        trace_span_counts = {}
        
        unique_trace_ids = list(set(span['_source'].get("traceID", "") for span in response['hits']['hits'] if span['_source'].get("traceID", "")))
        

        for trace_id in unique_trace_ids:
            sigma_span_count = 0
            for span in response['hits']['hits']:
                src = span['_source']
                if src.get('traceID', '') == trace_id:
                    tag = src.get('tag', {})

                    if tag.get('sigma@alert') and tag.get('sigma@alert').strip():
                        sigma_span_count += 1
            trace_span_counts[trace_id] = sigma_span_count

        for span in response['hits']['hits']:
            src = span['_source']
            trace_id = src.get("traceID", "")
            if trace_id in seen_trace_ids:
                continue
            seen_trace_ids.add(trace_id)
            tag = src.get('tag', {})
            alarms.append({
                "trace_id": trace_id,
                "detected_at": to_korea_time(src.get("startTimeMillis", 0)),
                "summary": src.get("operationName") or "-",
                "host": tag.get("User", "-"),
                "os": tag.get("Product", "-"),
                "checked": get_alarm_checked_status(trace_id),
                "sigma_alert": tag.get("sigma@alert", ""),
                "span_count": trace_span_counts.get(trace_id, 0),
                "ai_summary": "테스트 요약",
                "user_id": user_id
            })
        total = len(alarms)
        paged = alarms[offset:offset+limit]
        has_more = offset + limit < total
        return {
            "alarms": paged, 
            "total": total,
            "offset": offset, 
            "limit": limit, 
            "hasMore": has_more,
            "user_id": user_id
        }
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

class AlarmStatusUpdate(BaseModel):
    trace_id: str
    checked: bool

@app.post("/api/alarms/check")
async def update_alarm_status(alarm_update: AlarmStatusUpdate):
    """알림 상태를 업데이트합니다."""
    try:
        status_file = "alarm_status.json"
        
        alarm_status = {}
        if os.path.exists(status_file):
            try:
                with open(status_file, 'r', encoding='utf-8') as f:
                    alarm_status = json.load(f)
            except:
                alarm_status = {}
        
        alarm_status[alarm_update.trace_id] = alarm_update.checked
        
        with open(status_file, 'w', encoding='utf-8') as f:
            json.dump(alarm_status, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "알림 상태가 업데이트되었습니다."}
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

def get_alarm_checked_status(trace_id: str) -> bool:
    """알림의 확인 상태를 반환합니다."""
    try:
        status_file = "alarm_status.json"
        
        if os.path.exists(status_file):
            with open(status_file, 'r', encoding='utf-8') as f:
                alarm_status = json.load(f)
                return alarm_status.get(trace_id, False)
        return False
    except:
        return False

@app.get("/api/alarms/infinite")
async def get_alarms_infinite(
    cursor: str = None, 
    limit: int = 20,
    current_user: dict = Depends(get_current_user_with_roles)
):
    """사용자별 무한스크롤용 알람 API"""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "should": [
                        {"term": {"tag.otel@status_code": "ERROR"}},
                        {"exists": {"field": "tag.sigma@alert"}},
                        {"term": {"tag.error": True}}
                    ],
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},  
                                {"term": {"tag.user_id": username}}  
                            ]
                        }}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 1000,  
            "from": 0
        }

        if cursor:
            try:
                cursor_time = datetime.fromisoformat(cursor.replace('Z', '+00:00'))
                query["query"]["bool"]["filter"] = [
                    {"range": {"startTimeMillis": {"lt": int(cursor_time.timestamp() * 1000)}}}
                ]
            except:
                pass
        
        response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
        alarms = []
        seen_trace_ids = set()
        
        for span in response['hits']['hits']:
            src = span['_source']
            trace_id = src.get("traceID", "")
            if trace_id in seen_trace_ids:
                continue
            seen_trace_ids.add(trace_id)
            tag = src.get('tag', {})
            alarms.append({
                "trace_id": trace_id,
                "detected_at": to_korea_time(src.get("startTimeMillis", 0)),
                "summary": src.get("operationName") or "-",
                "host": tag.get("User", "-"),
                "os": tag.get("Product", "-"),
                "checked": get_alarm_checked_status(trace_id),
                "user_id": user_id
            })
        
        return {
            "alarms": alarms[:limit],
            "hasMore": len(alarms) > limit,
            "nextCursor": alarms[limit-1]["detected_at"] if len(alarms) > limit else None,
            "user_id": user_id
        }
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timeseries")
async def get_timeseries(current_user: dict = Depends(get_current_user_with_roles)):
    """Trace 단위 시계열 데이터를 반환합니다. 사용자별 필터링 지원."""
    try:
        user_id = current_user.get("id")
        username = current_user.get("username")
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 10000
        }
        response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
        spans_data = response['hits']['hits']
        
        trace_groups = {}
        
        for span in spans_data:
            src = span['_source']
            trace_id = src.get('traceID', '')
            ts = src.get('startTimeMillis')
            
            if not ts or not trace_id:
                continue
            
            if trace_id not in trace_groups:
                trace_groups[trace_id] = {
                    'start_time': ts,
                    'total_duration': 0,
                    'span_count': 0,
                    'has_anomaly': False,
                    'operation_name': src.get('operationName', ''),
                    'service_name': src.get('serviceName', '')
                }
            
            trace_groups[trace_id]['total_duration'] += src.get('duration', 0)
            trace_groups[trace_id]['span_count'] += 1
            
            tag = src.get('tag', {})
            is_anomaly = (
                tag.get('error') is True or
                tag.get('otel@status_code') == 'ERROR' or
                tag.get('sigma@alert') is not None
            )
            
            if is_anomaly:
                trace_groups[trace_id]['has_anomaly'] = True
        
        result = []
        for trace_id, trace_data in trace_groups.items():
            timestamp = to_korea_time(trace_data['start_time'])
            
            result.append({
                "timestamp": timestamp,
                "duration": trace_data['total_duration'],
                "trace_id": trace_id,
                "span_count": trace_data['span_count'],
                "has_anomaly": trace_data['has_anomaly'],
                "operation_name": trace_data['operation_name'],
                "service_name": trace_data['service_name']
            })
        
        result.sort(key=lambda x: x['timestamp'])
        
        if len(result) > 30:
            step = len(result) // 30
            result = result[::step]
        

        
        if len(result) == 0:
            pass
        
        return result
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/donut-stats")
async def get_donut_stats(current_user: dict = Depends(get_current_user_with_roles)):
    """도넛 차트용 정상/위험 Trace 통계를 반환합니다. 사용자별 필터링 지원."""
    try:
        user_id = current_user.get("id")
        username = current_user.get("username")
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 10000
        }
        
        try:
            response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
            spans_data = response['hits']['hits']

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenSearch 쿼리 실패: {str(e)}")
        
        trace_groups = {}
        
        for span in spans_data:
            src = span['_source']
            trace_id = src.get('traceID', '')
            
            if trace_id not in trace_groups:
                trace_groups[trace_id] = {
                    'has_anomaly': False
                }
            
            tag = src.get('tag', {})
            is_anomaly = (
                tag.get('anomaly') is not None or
                tag.get('error') is True or
                tag.get('otel@status_code') == 'ERROR' or
                tag.get('sigma@alert') is not None
            )
            
            if is_anomaly:
                trace_groups[trace_id]['has_anomaly'] = True
        
        total_traces = len(trace_groups)
        normal_traces = sum(1 for trace in trace_groups.values() if not trace['has_anomaly'])
        anomaly_traces = sum(1 for trace in trace_groups.values() if trace['has_anomaly'])
        
        normal_percentage = round((normal_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        anomaly_percentage = round((anomaly_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        
        return {
            "normalCount": normal_traces,
            "anomalyCount": anomaly_traces,
            "total": total_traces,
            "normalPercentage": normal_percentage,
            "anomalyPercentage": anomaly_percentage,
            "processed": total_traces,
            "failed": 0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trace-stats")
async def get_trace_stats(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """Trace 단위로 집계된 통계를 반환합니다. 사용자별 필터링 지원."""
    try:
        query = {
            "query": {"match_all": {}},
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 10000,
            "aggs": {
                "trace_groups": {
                    "terms": {
                        "field": "traceID",
                        "size": 10000
                    },
                    "aggs": {
                        "has_error": {
                            "terms": {
                                "field": "tag.error"
                            }
                        },
                        "has_sigma_alert": {
                            "terms": {
                                "field": "tag.sigma@alert"
                            }
                        },
                        "total_duration": {
                            "sum": {
                                "field": "duration"
                            }
                        },
                        "span_count": {
                            "value_count": {
                                "field": "traceID"
                            }
                        }
                    }
                }
            }
        }
        

        user_id = current_user["id"]
        username = current_user["username"]
        query["query"] = {
            "bool": {
                "must": [
                    {"bool": {
                        "should": [
                            {"term": {"tag.user_id": str(user_id)}},  
                            {"term": {"tag.user_id": username}}  
                        ]
                    }}
                ]
            }
        }
        
        response = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        trace_stats = response.get('aggregations', {}).get('trace_groups', {}).get('buckets', [])
        
        total_traces = len(trace_stats)
        normal_traces = 0
        anomaly_traces = 0
        total_duration = 0
        total_spans = 0
        total_alerts = 0
        
        for trace_bucket in trace_stats:
            span_count = trace_bucket['span_count']['value']
            duration = trace_bucket['total_duration']['value']
            
            has_error = any(bucket['key'] == True for bucket in trace_bucket['has_error']['buckets'])

            has_sigma_alert = len(trace_bucket['has_sigma_alert']['buckets']) > 0
            
            is_anomaly = has_error or has_sigma_alert
            
            if is_anomaly:
                anomaly_traces += 1
                total_alerts += span_count
            else:
                normal_traces += 1
            
            total_duration += duration
            total_spans += span_count
        
        avg_duration = total_duration / total_traces if total_traces > 0 else 0
        normal_percentage = round((normal_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        anomaly_percentage = round((anomaly_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        
        return {
            "totalTraces": total_traces,
            "normalTraces": normal_traces,
            "anomalyTraces": anomaly_traces,
            "normalPercentage": normal_percentage,
            "anomalyPercentage": anomaly_percentage,
            "avgDuration": avg_duration,
            "totalSpans": total_spans,
            "totalAlerts": total_alerts,
            "user_id": current_user["id"],
            "username": current_user["username"]
        }
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarms/severity")
async def get_alarms_severity(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """알람들의 위험도 정보를 반환합니다. 사용자별 필터링 지원."""
    try:
        if mongo_collection is None:
            raise HTTPException(status_code=500, detail="MongoDB 연결이 없습니다.")
        
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }},
                        {"term": {"tag.error": True}},
                        {"exists": {"field": "tag.sigma@alert"}}
                    ]
                }
            },
            "size": 1000
        }
        
        spans_data = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        severity_data = {}
        
        for hit in spans_data['hits']['hits']:
            source = hit['_source']
            tag = source.get('tag', {})
            sigma_alert_id = tag.get('sigma@alert')
            
            if sigma_alert_id:

                rule_info = mongo_collection.find_one({"sigma_id": sigma_alert_id})
                
                if rule_info:
                    level = rule_info.get('level', 'medium')
                    severity_score = rule_info.get('severity_score', 60)
                    title = rule_info.get('title', 'Unknown Rule')
                    
                    severity_data[sigma_alert_id] = {
                        "level": level,
                        "severity_score": severity_score,
                        "title": title,
                        "sigma_id": sigma_alert_id
                    }
        
        return {
            "severity_data": severity_data,
            "total_alerts": len(severity_data)
        }
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarms/{trace_id}/severity")
async def get_trace_severity(
    trace_id: str,
    current_user: dict = Depends(get_current_user_with_roles)
):
    """특정 Trace의 심각도 정보를 반환합니다. 사용자별 필터링 지원."""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"traceID": trace_id}},
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ]
                }
            },
            "size": 1000
        }
        
        response = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        if not response['hits']['hits']:
            return {
                "trace_id": trace_id,
                "severity": "low",
                "level": "low",
                "severity_score": 30,
                "matched_rules": [],
                "found": False
            }
        
        severity_scores = []
        matched_rules = []
        
        for span in response['hits']['hits']:
            src = span['_source']
            tag = src.get('tag', {})
            sigma_alert = tag.get('sigma@alert', '')
            
            if sigma_alert:
                try:
                    rule_info = mongo_collection.find_one({"sigma_id": sigma_alert})
                    if rule_info:
                        severity_score = rule_info.get('severity_score', 30)
                        level = rule_info.get('level', 'low')
                        title = rule_info.get('title', '')
                        
                        severity_scores.append(severity_score)
                        matched_rules.append({
                            "sigma_id": sigma_alert,
                            "level": level,
                            "severity_score": severity_score,
                            "title": title
                        })
                    else:
                        severity_scores.append(90)
                        matched_rules.append({
                            "sigma_id": sigma_alert,
                            "level": "high",
                            "severity_score": 90,
                            "title": sigma_alert
                        })
                except Exception as e:
            
                    severity_scores.append(90)
                    matched_rules.append({
                        "sigma_id": sigma_alert,
                        "level": "high",
                        "severity_score": 90,
                        "title": sigma_alert
                    })
        
        if severity_scores:
            avg_severity_score = sum(severity_scores) / len(severity_scores)
        else:
            
            if any(span['_source'].get('tag', {}).get('error', False) for span in response['hits']['hits']):
                avg_severity_score = 60
                severity = "medium"
            else:
                avg_severity_score = 30
                severity = "low"
        
        if avg_severity_score >= 90:
            severity = "critical"
        elif avg_severity_score >= 80:
            severity = "high"
        elif avg_severity_score > 60:
            severity = "medium"
        else:
            severity = "low"
        
        return {
            "trace_id": trace_id,
            "severity": severity,
            "level": severity,
            "severity_score": avg_severity_score,
            "matched_rules": matched_rules,
            "found": True
        }
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sigma-rule/{sigma_id}")
async def get_sigma_rule(
    sigma_id: str,
    current_user: dict = Depends(get_current_user_with_roles)
):
    """특정 Sigma 룰 정보를 반환합니다. 사용자별 필터링 지원."""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        if mongo_collection is None:
            return {
                "sigma_id": sigma_id,
                "title": sigma_id,
                "level": "high",
                "severity_score": 90,
                "found": False
            }
            
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"tag.sigma@alert": sigma_id}},
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ]
                }
            },
            "size": 1
        }

        user_alarms = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        if not user_alarms['hits']['hits']:
            return {
                "sigma_id": sigma_id,
                "title": sigma_id,
                "level": "high",
                "severity_score": 90,
                "found": False,
                "message": "사용자에게 해당 Sigma 룰이 적용된 알람이 없습니다."
            }
        
        rule_info = mongo_collection.find_one({"sigma_id": sigma_id})
        
        if not rule_info:
            return {
                "sigma_id": sigma_id,
                "title": sigma_id,
                "level": "high",
                "severity_score": 90,
                "found": False
            }
        
        return {
            "sigma_id": sigma_id,
            "title": rule_info.get('title', sigma_id),
            "level": rule_info.get('level', 'low'),
            "severity_score": rule_info.get('severity_score', 30),
            "description": rule_info.get('description', ''),
            "found": True,
            "user_has_alarm": True
        }
        
    except Exception as e:

        return {
            "sigma_id": sigma_id,
            "title": sigma_id,
            "level": "high",
            "severity_score": 90,
            "found": False
        }

@app.get("/api/bar-chart")
async def get_bar_chart_data(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """바 차트용 사용자별 이벤트 분포 데이터를 반환합니다."""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ],
                    "should": [
                        {"term": {"tag.error": True}},
                        {"exists": {"field": "tag.sigma@alert"}}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 1000
        }
        
        spans_data = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        user_stats = {}
        
        for span in spans_data['hits']['hits']:
            src = span['_source']
            user = src.get('tag', {}).get('user', 'unknown')
            
            if user not in user_stats:
                user_stats[user] = {
                    'normalCount': 0,
                    'anomalyCount': 0
                }
            
            user_stats[user]['anomalyCount'] += 1

        sorted_users = sorted(
            user_stats.items(),
            key=lambda x: x[1]['normalCount'] + x[1]['anomalyCount'],
            reverse=True
        )[:5]
        
        return [
            {
                'user': user,
                'normalCount': stats['normalCount'],
                'anomalyCount': stats['anomalyCount']
            }
            for user, stats in sorted_users
        ]
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/heatmap")
async def get_heatmap_data(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """히트맵용 시간대별 활동 패턴 데이터를 반환합니다."""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {
                            "should": [
                                {"term": {"tag.user_id": str(user_id)}},
                                {"term": {"tag.user_id": username}}
                            ]
                        }}
                    ],
                    "should": [
                        {"term": {"tag.error": True}},
                        {"exists": {"field": "tag.sigma@alert"}}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": 1000
        }
        
        spans_data = opensearch_analyzer.client.search(
            index="jaeger-span-*",
            body=query
        )
        
        time_stats = {}
        
        for span in spans_data['hits']['hits']:
            src = span['_source']
            start_time = src.get('startTimeMillis', 0)
            
            if start_time > 0:
        
                hour = datetime.fromtimestamp(start_time / 1000).hour
                if hour not in time_stats:
                    time_stats[hour] = 0
                time_stats[hour] += 1
        

        heatmap_data = []
        for hour in range(24):
            count = time_stats.get(hour, 0)
            heatmap_data.append({
                'hour': hour,
                'count': count
            })
        
        return heatmap_data
        
    except Exception as e:

        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 