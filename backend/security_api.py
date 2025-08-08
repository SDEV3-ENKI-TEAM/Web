import json
import os
import logging
import redis
from pathlib import Path
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta, timezone
from opensearch_analyzer import OpenSearchAnalyzer
from pymongo import MongoClient
# .env 파일 로드
try:
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path, encoding='utf-8')
except Exception as e:
    print(f".env 파일 로드 중 오류: {e}")
    try:
        # 다른 인코딩 시도
        load_dotenv(env_path, encoding='cp949')
    except Exception as e2:
        print(f"cp949 인코딩도 실패: {e2}")
        # 기본 .env 로드 시도
        load_dotenv()

# 인증 관련 import
from auth_api import router as auth_router

# 로깅 설정
logging.basicConfig(
    level=logging.WARNING,  # INFO에서 WARNING으로 변경
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# SQLAlchemy 로그 완전 비활성화
logging.getLogger('sqlalchemy.engine').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy.pool').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy.dialects').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy').setLevel(logging.CRITICAL)

# FastAPI 로그 조정
logging.getLogger('uvicorn.access').setLevel(logging.INFO)  # HTTP 요청 로그만 유지
logging.getLogger('uvicorn.error').setLevel(logging.WARNING)
logging.getLogger('fastapi').setLevel(logging.WARNING)

# 레이트 리밋 설정
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()

