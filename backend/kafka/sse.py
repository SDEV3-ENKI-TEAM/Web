import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
import redis
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse

try:
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path, encoding='utf-8')
except Exception as e:
    print(f".env 파일 로드 중 오류: {e}")
    load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY")
ISSUER = "shitftx"
AUDIENCE = "shitftx-users"

if not SECRET_KEY or not isinstance(SECRET_KEY, str):
    raise RuntimeError("JWT_SECRET_KEY not set or invalid")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def verify_jwt_token(token: str) -> Optional[Dict]:
    """JWT 토큰 검증 및 사용자 정보 반환"""
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["exp", "sub", "user_id"]}
        )
        return {
            "user_id": payload.get("user_id"),
            "username": payload.get("sub"),
            "roles": payload.get("roles", [])
        }
    except jwt.ExpiredSignatureError:
        logger.warning("JWT 토큰 만료")
        return None
    except jwt.InvalidTokenError:
        logger.warning("JWT 토큰 무효")
        return None
    except Exception as e:
        logger.error(f"JWT 토큰 검증 오류: {e}")
        return None



class ValkeyEventReader:
    """Valkey에서 알람 이벤트를 읽는 클래스 (사용자별 분리)"""
    
    def __init__(self, host: str = None, port: int = None, db: int = None):
        self.valkey_client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )
        self.last_event_index = 0
    
    def get_websocket_events(self) -> List[Dict[str, Any]]:
        """새로운 알람 이벤트 조회"""
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
    
    def get_recent_alarms(self, limit: int = 10, username: Optional[str] = None) -> List[Dict[str, Any]]:
        """최근 알람 데이터 조회 (trace:* 키 사용)"""
        try:
            trace_keys = self.valkey_client.keys('trace:*')
            recent_alarms = []
            
            trace_keys.sort(reverse=True)
            
            for trace_key in trace_keys[:limit]:
                try:
                    trace_data = self.valkey_client.get(trace_key)
                    if not trace_data:
                        continue
                    alarm = json.loads(trace_data)
                    if not isinstance(alarm, dict):
                        continue
                    alarm_user_id = alarm.get('user_id')
                    if username and str(alarm_user_id) != str(username):
                        continue
                    recent_alarms.append(alarm)
                except json.JSONDecodeError as e:
                    logger.error(f"Trace JSON 파싱 실패: {e}")
                    continue
            
            return recent_alarms
        except Exception as e:
            logger.error(f"Valkey trace 조회 실패: {e}")
            return []

class SSEManager:
    """SSE 연결 관리 (사용자별 분리, per-connection queue)"""

    def __init__(self):
        self.user_queues: Dict[str, List[asyncio.Queue]] = {}

    def connect(self, user_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self.user_queues.setdefault(user_id, []).append(queue)
        logger.info(f"새로운 SSE 연결: 사용자 {user_id} (총 연결 수: {len(self.user_queues[user_id])})")
        return queue

    def disconnect(self, user_id: str, queue: asyncio.Queue):
        queues = self.user_queues.get(user_id)
        if not queues:
            return
        try:
            queues.remove(queue)
        except ValueError:
            pass
        if not queues:
            del self.user_queues[user_id]
        logger.info(f"SSE 연결 해제: 사용자 {user_id} (남은 연결 수: {len(self.user_queues.get(user_id, []))})")

    async def broadcast_to_user(self, message: str, user_id: str):
        if user_id not in self.user_queues:
            return
        for q in list(self.user_queues[user_id]):
            try:
                await q.put(message)
            except Exception as e:
                logger.error(f"SSE 큐 전송 실패: {e}")

    async def broadcast(self, message: str):
        for user_id in list(self.user_queues.keys()):
            await self.broadcast_to_user(message, user_id)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    asyncio.create_task(broadcast_events())
    logger.info("SSE 서버 시작")
    yield
    logger.info("SSE 서버 종료")

app = FastAPI(title="실시간 알람 SSE 서버", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

valkey_reader = ValkeyEventReader(
    host=os.getenv("VALKEY_HOST"),
    port=int(os.getenv("VALKEY_PORT")),
    db=int(os.getenv("VALKEY_DB"))
)

sse_manager = SSEManager()

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "실시간 알람 SSE 서버",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    try:
        valkey_reader.valkey_client.ping()
        return {
            "status": "healthy",
            "valkey_connection": "connected",
            "active_sse_connections": sum(len(queues) for queues in sse_manager.user_queues.values())
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/api/alarms/recent")
async def get_recent_alarms(limit: int = 10, username: Optional[str] = None):
    """최근 알람 데이터 조회 (REST API) - 사용자별 필터링"""
    alarms = valkey_reader.get_recent_alarms(limit, username)
    return {
        "alarms": alarms,
        "count": len(alarms)
    }




@app.get("/sse/alarms")
async def sse_alarms(limit: int = 50, token: Optional[str] = None):
    """실시간 알람 SSE 엔드포인트 (JWT 인증 필요)"""
    try:
        if not token:
            return {"error": "JWT 토큰이 필요합니다"}
        user_info = verify_jwt_token(token)
        if not user_info:
            return {"error": "JWT 토큰이 유효하지 않습니다"}

        username = str(user_info["username"])  # 사용자별 분리를 username 기준으로 수행

        recent_alarms = valkey_reader.get_recent_alarms(limit, username)
        initial_message = {
            "type": "initial_data",
            "alarms": recent_alarms or [],
            "timestamp": int(time.time() * 1000),
            "user_id": user_info.get("user_id")
        }

        async def event_generator():
            queue = sse_manager.connect(username)
            try:
                yield f"data: {json.dumps(initial_message, ensure_ascii=False)}\n\n"

                while True:
                    try:
                        message = await asyncio.wait_for(queue.get(), timeout=15)
                        yield f"data: {message}\n\n"
                    except asyncio.TimeoutError:
                        yield ":heartbeat\n\n"
            except Exception as e:
                logger.error(f"SSE 전송 오류: {e}")
            finally:
                sse_manager.disconnect(username, queue)

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(event_generator(), headers=headers, media_type="text/event-stream")
    except Exception as e:
        logger.error(f"SSE 처리 오류: {e}")
        return {"error": "internal_error"}


async def broadcast_events():
    """Valkey 이벤트를 SSE로 브로드캐스트 (사용자별 분리)"""
    while True:
        try:
            events = valkey_reader.get_websocket_events()
            
            if events and sse_manager.user_queues:
                broadcast_count = 0
                for event in reversed(events[:5]):
                    try:
                        target_username = None
                        data = event.get("data") if isinstance(event, dict) else None
                        if isinstance(data, dict):
                            if isinstance(data.get("user_id"), str):
                                target_username = data.get("user_id")
                            elif isinstance(data.get("username"), str):
                                target_username = data.get("username")
                        message = json.dumps(event, ensure_ascii=False)
                        if target_username:
                            await sse_manager.broadcast_to_user(message, target_username)
                        else:
                            for uname in list(sse_manager.user_queues.keys()):
                                await sse_manager.broadcast_to_user(message, uname)
                        logger.info(f"이벤트 브로드캐스트: {event.get('type', 'unknown')} - {event.get('trace_id', 'unknown')} -> {target_username or 'ALL'}")
                        broadcast_count += 1
                    except Exception as e:
                        logger.error(f"브로드캐스트 처리 오류: {e}")

                if broadcast_count > 0:
                    for _ in range(broadcast_count):
                        valkey_reader.valkey_client.rpop('websocket_events')
            
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"이벤트 브로드캐스트 오류: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    uvicorn.run(
        "sse:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    ) 
    