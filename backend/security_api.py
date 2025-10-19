import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import StreamingResponse
import redis
import asyncio
import json
import time

from api.auth import router as auth_router
from utils.opensearch_analyzer import OpenSearchAnalyzer
from api.traces import router as traces_router
from api.alarms import router as alarms_router
from api.metrics import router as metrics_router
from api.sigma import router as sigma_router
from api.settings import router as settings_router
from api.llm_analysis import router as llm_analysis_router

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

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION")

mongo_client = None
mongo_collection = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, mongo_collection
    try:
        if MONGO_URI:
            mongo_client = MongoClient(MONGO_URI)
            if MONGO_DB and MONGO_COLLECTION:
                mongo_collection = mongo_client[MONGO_DB][MONGO_COLLECTION]
        app.state.mongo_client = mongo_client
        app.state.mongo_collection = mongo_collection
        app.state.opensearch = OpenSearchAnalyzer()
        try:
            try:
                from database.database import Base, engine
            except Exception:
                from database.database import Base, engine
            Base.metadata.create_all(bind=engine)
            logger.info("MySQL tables ensured via Base.metadata.create_all().")
        except Exception as e:
            logger.warning(f"MySQL table ensure failed or skipped: {e}")
        try:
            vh = os.getenv("VALKEY_HOST")
            vp = int(os.getenv("VALKEY_PORT"))
            vdb = int(os.getenv("VALKEY_DB"))
            app.state.valkey = redis.Redis(host=vh, port=vp, db=vdb, decode_responses=True)
            try:
                _ = app.state.valkey.ping()
            except Exception:
                app.state.valkey = None
        except Exception:
            app.state.valkey = None

        try:
            import threading
            def _warm_background():
                try:
                    import requests
                    requests.post("http://localhost:8003/api/alarms/warm-cache", timeout=5)
                except Exception:
                    pass
            vk = getattr(app.state, "valkey", None)
            if vk:
                try:
                    keys = vk.keys("trace:*")
                    if not keys:
                        threading.Thread(target=_warm_background, daemon=True).start()
                except Exception:
                    threading.Thread(target=_warm_background, daemon=True).start()
        except Exception:
            pass
        yield
    finally:
        try:
            if mongo_client:
                mongo_client.close()
        except Exception:
            pass

