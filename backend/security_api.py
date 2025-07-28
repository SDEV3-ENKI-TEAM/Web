from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime, timedelta, timezone
from security_log_analyzer import SecurityLogAnalyzer
from opensearch_analyzer import OpenSearchAnalyzer
import re
import json
import os

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
        # Trace 기반 통계 사용
        trace_stats = await get_trace_stats()
        
        return {
            "totalEvents": trace_stats["totalTraces"],  # Trace 단위로 변경
            "anomalies": trace_stats["anomalyTraces"],  # 위험한 Trace 수
            "avgAnomaly": trace_stats["avgDuration"],   # 평균 Trace duration
            "highestScore": trace_stats["totalAlerts"],  # 총 알럿 수
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
                continue                                  
            seen_trace_ids.add(trace_id)
            tag = src.get('tag', {})
            alarms.append({
                "trace_id": trace_id,
                "detected_at": to_korea_time(src.get("startTimeMillis", 0)),
                "summary": src.get("operationName") or "-",    # AI 요약(추후), 없으면 "-"
                "host": tag.get("User", "-"),
                "os": tag.get("Product", "-"),
                "checked": get_alarm_checked_status(trace_id)
            })
        total = len(alarms)
        paged = alarms[offset:offset+limit]
        has_more = offset + limit < total
        return {"alarms": paged, "total": total, "offset": offset, "limit": limit, "hasMore": has_more}
    except Exception as e:
        print(f"알람 API 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AlarmStatusUpdate(BaseModel):
    trace_id: str
    checked: bool

@app.post("/api/alarms/check")
async def update_alarm_status(alarm_update: AlarmStatusUpdate):
    """알림 상태를 업데이트합니다."""
    try:
        # 알림 상태를 저장할 파일 경로
        status_file = "alarm_status.json"
        
        # 기존 상태 로드
        alarm_status = {}
        if os.path.exists(status_file):
            try:
                with open(status_file, 'r', encoding='utf-8') as f:
                    alarm_status = json.load(f)
            except:
                alarm_status = {}
        
        # 상태 업데이트
        alarm_status[alarm_update.trace_id] = alarm_update.checked
        
        # 파일에 저장
        with open(status_file, 'w', encoding='utf-8') as f:
            json.dump(alarm_status, f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": "알림 상태가 업데이트되었습니다."}
    except Exception as e:
        print(f"알림 상태 업데이트 오류: {e}")
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

@app.get("/api/timeseries")
async def get_timeseries():
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=1000)
        result = []
        
        # 개별 스팬 데이터를 시간순으로 정렬하여 반환
        for span in spans_data['hits']:
            src = span['_source']
            ts = src.get('startTimeMillis')
            duration = src.get('duration', 0)
            
            if not ts:
                continue
                
            timestamp = to_korea_time(ts)
            
            result.append({
                "timestamp": timestamp,
                "duration": duration,
                "operationName": src.get('operationName', ''),
                "serviceName": src.get('serviceName', '')
            })
        
        result.sort(key=lambda x: x['timestamp'])
        
        if len(result) > 30:
            step = len(result) // 30
            result = result[::step]
        

        if not result:
            now = datetime.now(timezone(timedelta(hours=9)))  # 한국 시간
            for i in range(10):
                timestamp = (now - timedelta(minutes=i*5)).strftime('%Y-%m-%dT%H:%M:%S')
                duration = 100 + (i * 50) + (i % 3 * 20)
                result.append({
                    "timestamp": timestamp,
                    "duration": duration,
                    "operationName": "sample_operation",
                    "serviceName": "sample_service"
                })
            result.reverse()
        
        return result
    except Exception as e:
        print(f"/api/timeseries 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trace-timeseries")
async def get_trace_timeseries():
    """Trace 단위 시계열 데이터를 반환합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=1000)
        trace_groups = {}
        
        # Trace ID별로 스팬 그룹화
        for span in spans_data['hits']:
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
            
            # 위험 판단
            tag = src.get('tag', {})
            is_anomaly = (
                tag.get('anomaly') is not None or
                tag.get('error') is True or
                tag.get('otel@status_code') == 'ERROR' or
                tag.get('sigma@alert') is not None
            )
            
            if is_anomaly:
                trace_groups[trace_id]['has_anomaly'] = True
        
        # Trace 데이터를 시간순으로 정렬
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
        
        # 데이터가 너무 많으면 샘플링 (최대 30개)
        if len(result) > 30:
            step = len(result) // 30
            result = result[::step]
        
        # 데이터가 없으면 샘플 데이터 생성
        if not result:
            now = datetime.now(timezone(timedelta(hours=9)))  # 한국 시간
            for i in range(10):
                timestamp = (now - timedelta(minutes=i*5)).strftime('%Y-%m-%dT%H:%M:%S')
                duration = 500 + (i * 100) + (i % 3 * 50)  # Trace는 더 긴 duration
                result.append({
                    "timestamp": timestamp,
                    "duration": duration,
                    "trace_id": f"sample_trace_{i}",
                    "span_count": 3 + (i % 5),
                    "has_anomaly": i % 3 == 0,
                    "operation_name": "sample_trace_operation",
                    "service_name": "sample_service"
                })
            result.reverse()
        
        return result
    except Exception as e:
        print(f"/api/trace-timeseries 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/donut-stats")
async def get_donut_stats():
    """도넛 차트용 정상/위험 Trace 통계를 반환합니다."""
    try:
        # Trace 기반 통계 사용
        trace_stats = await get_trace_stats()
        
        return {
            "normalCount": trace_stats["normalTraces"],
            "anomalyCount": trace_stats["anomalyTraces"],
            "total": trace_stats["totalTraces"],
            "normalPercentage": trace_stats["normalPercentage"],
            "anomalyPercentage": trace_stats["anomalyPercentage"],
            "processed": trace_stats["totalTraces"],
            "failed": 0
        }
    except Exception as e:
        print(f"/api/donut-stats 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/trace-stats")
async def get_trace_stats():
    """Trace 단위로 집계된 통계를 반환합니다."""
    try:
        spans_data = opensearch_analyzer.get_jaeger_spans(limit=1000)
        trace_groups = {}
        
        # Trace ID별로 스팬 그룹화
        for span in spans_data['hits']:
            src = span['_source']
            trace_id = src.get('traceID', '')
            
            if trace_id not in trace_groups:
                trace_groups[trace_id] = {
                    'spans': [],
                    'start_time': src.get('startTimeMillis', 0),
                    'total_duration': 0,
                    'has_anomaly': False,
                    'alert_count': 0,
                    'span_count': 0
                }
            
            trace_groups[trace_id]['spans'].append(src)
            trace_groups[trace_id]['span_count'] += 1
            trace_groups[trace_id]['total_duration'] += src.get('duration', 0)
            
            # 위험 판단
            tag = src.get('tag', {})
            is_anomaly = (
                tag.get('anomaly') is not None or
                tag.get('error') is True or
                tag.get('otel@status_code') == 'ERROR' or
                tag.get('sigma@alert') is not None
            )
            
            if is_anomaly:
                trace_groups[trace_id]['has_anomaly'] = True
                trace_groups[trace_id]['alert_count'] += 1
        
        # 통계 계산
        total_traces = len(trace_groups)
        normal_traces = sum(1 for trace in trace_groups.values() if not trace['has_anomaly'])
        anomaly_traces = sum(1 for trace in trace_groups.values() if trace['has_anomaly'])
        
        # 평균 지속 시간 계산
        total_duration = sum(trace['total_duration'] for trace in trace_groups.values())
        avg_duration = total_duration / total_traces if total_traces > 0 else 0
        
        # 데이터가 없으면 기본값 설정
        if total_traces == 0:
            normal_traces = 4
            anomaly_traces = 10
            total_traces = 14
        
        normal_percentage = round((normal_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        anomaly_percentage = round((anomaly_traces / total_traces) * 100, 1) if total_traces > 0 else 0
        
        return {
            "totalTraces": total_traces,
            "normalTraces": normal_traces,
            "anomalyTraces": anomaly_traces,
            "normalPercentage": normal_percentage,
            "anomalyPercentage": anomaly_percentage,
            "avgDuration": avg_duration,
            "totalSpans": sum(trace['span_count'] for trace in trace_groups.values()),
            "totalAlerts": sum(trace['alert_count'] for trace in trace_groups.values())
        }
    except Exception as e:
        print(f"/api/trace-stats 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 