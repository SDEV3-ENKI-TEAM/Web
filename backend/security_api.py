from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
from security_log_analyzer import SecurityLogAnalyzer
from opensearch_analyzer import OpenSearchAnalyzer
import re

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 분석기 인스턴스 생성 (Elasticsearch 제거, OpenSearch만 사용)
analyzer = SecurityLogAnalyzer()
opensearch_analyzer = OpenSearchAnalyzer()

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
    end_time: Optional[datetime] = None

# ============ EventAgent OpenSearch 전용 API ============

@app.get("/api/opensearch/status")
async def get_opensearch_status():
    """OpenSearch 및 Jaeger 인덱스 상태를 확인합니다."""
    try:
        status = opensearch_analyzer.check_jaeger_indices()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jaeger/spans")
async def get_jaeger_spans(limit: int = 100, offset: int = 0):
    """EventAgent Jaeger 스팬 데이터를 조회합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=limit, offset=offset)
        events = []
        
        for span in spans_data['hits']:
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            events.append(event)
        
        return {
            "events": events,
            "total": spans_data['total'],
            "status": "success"
        }
    except Exception as e:
        print(f"Jaeger 스팬 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OpenSearch 연결 오류: {str(e)}")

@app.get("/api/jaeger/sigma-alerts")
async def get_sigma_alerts(limit: int = 50):
    """Sigma 룰 매칭 알럿을 조회합니다."""
    try:
        alerts_data = opensearch_analyzer.get_sigma_alerts(limit=limit)
        alerts = []
        
        for span in alerts_data['hits']:
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            if event['has_alert']:  # 알럿이 있는 것만 포함
                alerts.append(event)
        
        return {
            "alerts": alerts,
            "total": alerts_data['total'],
            "status": "success"
        }
    except Exception as e:
        print(f"Sigma 알럿 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OpenSearch 연결 오류: {str(e)}")

@app.get("/api/jaeger/process-tree/{trace_id}")
async def get_process_tree(trace_id: str):
    """특정 트레이스의 프로세스 트리를 조회합니다."""
    try:
        events = opensearch_analyzer.get_process_tree_events(trace_id)
        return {
            "trace_id": trace_id,
            "events": events,
            "total": len(events),
            "status": "success"
        }
    except Exception as e:
        print(f"프로세스 트리 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OpenSearch 연결 오류: {str(e)}")

@app.get("/api/jaeger/statistics")
async def get_jaeger_statistics():
    """EventAgent 이벤트 통계를 조회합니다."""
    try:
        stats = opensearch_analyzer.get_event_statistics()
        return {
            "statistics": stats,
            "status": "success"
        }
    except Exception as e:
        print(f"통계 조회 오류: {e}")
        raise HTTPException(status_code=500, detail=f"OpenSearch 연결 오류: {str(e)}")

@app.get("/api/trace/eventAgent-alerts")
async def get_eventAgent_security_alerts():
    """EventAgent의 보안 알럿을 조회합니다."""
    try:
        alerts_data = opensearch_analyzer.get_sigma_alerts(limit=50)
        
        # 알럿 요약 생성
        alert_summary = []
        for span in alerts_data['hits']:
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            if event['has_alert']:
                alert_summary.append({
                    "alert": event['alert_message'],
                    "process": event['process_name'],
                    "timestamp": event['timestamp'],
                    "severity": event['severity']
                })
        
        return {
            "alerts": alert_summary[:10],
            "total": alerts_data['total']
        }
    except Exception as e:
        print(f"EventAgent 알럿 조회 오류: {e}")
        return {"alerts": [], "total": 0}

@app.get("/api/trace/eventAgent-metrics")
async def get_eventAgent_metrics():
    """EventAgent 메트릭을 조회합니다."""
    try:
        stats = opensearch_analyzer.get_event_statistics()
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=1)
        
        latest_trace_id = ""
        if spans_data['hits']:
            latest_trace_id = spans_data['hits'][0]['_source'].get('traceID', '')
        
        alert_types_list = []
        try:
            alerts_data = opensearch_analyzer.get_sigma_alerts(limit=5)
            for alert in alerts_data['hits']:
                event = opensearch_analyzer.transform_jaeger_span_to_event(alert)
                if event['has_alert'] and event['alert_message']:
                    alert_types_list.append(event['alert_message'])
        except Exception as alert_error:
            print(f"알럿 타입 조회 오류: {alert_error}")
        
        return {
            "totalSpans": stats['total_spans'],
            "totalAlerts": stats['total_alerts'],
            "processEvents": len([e for e in stats['event_types'] if 'evt:1' in e.get('key', '')]),
            "fileEvents": len([e for e in stats['event_types'] if 'evt:11' in e.get('key', '')]),
            "alertTypesList": alert_types_list,
            "traceID": latest_trace_id
        }
    except Exception as e:
        print(f"EventAgent 메트릭 조회 오류: {e}")
        return {
            "totalSpans": 0,
            "totalAlerts": 0,
            "processEvents": 0,
            "fileEvents": 0,
            "alertTypesList": [],
            "traceID": ""
        }

@app.get("/api/trace/eventAgent-timeline")
async def get_eventAgent_timeline():
    """EventAgent 타임라인을 조회합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=20)
        timeline = []
        
        for span in spans_data['hits']:
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            timeline.append({
                "timestamp": event['timestamp'],
                "eventType": event['sysmon_event_id'],
                "operationName": event['operation_name'],
                "image": event['process_name'],
                "pid": event.get('all_tags', {}).get('sysmon@pid') or event.get('all_tags', {}).get('sysmon.pid', ''),
                "hasAlert": event['has_alert'],
                "alert": event['alert_message'],
                "behaviorDescription": f"{event['event_type']} - {event['process_name']}"
            })
        
        return {"timeline": timeline}
    except Exception as e:
        print(f"EventAgent 타임라인 조회 오류: {e}")
        return {"timeline": []}