# 레이트 리밋 예외 핸들러 추가
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 인증 라우터 추가
app.include_router(auth_router)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# WebSocket 연결 관리
class WebSocketManager:
    """WebSocket 연결 관리"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_count = 0
    
    async def connect(self, websocket: WebSocket):
        """새로운 WebSocket 연결 추가"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_count += 1
        logger.info(f"새로운 WebSocket 연결: {len(self.active_connections)}개 (총 연결 수: {self.connection_count})")
    
    def disconnect(self, websocket: WebSocket):
        """WebSocket 연결 제거"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket 연결 해제: {len(self.active_connections)}개 (총 연결 수: {self.connection_count})")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """개별 클라이언트에게 메시지 전송"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"메시지 전송 실패: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        """모든 연결된 클라이언트에게 메시지 브로드캐스트"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"브로드캐스트 실패: {e}")
                disconnected.append(connection)
        
        # 연결이 끊어진 클라이언트 제거
        for connection in disconnected:
            self.disconnect(connection)

class ValkeyEventReader:
    """Valkey에서 WebSocket 이벤트를 읽는 클래스"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        valkey_host = os.getenv('VALKEY_HOST', host)  # EC2 IP 주소
        valkey_port = int(os.getenv('VALKEY_PORT', port))
        
        self.valkey_client = redis.Redis(
            host=valkey_host,
            port=valkey_port,
            db=db,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        self.last_event_index = 0
    
    def get_websocket_events(self) -> List[Dict[str, Any]]:
        """새로운 WebSocket 이벤트 조회"""
        try:
            events = self.valkey_client.lrange('websocket_events', 0, -1)
            new_events = []
            
            for event_str in events:
                try:
                    event = json.loads(event_str)
                    new_events.append(event)
                except json.JSONDecodeError as e:
                    logger.error(f"이벤트 JSON 파싱 실패: {e}")
                    continue
            
            return new_events
        except Exception as e:
            logger.error(f"Valkey 이벤트 조회 실패: {e}")
            return []
    
    def get_recent_alarms(self, limit: int = 10) -> List[Dict[str, Any]]:
        """최근 알람 데이터 조회 - HTTP API와 동일한 로직 사용"""
        try:
            # OpenSearch에서 직접 데이터 조회 (HTTP API와 동일한 로직)
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
            
            # OpenSearch 클라이언트 가져오기
            from opensearch_analyzer import OpenSearchAnalyzer
            opensearch_analyzer = OpenSearchAnalyzer()
            
            response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
            alarms = []
            seen_trace_ids = set()
            trace_span_counts = {}
            
            unique_trace_ids = list(set(span['_source'].get("traceID", "") for span in response['hits']['hits'] if span['_source'].get("traceID", "")))
            
            # 각 trace별 sigma 룰 매칭 span 개수 계산
            for trace_id in unique_trace_ids:
                sigma_span_count = 0
                for span in response['hits']['hits']:
                    src = span['_source']
                    if src.get('traceID', '') == trace_id:
                        tag = src.get('tag', {})
                        # sigma@alert 태그가 존재하고 비어있지 않은 경우만 카운트
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
                
                # 시간 변환
                start_time_ms = src.get("startTimeMillis", 0)
                detected_at = to_korea_time(start_time_ms) if start_time_ms > 0 else datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
                
                image_path = tag.get("Image", "")
                product = tag.get("Product", "")
                if product:
                    os_value = product
                elif "windows" in image_path.lower() or "c:\\" in image_path.lower() or "c:/" in image_path.lower():
                    os_value = "windows"
                elif image_path.startswith("/"):
                    os_value = "linux"
                else:
                    os_value = "-"
                # Severity 계산
                severity = "low"
                severity_score = 30
                
                # Sigma Alert 기반 severity 계산
                sigma_alert_id = tag.get("sigma@alert", "")
                if sigma_alert_id:
                    try:
                        rule = mongo_collection.find_one({"sigma_id": sigma_alert_id})
                        if rule and rule.get("level"):
                            level = rule.get("level").lower()
                            if level in ['critical', 'high']:
                                severity = "high"
                                severity_score = 90
                            elif level in ['medium', 'moderate']:
                                severity = "medium"
                                severity_score = 60
                            elif level in ['low', 'info']:
                                severity = "low"
                                severity_score = 30
                    except Exception as e:
                        logger.error(f"Severity 계산 실패: {e}")
                
                # Span 개수에 따른 추가 조정
                span_count = trace_span_counts.get(trace_id, 0)
                if span_count > 50:
                    severity_score = min(100, severity_score + 20)
                    if severity_score > 80:
                        severity = "high"
                elif span_count > 20:
                    severity_score = min(100, severity_score + 10)
                    if severity_score > 70:
                        severity = "medium"
                
                alarm = {
                    "trace_id": trace_id,
                    "detected_at": detected_at,
                    "summary": src.get("operationName") or "-",
                    "host": tag.get("User", "-"),
                    "os": os_value,
                    "checked": get_alarm_checked_status(trace_id),
                    "sigma_alert": tag.get("sigma@alert", ""),
                    "span_count": span_count,
                    "ai_summary": "테스트 요약",
                    "severity": severity,
                    "severity_score": severity_score
                }
                sigma_alert_id = tag.get("sigma@alert", "")
                sigma_rule_title = ""
                if sigma_alert_id:
                    rule = mongo_collection.find_one({"sigma_id": sigma_alert_id})
                    if rule and rule.get("title"):
                        sigma_rule_title = rule["title"]
                alarm["sigma_rule_title"] = sigma_rule_title
                alarms.append(alarm)
                
                if len(alarms) >= limit:
                    break
            
            return alarms[:limit]
            
        except Exception as e:
            logger.error(f"OpenSearch 알람 조회 실패: {e}")
            # 실패 시 Valkey에서 기존 데이터 조회
            try:
                alarms = self.valkey_client.lrange('recent_alarms', 0, limit - 1)
                recent_alarms = []
                
                for alarm_str in alarms:
                    try:
                        alarm = json.loads(alarm_str)
                        recent_alarms.append(alarm)
                    except json.JSONDecodeError as e:
                        logger.error(f"알람 JSON 파싱 실패: {e}")
                        continue
                
                return recent_alarms
            except Exception as e2:
                logger.error(f"Valkey 알람 조회 실패: {e2}")
                return []

# WebSocket 매니저와 Valkey 리더 초기화
manager = WebSocketManager()
valkey_reader = ValkeyEventReader()

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
    end_time: Optional[datetime] = None

from auth_deps import get_current_user_with_roles, require_role, get_current_username, get_current_user_id, require_any_role

@app.get("/api/traces/search/{trace_id}")
async def search_trace_by_id(
    trace_id: str, 
    current_user: dict = Depends(get_current_user_with_roles)
):
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

# 새로운 의존성 시스템 사용 예시들
@app.get("/api/test/user-info")
async def get_user_info(current_user: dict = Depends(get_current_user_with_roles)):
    """사용자 정보와 역할을 반환하는 예시"""
    return {
        "message": "사용자 정보 조회 성공",
        "user": current_user
    }

@app.get("/api/test/username")
async def get_username_only(username: str = Depends(get_current_username)):
    """사용자명만 반환하는 예시"""
    return {
        "message": "사용자명 조회 성공",
        "username": username
    }

@app.get("/api/test/user-id")
async def get_user_id_only(user_id: int = Depends(get_current_user_id)):
    """사용자 ID만 반환하는 예시"""
    return {
        "message": "사용자 ID 조회 성공",
        "user_id": user_id
    }

@app.get("/api/test/admin-only")
async def admin_only_endpoint(
    current_user: dict = Depends(require_role("ROLE_ADMIN"))
):
    """관리자만 접근 가능한 엔드포인트 예시"""
    return {
        "message": "관리자 전용 엔드포인트",
        "user": current_user
    }

@app.get("/api/test/any-admin-role")
async def any_admin_role_endpoint(
    current_user: dict = Depends(require_any_role(["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]))
):
    """여러 관리자 역할 중 하나라도 있으면 접근 가능한 엔드포인트 예시"""
    return {
        "message": "관리자 역할이 있는 사용자 전용 엔드포인트",
        "user": current_user
    }
# alarms/[trace_id]페이지에서 사용하는 API
@app.get("/api/traces/node/{trace_id}/{node_id}")
async def get_node_detail(
    trace_id: str, 
    node_id: str,
    current_user: dict = Depends(get_current_user_with_roles)
):
    """특정 노드의 상세 정보를 반환합니다."""
    try:
        events = opensearch_analyzer.get_process_tree_events(trace_id)
        
        if not events:
            return {
                "data": None,
                "found": False,
                "message": f"Trace ID '{trace_id}'를 찾을 수 없습니다."
            }
        
        try:
            node_index = int(node_id)
            if node_index < 0 or node_index >= len(events):
                return {
                    "data": None,
                    "found": False,
                    "message": f"노드 ID '{node_id}'가 유효하지 않습니다."
                }
            
            target_event = events[node_index]
            
            transformed_event = opensearch_analyzer.transform_jaeger_span_to_event({
                "_source": target_event
            })
            
            return {
                "data": transformed_event,
                "found": True,
                "message": f"노드 {node_id} 정보를 찾았습니다."
            }
            
        except ValueError:
            return {
                "data": None,
                "found": False,
                "message": f"노드 ID '{node_id}'가 숫자가 아닙니다."
            }
        
    except Exception as e:

        return {
            "data": None,
            "found": False,
            "message": f"노드 정보 조회 중 오류가 발생했습니다: {str(e)}"
        }

@app.get("/api/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user_with_roles)):
    """사용자별 대시보드 통계"""
    try:
        user_id = current_user["id"]
        username = current_user["username"]
        

        
        # 직접 통계 계산
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
        
        # 기본 쿼리
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
        
        # 사용자별 필터링 추가
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
        
        # 각 trace별 sigma 룰 매칭 span 개수 계산
        for trace_id in unique_trace_ids:
            sigma_span_count = 0
            for span in response['hits']['hits']:
                src = span['_source']
                if src.get('traceID', '') == trace_id:
                    tag = src.get('tag', {})
                    # sigma@alert 태그가 존재하고 비어있지 않은 경우만 카운트
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
                "ai_summary": "테스트 요약", # AI 요약 추가 필요
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
        
        logger.debug(f"OpenSearch 조회 결과: {len(response['hits']['hits'])}개 span → {len(alarms)}개 고유 trace")
        
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
        

        
        # 사용자별 필터링 쿼리 생성 (alarms/infinite와 동일한 구조)
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
        

        
        # 사용자별 필터링된 데이터 조회
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
        # 기본 쿼리
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
        
        # 사용자별 필터링 추가
        user_id = current_user["id"]
        username = current_user["username"]
        
        # 사용자별 데이터 필터링 (사용자 ID 또는 사용자명으로 필터링)
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
    """알람들의 위험도 정보를 반환합니다."""
    try:
        if mongo_collection is None:
            raise HTTPException(status_code=500, detail="MongoDB 연결이 없습니다.")
        
        query = {
            "query": {
                "bool": {
                    "must": [
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
    """특정 Trace의 심각도 정보를 반환합니다."""
    try:
        query = {
            "query": {
                "term": {"traceID": trace_id}
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
            # sigma 룰이 없지만 에러가 있는 경우
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
    """특정 Sigma 룰 정보를 반환합니다."""
    try:
        if mongo_collection is None:
            return {
                "sigma_id": sigma_id,
                "title": sigma_id,
                "level": "high",
                "severity_score": 90,
                "found": False
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
            "found": True
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
                # 시간대별로 그룹화 (0-23시)
                hour = datetime.fromtimestamp(start_time / 1000).hour
                if hour not in time_stats:
                    time_stats[hour] = 0
                time_stats[hour] += 1
        
        # 0-23시 모든 시간대에 대해 데이터 생성
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

@app.get("/api/opensearch/test")
async def test_opensearch_connection(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """AWS OpenSearch 연결을 테스트합니다."""
    try:
        analyzer = OpenSearchAnalyzer()
        result = analyzer.test_connection()
        return result
    except Exception as e:
        logger.error(f"OpenSearch 연결 테스트 실패: {e}")
        return {
            "status": "error",
            "message": f"연결 테스트 실패: {str(e)}",
            "error_details": str(e)
        }

@app.get("/api/opensearch/info")
async def get_opensearch_info(
    current_user: dict = Depends(get_current_user_with_roles)
):
    """AWS OpenSearch 연결 정보를 반환합니다."""
    try:
        analyzer = OpenSearchAnalyzer()
        info = analyzer.get_connection_info()
        return info
    except Exception as e:
        logger.error(f"OpenSearch 정보 조회 실패: {e}")
        return {
            "status": "error",
            "message": f"정보 조회 실패: {str(e)}",
            "error_details": str(e)
        }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 