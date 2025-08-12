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
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

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

class WebSocketManager:
    """WebSocket 연결 관리 (사용자별 분리)"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.connection_info: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, user_info: Dict):
        """새로운 WebSocket 연결 추가 (사용자별 분리)"""
        await websocket.accept()
        user_id = str(user_info["user_id"])
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        self.connection_info[websocket] = user_info
        
        logger.info(f"새로운 WebSocket 연결: 사용자 {user_info['username']} (총 연결 수: {len(self.active_connections[user_id])})")
    
    def disconnect(self, websocket: WebSocket):
        """WebSocket 연결 제거"""
        user_info = self.connection_info.get(websocket)
        if user_info:
            user_id = str(user_info["user_id"])
            if user_id in self.active_connections and websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                logger.info(f"WebSocket 연결 해제: 사용자 {user_info['username']} (남은 연결 수: {len(self.active_connections.get(user_id, []))})")
            
            del self.connection_info[websocket]
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """개별 클라이언트에게 메시지 전송"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"메시지 전송 실패: {e}")
            self.disconnect(websocket)
    
    async def broadcast_to_user(self, message: str, user_id: str):
        """특정 사용자에게만 메시지 브로드캐스트"""
        if user_id not in self.active_connections:
            return
        
        disconnected = []
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"사용자별 브로드캐스트 실패: {e}")
                disconnected.append(connection)
        
        for connection in disconnected:
            self.disconnect(connection)
    
    async def broadcast(self, message: str):
        """모든 연결된 클라이언트에게 메시지 브로드캐스트 (사용자별 분리)"""
        for user_id in list(self.active_connections.keys()):
            await self.broadcast_to_user(message, user_id)

class ValkeyEventReader:
    """Valkey에서 WebSocket 이벤트를 읽는 클래스 (사용자별 분리)"""
    
    def __init__(self, host: str = None, port: int = None, db: int = None):
        self.valkey_client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
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
    
    def get_recent_alarms(self, limit: int = 10, username: Optional[str] = None) -> List[Dict[str, Any]]:
        """최근 알람 데이터 조회 (trace:* 키 사용)"""
        try:
            # trace:* 패턴으로 모든 키 조회
            trace_keys = self.valkey_client.keys('trace:*')
            recent_alarms = []
            
            # 최신 순으로 정렬 (키 이름에 시간 정보가 있다면)
            trace_keys.sort(reverse=True)
            
            for trace_key in trace_keys[:limit]:
                try:
                    trace_data = self.valkey_client.get(trace_key)
                    if trace_data:
                        alarm = json.loads(trace_data)
                        alarm_user_id = alarm.get('user_id')
                        
                        # 사용자별 필터링 (username과 user_id 비교)
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 생명주기 관리"""
    # 시작 시
    asyncio.create_task(broadcast_events())
    logger.info("WebSocket 서버 시작")
    yield
    # 종료 시
    logger.info("WebSocket 서버 종료")

app = FastAPI(title="실시간 알람 WebSocket 서버", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WebSocketManager()
valkey_reader = ValkeyEventReader(
    host=os.getenv("VALKEY_HOST"),
    port=int(os.getenv("VALKEY_PORT")),
    db=int(os.getenv("VALKEY_DB", "0"))
)

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "실시간 알람 WebSocket 서버",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/api/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    try:
        # Valkey 연결 테스트
        valkey_reader.valkey_client.ping()
        return {
            "status": "healthy",
            "valkey_connection": "connected",
            "active_websockets": sum(len(connections) for connections in manager.active_connections.values())
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

@app.websocket("/ws/alarms")
async def websocket_endpoint(websocket: WebSocket, limit: int = 50):
    """실시간 알람 WebSocket 엔드포인트 (JWT 인증 필요)"""
    try:
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4001, reason="JWT 토큰이 필요합니다")
            return
        
        user_info = verify_jwt_token(token)
        if not user_info:
            await websocket.close(code=4002, reason="JWT 토큰이 유효하지 않습니다")
            return
        
        await manager.connect(websocket, user_info)
        
        # 사용자별 초기 데이터 전송 (username 사용)
        username = user_info["username"]
        recent_alarms = valkey_reader.get_recent_alarms(limit, username)
        if recent_alarms:
            initial_message = {
                "type": "initial_data",
                "alarms": recent_alarms,
                "timestamp": int(time.time() * 1000),
                "user_id": user_info["user_id"]
            }
            await manager.send_personal_message(
                json.dumps(initial_message, ensure_ascii=False),
                websocket
            )
            logger.info(f"초기 데이터 전송: 사용자 {user_info['username']} - {len(recent_alarms)}개 알람")
        
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await manager.send_personal_message("pong", websocket)
            except WebSocketDisconnect:
                logger.info(f"클라이언트 연결 해제: 사용자 {user_info['username']}")
                break
            except Exception as e:
                logger.error(f"WebSocket 수신 오류: {e}")
                break
            
            await asyncio.sleep(0.1)
    
    except Exception as e:
        logger.error(f"WebSocket 처리 오류: {e}")
    finally:
        manager.disconnect(websocket)

async def broadcast_events():
    """Valkey 이벤트를 WebSocket으로 브로드캐스트 (사용자별 분리)"""
    while True:
        try:
            events = valkey_reader.get_websocket_events()
            
            if events and manager.active_connections:
                broadcast_count = 0
                for event in reversed(events[:5]):
                    for user_id in list(manager.active_connections.keys()):
                        message = json.dumps(event, ensure_ascii=False)
                        await manager.broadcast_to_user(message, user_id)
                        logger.info(f"사용자별 이벤트 브로드캐스트: 사용자 {user_id} - {event.get('type', 'unknown')} - {event.get('trace_id', 'unknown')}")
                    
                    broadcast_count += 1

                if broadcast_count > 0:
                    for _ in range(broadcast_count):
                        valkey_reader.valkey_client.rpop('websocket_events')
            
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"이벤트 브로드캐스트 오류: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    uvicorn.run(
        "websocket_server:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    ) 