@app.get("/api/trace/summary")
async def get_trace_summary():
    """EventAgent 전체 트레이스(알림) 개수와 알럿(의심스러운 활동) 개수를 반환합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=10000, offset=0)
        trace_groups = {}
        for span in spans_data['hits']:
            source = span['_source']
            trace_id = source.get('traceID', '')
            if trace_id not in trace_groups:
                trace_groups[trace_id] = []
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            trace_groups[trace_id].append(event)
        total = len(trace_groups)
        suspicious = 0
        for events in trace_groups.values():
            if any(event.get('has_alert', False) for event in events):
                suspicious += 1
        return {"total": total, "suspicious": suspicious}
    except Exception as e:
        print(f"트레이스 summary 조회 오류: {e}")
        return {"total": 0, "suspicious": 0}

@app.get("/api/traces")
async def get_traces(offset: int = 0, limit: int = 100):
    """프론트엔드 /events 페이지용 트레이스 데이터를 조회합니다."""
    try:
        
        span_limit = max(limit * 20, 1000)
        span_offset = (offset // limit) * span_limit
        
        
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=span_limit, offset=span_offset)
        
        if not spans_data.get('hits'):
            print("OpenSearch에서 스팬 데이터 없음")
            return {
                "data": [],
                "total": 0,
                "offset": offset,
                "limit": limit,
                "hasMore": False
            }
        
        trace_groups = {}
        for span in spans_data['hits']:
            source = span['_source']
            trace_id = source.get('traceID', '')
            
            if trace_id not in trace_groups:
                trace_groups[trace_id] = []
            
            event = opensearch_analyzer.transform_jaeger_span_to_event(span)
            trace_groups[trace_id].append(event)
        
        
        traces = []
        trace_ids = list(trace_groups.keys())
        
        start_idx = offset
        end_idx = min(offset + limit, len(trace_ids))
        
        for i in range(start_idx, end_idx):
            if i >= len(trace_ids):
                break
                
            trace_id = trace_ids[i]
            events = trace_groups[trace_id]
            
            events.sort(key=lambda x: x.get('timestamp', ''))
            
            first_event = events[0] if events else {}
            
            alert_events = [event for event in events if event.get('has_alert', False)]
            has_any_alert = len(alert_events) > 0
            
            sigma_matches = []
            for event in events:
                if event.get('has_alert'):
                    sigma_matches.append(event.get('alert_message', 'Suspicious activity detected'))

            unique_sigma_matches = sigma_matches
            
            trace_data = {
                "trace_id": trace_id,
                "host": {
                    "hostname": f"EventAgent-PC",
                    "ip": "192.168.1.100", 
                    "os": "Windows 10"
                },
                "events": events,
                "timestamp": first_event.get('timestamp', ''),
                "label": "이상" if has_any_alert else "정상",
                "severity": "high" if has_any_alert else "low",
                "sigma_match": unique_sigma_matches
            }
            
            traces.append(trace_data)
        
        total_traces = len(trace_ids)
        has_more = end_idx < total_traces
        
        print(f"응답: {len(traces)}개 트레이스, hasMore={has_more}, total={total_traces}")
        
        return {
            "data": traces,
            "total": total_traces,
            "offset": offset,
            "limit": limit,
            "hasMore": has_more
        }
        
    except Exception as e:
        print(f"/api/traces 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/traces/search/{trace_id}")
async def search_trace_by_id(trace_id: str):
    """특정 Trace ID로 트레이스를 검색합니다."""
    try:
        
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
        
        
        trace_data = {
            "trace_id": trace_id,
            "host": {
                "hostname": f"EventAgent-PC",
                "ip": "192.168.1.100",
                "os": "Windows 10"
            },
            "events": events,
            "timestamp": first_event.get('timestamp', ''),
            "label": "이상" if has_any_alert else "정상",
            "severity": "high" if has_any_alert else "low",
        }
        
        print(f"Trace ID {trace_id} 검색 성공: {len(events)}개 이벤트")
        
        return {
            "data": trace_data,
            "found": True,
            "message": f"Trace ID '{trace_id}'를 찾았습니다."
        }
        
    except Exception as e:
        print(f"Trace ID {trace_id} 검색 오류: {e}")
        return {
            "data": None,
            "found": False,
            "message": f"검색 중 오류가 발생했습니다: {str(e)}"
        }

@app.get("/api/dashboard")
async def get_dashboard():
    """대시보드용 이벤트 목록을 반환합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=100, offset=0)
        events = []
        for idx, span in enumerate(spans_data.get('hits', [])):
            source = span.get('_source', {})
            tag = source.get('tag', {})
            process_tag = source.get('process', {}).get('tag', {})
            ts = source.get("startTimeMillis")
            if isinstance(ts, (int, float)):
                timestamp_str = datetime.utcfromtimestamp(ts/1000).strftime("%Y-%m-%d %H:%M")
            else:
                timestamp_str = str(ts) if ts else ""
            events.append({
                "id": idx,
                "traceID": source.get("traceID"),
                "operationName": source.get("operationName"),
                "timestamp": timestamp_str,
                "duration": source.get("duration"),
                "user": tag.get("User", "-"),
                "host": process_tag.get("host@name", "-"),
                "os": process_tag.get("os@type", "-"),
                "anomaly": tag.get("anomaly", 0.0),
                "label": "위험" if tag.get("error") or tag.get("otel@status_code") == "ERROR" else "정상",
                "event": tag.get("EventName") or source.get("operationName", "-"),
            })
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard-stats")
async def get_dashboard_stats():
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=1000, offset=0)
        docs = spans_data.get('hits', [])
        anomaly_values = [doc.get('_source', {}).get('tag', {}).get('anomaly', 0.0) for doc in docs if isinstance(doc.get('_source', {}).get('tag', {}).get('anomaly', 0.0), (int, float))]
        fallback_values = [doc.get('_source', {}).get('duration', 0.0) for doc in docs if isinstance(doc.get('_source', {}).get('duration', 0.0), (int, float))]
        avg_anomaly = sum(anomaly_values) / len(anomaly_values) if anomaly_values else (sum(fallback_values) / len(fallback_values) if fallback_values else 0.0)
        highest_score = max(anomaly_values) if anomaly_values else (max(fallback_values) if fallback_values else 0.0)
        anomalies = sum(1 for doc in docs if doc.get('_source', {}).get('tag', {}).get('anomaly') is not None or doc.get('_source', {}).get('tag', {}).get('error') is True)
        return {
            "totalEvents": len(docs),
            "anomalies": anomalies,
            "avgAnomaly": avg_anomaly,
            "highestScore": highest_score,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarms")
async def get_alarm_traces(offset: int = 0, limit: int = 50):
    """OpenSearch에서 알람(에러) 조건에 해당하는 Trace만 알람 리스트로 반환합니다."""
    try:
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
            "size": max(limit * 5, 200),
            "from": 0
        }
        response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
        alarms = []
        seen_trace_ids = set()
        for span in response['hits']['hits']:
            src = span['_source']
            trace_id = src.get("traceID", "")
            if trace_id in seen_trace_ids:
                continue  # traceID별로 하나만
            seen_trace_ids.add(trace_id)
            tag = src.get('tag', {})
            alarms.append({
                "trace_id": trace_id,
                "detected_at": src.get("startTimeMillis", 0),
                "summary": src.get("operationName") or "-",    # AI 요약(추후), 없으면 "-"
                "host": tag.get("User", "-"),
                "os": tag.get("Product", "-"),
                "checked": False
            })
        total = len(alarms)
        paged = alarms[offset:offset+limit]
        has_more = offset + limit < total
        return {"alarms": paged, "total": total, "offset": offset, "limit": limit, "hasMore": has_more}
    except Exception as e:
        print(f"알람 API 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 