app = FastAPI(lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

API_PREFIX = "/api"

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(traces_router, prefix=API_PREFIX)
app.include_router(alarms_router, prefix=API_PREFIX)
app.include_router(metrics_router, prefix=API_PREFIX)
app.include_router(sigma_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)
app.include_router(llm_analysis_router, prefix=API_PREFIX)

# Dashboard stats endpoint
from utils.auth_deps import get_current_user_with_roles
from utils.jwt_utils import verify_token

@app.get(f"{API_PREFIX}/dashboard-stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user_with_roles)):
    """대시보드 통계 정보 조회"""
    try:
        from database.database import SessionLocal, LLMAnalysis
        from sqlalchemy import or_, func
        
        db = SessionLocal()
        try:
            uid = current_user.get("id")
            uname = current_user.get("username")
            
            # 사용자별 필터링
            q = db.query(LLMAnalysis)
            filters = []
            if uid is not None:
                filters.append(LLMAnalysis.user_id == str(uid))
            if uname:
                filters.append(LLMAnalysis.user_id == uname)
            if filters:
                q = q.filter(or_(*filters))
            
            # 전체 이벤트 수
            total_events = q.count()
            
            # 이상 징후 수 (malicious)
            anomalies = q.filter(LLMAnalysis.prediction == "malicious").count()
            
            # 미확인 수
            unchecked_count = q.filter(LLMAnalysis.prediction == None).count()
            
            # 평균 이상 징후 비율
            avg_anomaly = round((anomalies / total_events) * 100, 1) if total_events > 0 else 0.0
            
            # 가장 높은 점수 (score 필드 사용)
            try:
                max_score_query = q.with_entities(func.max(LLMAnalysis.score))
                max_score = max_score_query.scalar()
                highest_score = float(max_score) if max_score is not None else 0.0
            except:
                highest_score = 0.0
            
            return {
                "totalEvents": total_events,
                "anomalies": anomalies,
                "avgAnomaly": avg_anomaly,
                "highestScore": highest_score,
                "uncheckedCount": unchecked_count
            }
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running."}

# SSE Manager for real-time alarms
class SSEManager:
    """SSE 연결 관리"""
    def __init__(self):
        self.user_queues: dict = {}

    def connect(self, user_id: str) -> asyncio.Queue:
        queue = asyncio.Queue()
        self.user_queues.setdefault(user_id, []).append(queue)
        logger.info(f"새로운 SSE 연결: 사용자 {user_id}")
        return queue

    def disconnect(self, user_id: str, queue: asyncio.Queue):
        queues = self.user_queues.get(user_id)
        if queues:
            try:
                queues.remove(queue)
            except ValueError:
                pass
            if not queues:
                del self.user_queues[user_id]
        logger.info(f"SSE 연결 해제: 사용자 {user_id}")

sse_manager = SSEManager()

def get_recent_alarms_from_valkey(valkey_client, limit: int, username: str):
    """Valkey에서 최근 알람 조회"""
    try:
        trace_keys = valkey_client.keys('trace:*')
        recent_alarms = []
        
        trace_keys.sort(reverse=True)
        
        for trace_key in trace_keys[:limit * 2]:  # 필터링을 고려해 더 많이 조회
            try:
                trace_data = valkey_client.get(trace_key)
                if not trace_data:
                    continue
                alarm = json.loads(trace_data)
                if not isinstance(alarm, dict):
                    continue
                
                alarm_user_id = alarm.get('user_id')
                if username and str(alarm_user_id) != str(username):
                    continue
                    
                recent_alarms.append(alarm)
                
                if len(recent_alarms) >= limit:
                    break
                    
            except json.JSONDecodeError:
                continue
        
        return recent_alarms
    except Exception as e:
        logger.error(f"Valkey trace 조회 실패: {e}")
        return []

@app.get(f"{API_PREFIX}/sse/alarms")
async def sse_alarms(request: Request, limit: int = 50):
    """SSE 알람 스트림"""
    try:
        # 쿠키에서 access_token 확인
        cookies = request.cookies
        access_token = cookies.get("access_token")
        
        # Authorization 헤더 확인
        if not access_token:
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.lower().startswith("bearer "):
                access_token = auth_header.split(" ", 1)[1].strip()
        
        if not access_token:
            return JSONResponse(
                status_code=401,
                content={"error": "인증 토큰이 필요합니다"}
            )
        
        # 토큰 검증
        user_info = verify_token(access_token)
        if not user_info:
            return JSONResponse(
                status_code=401,
                content={"error": "유효하지 않은 토큰"}
            )
        
        username = str(user_info.get("username"))
        
        # Valkey 클라이언트 가져오기
        valkey_client = getattr(app.state, "valkey", None)
        if not valkey_client:
            return JSONResponse(
                status_code=503,
                content={"error": "Valkey 연결 실패"}
            )
        
        # 초기 데이터 로드
        recent_alarms = get_recent_alarms_from_valkey(valkey_client, limit, username)
        initial_message = {
            "type": "initial_data",
            "alarms": recent_alarms or [],
            "timestamp": int(time.time() * 1000),
            "user_id": user_info.get("user_id")
        }
        
        async def event_generator():
            queue = sse_manager.connect(username)
            try:
                # 초기 데이터 전송
                yield f"data: {json.dumps(initial_message, ensure_ascii=False)}\n\n"
                
                # 실시간 이벤트 스트리밍
                while True:
                    try:
                        message = await asyncio.wait_for(queue.get(), timeout=15)
                        yield f"data: {message}\n\n"
                    except asyncio.TimeoutError:
                        # Heartbeat
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
        return JSONResponse(
            status_code=500,
            content={"error": "내부 서버 오류"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 