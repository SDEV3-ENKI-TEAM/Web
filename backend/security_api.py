import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from auth.auth_api import router as auth_router
from auth.auth_deps import get_current_user_with_roles
from utils.opensearch_analyzer import OpenSearchAnalyzer
from api.traces import router as traces_router
from api.alarms import router as alarms_router
from api.metrics import router as metrics_router
from api.sigma import router as sigma_router

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(traces_router, prefix=API_PREFIX)
app.include_router(alarms_router, prefix=API_PREFIX)
app.include_router(metrics_router, prefix=API_PREFIX)
app.include_router(sigma_router, prefix=API_PREFIX)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003) 