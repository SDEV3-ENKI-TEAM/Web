#!/usr/bin/env python3
"""
실시간 알람 WebSocket 서버
Valkey에서 WebSocket 이벤트를 읽어서 프론트엔드로 실시간 전송
"""

import json
import logging
import asyncio
import time
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis
import uvicorn

# ─── 로깅 설정 ───────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class WebSocketManager:
    """WebSocket 연결 관리"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        """새로운 WebSocket 연결 추가"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🔗 새로운 WebSocket 연결: {len(self.active_connections)}개")
    
    def disconnect(self, websocket: WebSocket):
        """WebSocket 연결 제거"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"🔌 WebSocket 연결 해제: {len(self.active_connections)}개")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """개별 클라이언트에게 메시지 전송"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"❌ 메시지 전송 실패: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        """모든 연결된 클라이언트에게 메시지 브로드캐스트"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"❌ 브로드캐스트 실패: {e}")
                disconnected.append(connection)
        
        # 연결이 끊어진 클라이언트 제거
        for connection in disconnected:
            self.disconnect(connection)

class ValkeyEventReader:
    """Valkey에서 WebSocket 이벤트를 읽는 클래스"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
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
    
    def get_recent_alarms(self, limit: int = 10) -> List[Dict[str, Any]]:
        """최근 알람 데이터 조회"""
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
        except Exception as e:
            logger.error(f"Valkey 알람 조회 실패: {e}")
            return []

app = FastAPI(title="실시간 알람 WebSocket 서버", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WebSocketManager()
valkey_reader = ValkeyEventReader()

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
            "active_websockets": len(manager.active_connections)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/api/alarms/recent")
async def get_recent_alarms(limit: int = 10):
    """최근 알람 데이터 조회 (REST API)"""
    alarms = valkey_reader.get_recent_alarms(limit)
    return {
        "alarms": alarms,
        "count": len(alarms)
    }

@app.websocket("/ws/alarms")
async def websocket_endpoint(websocket: WebSocket, limit: int = 50):
    """실시간 알람 WebSocket 엔드포인트"""
    await manager.connect(websocket)
    
    try:
        recent_alarms = valkey_reader.get_recent_alarms(limit)
        if recent_alarms:
            initial_message = {
                "type": "initial_data",
                "alarms": recent_alarms,
                "timestamp": int(time.time() * 1000)
            }
            await manager.send_personal_message(
                json.dumps(initial_message, ensure_ascii=False),
                websocket
            )
            logger.info(f"초기 데이터 전송: {len(recent_alarms)}개 알람")
        
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await manager.send_personal_message("pong", websocket)
            except WebSocketDisconnect:
                logger.info("클라이언트 연결 해제")
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
    """Valkey 이벤트를 WebSocket으로 브로드캐스트"""
    while True:
        try:
            events = valkey_reader.get_websocket_events()
            
            if events and manager.active_connections:
                broadcast_count = 0
                for event in reversed(events[:5]):
                    message = json.dumps(event, ensure_ascii=False)
                    await manager.broadcast(message)
                    logger.info(f"📡 이벤트 브로드캐스트: {event.get('type', 'unknown')} - {event.get('trace_id', 'unknown')}")
                    broadcast_count += 1

                if broadcast_count > 0:
                    for _ in range(broadcast_count):
                        valkey_reader.valkey_client.rpop('websocket_events')
                    logger.debug(f"{broadcast_count}개 이벤트 큐에서 제거")
            
            # 1초 대기
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"이벤트 브로드캐스트 오류: {e}")
            await asyncio.sleep(5)  # 오류 시 5초 대기

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 이벤트 브로드캐스트 태스크 시작"""
    asyncio.create_task(broadcast_events())
    logger.info("WebSocket 서버 시작")

if __name__ == "__main__":
    uvicorn.run(
        "websocket_server:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    ) 