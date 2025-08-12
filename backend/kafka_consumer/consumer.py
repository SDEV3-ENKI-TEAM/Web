import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict

import redis
from kafka import KafkaConsumer
from pymongo import MongoClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))

class TraceConsumer:
    """Kafka에서 Trace 데이터를 수신하여 Valkey에 저장하는 Consumer"""
    
    def __init__(self, kafka_broker: str = "localhost:9092", 
                 kafka_topic: str = "traces",
                 valkey_host: str = "localhost", 
                 valkey_port: int = 6379,
                 valkey_db: int = 0,
                 mongo_uri: str = "mongodb://localhost:27017",
                 mongo_db: str = "security",
                 mongo_collection: str = "rules"):
        self.kafka_broker = kafka_broker
        self.kafka_topic = kafka_topic
        self.valkey_host = valkey_host
        self.valkey_port = valkey_port
        self.valkey_db = valkey_db
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db
        self.mongo_collection = mongo_collection
        
        self.consumer = None
        self.valkey_client = None
        self.mongo_client = None
        self.mongo_db_client = None
        self.mongo_collection_client = None
        
    def init_kafka_consumer(self) -> bool:
        """Kafka Consumer 초기화"""
        try:
            self.consumer = KafkaConsumer(
                self.kafka_topic,
                bootstrap_servers=[self.kafka_broker],
                auto_offset_reset='latest',
                enable_auto_commit=True,
                group_id='trace_consumer_group',
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                consumer_timeout_ms=1000
            )
            logger.info(f"Kafka Consumer 초기화 완료: {self.kafka_broker} -> {self.kafka_topic}")
            return True
        except Exception as e:
            logger.error(f"Kafka Consumer 초기화 실패: {e}")
            return False
    
    def init_valkey_client(self) -> bool:
        """Valkey 클라이언트 초기화"""
        try:
            self.valkey_client = redis.Redis(
                host=self.valkey_host,
                port=self.valkey_port,
                db=self.valkey_db,
                decode_responses=True
            )
            self.valkey_client.ping()
            logger.info(f"Valkey 클라이언트 초기화 완료: {self.valkey_host}:{self.valkey_port}")
            return True
        except Exception as e:
            logger.error(f"Valkey 클라이언트 초기화 실패: {e}")
            return False
    
    def init_mongo_client(self) -> bool:
        """MongoDB 클라이언트 초기화"""
        try:
            self.mongo_client = MongoClient(self.mongo_uri)
            self.mongo_db_client = self.mongo_client[self.mongo_db]
            self.mongo_collection_client = self.mongo_db_client[self.mongo_collection]

            self.mongo_client.admin.command('ping')
            logger.info(f"MongoDB 클라이언트 초기화 완료: {self.mongo_uri}")
            return True
        except Exception as e:
            logger.error(f"MongoDB 클라이언트 초기화 실패: {e}")
            return False
    
    def process_trace(self, trace_data: Dict[str, Any]) -> bool:
        """완성된 Trace 데이터를 처리하고 Valkey에 저장"""
        try:
            trace_id = trace_data.get('trace_id')
            detected_at = trace_data.get('detected_at')
            summary = trace_data.get('summary')
            
            if not trace_id or not detected_at or not summary:
                logger.warning(f"필수 필드 누락된 Trace: {trace_id}")
                return False

            if not isinstance(trace_id, str):
                logger.warning(f"trace_id가 문자열이 아님: {type(trace_id)} - {trace_id}")
                return False
            
            trace_id = trace_data['trace_id']
            spans = trace_data.get('spans', [])
            
            # sigma 매칭된 span 개수 계산
            matched_span_count = 0
            for span in spans:
                tags = span.get('tags', [])
                for tag in tags:
                    if tag.get('key') == 'sigma.alert':
                        matched_span_count += 1
                        break  # 한 span에서 하나의 sigma.alert만 카운트
 
            existing_data = self.valkey_client.get(f"trace:{trace_id}")
            is_update = False
            baseline_only = False
            
            if existing_data:
                existing = json.loads(existing_data)
                existing_matched_span_count = existing.get('matched_span_count', 0)
                
                if matched_span_count > existing_matched_span_count:
                    is_update = True
                    logger.info(f"Trace 업데이트: {trace_id} (sigma 매칭 span: {existing_matched_span_count} → {matched_span_count}개)")
                elif matched_span_count == existing_matched_span_count:
                    baseline_only = True
                else:
                    baseline_only = True
            else:
                logger.info(f"새로운 Trace: {trace_id} (sigma 매칭 span: {matched_span_count}개)")
            
            alarm_card = self.create_alarm_card(trace_data, matched_span_count)

            trace_key = f"trace:{trace_id}"

            # 항상 기준선은 최신 관측값으로 갱신
            self.valkey_client.set(trace_key, json.dumps(alarm_card, ensure_ascii=False))
            self.valkey_client.expire(trace_key, 86400)

            alarm_key = "recent_alarms"
            
            # trace_id 기반으로 기존 항목 제거
            existing_alarms = self.valkey_client.lrange(alarm_key, 0, -1)
            for existing_alarm_str in existing_alarms:
                try:
                    existing_alarm = json.loads(existing_alarm_str)
                    if existing_alarm.get('trace_id') == trace_id:
                        # 같은 trace_id 발견, 제거
                        self.valkey_client.lrem(alarm_key, 0, existing_alarm_str)
                except json.JSONDecodeError:
                    continue
            
            # 새로운 알람 추가
                self.valkey_client.lpush(alarm_key, json.dumps(alarm_card, ensure_ascii=False))
            self.valkey_client.ltrim(alarm_key, 0, 99)  # 최대 100개 유지

            # 웹소켓 이벤트는 신규/증가에만 발행
            if not existing_data or is_update:
                event_type = "trace_update" if is_update else "new_trace"
                event_data = {
                    "type": event_type,
                    "trace_id": trace_id,
                    "data": alarm_card,
                    "timestamp": int(time.time() * 1000)
                }

                event_key = "websocket_events"
                self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
                self.valkey_client.ltrim(event_key, 0, 999)
            
            logger.info(f"Trace 저장 완료: {trace_id} - {alarm_card['summary']}")
            return True
            
        except Exception as e:
            logger.error(f"Trace 처리 실패: {e}")
            return False
    
    def create_alarm_card(self, trace_data: Dict[str, Any], matched_span_count: int) -> Dict[str, Any]:
        """Trace 데이터를 UI 카드 형태로 변환"""
        try:
            trace_id = trace_data['trace_id']
            spans = trace_data.get('spans', [])

            first_span = spans[0] if spans else {}
            operation_name = first_span.get('operationName', '')

            host = "unknown"
            os_type = "windows"
            user_id = None  # 사용자 ID 추출
            
            for span in spans:
                tags = span.get('tags', [])
                for tag in tags:
                    if tag.get('key') == 'ComputerName':
                        host = tag.get('value', 'unknown')
                    elif tag.get('key') == 'User':
                        host = tag.get('value', host)
                    elif tag.get('key') == 'Product':
                        os_type = tag.get('value', os_type)
                    elif tag.get('key') == 'user_id':  # 사용자 ID 태그 추출
                        user_id = tag.get('value')
                if host != "unknown" and user_id is not None:
                    break

            # user_id가 없으면 기본값 설정 (임시 해결책)
            if user_id is None:
                user_id = "default_user"

            if not host or host == "unknown":
                host = "unknown"
            if not os_type:
                os_type = "windows"

            sigma_alert_ids = set()
            has_error = False
            matched_span_count = 0  # 룰 매칭된 span 개수
            
            for span in spans:
                tags = span.get('tags', [])
                span_has_alert = False
                for tag in tags:
                    if tag.get('key') == 'sigma.alert':
                        sigma_alert_ids.add(tag.get('value', ''))
                        span_has_alert = True
                    elif tag.get('key') == 'error' and tag.get('value') == True:
                        has_error = True
                
                if span_has_alert:
                    matched_span_count += 1

            if not sigma_alert_ids:
                return False

            severity_scores = []
            matched_rules = []
            sigma_alert = ""
            
            if sigma_alert_ids:
                for sigma_id in sigma_alert_ids:
                    if not sigma_alert:
                        sigma_alert = sigma_id
                    
                    try:
                        rule_info = self.mongo_collection_client.find_one({"sigma_id": sigma_id})
                        if rule_info:
                            severity_score = rule_info.get('severity_score', 30)
                            level = rule_info.get('level', 'low')
                            title = rule_info.get('title', '')
                            
                            severity_scores.append(severity_score)
                            matched_rules.append({
                                "sigma_id": sigma_id,
                                "level": level,
                                "severity_score": severity_score,
                                "title": title
                            })
                            logger.info("MongoDB에서 severity_score 조회: {sigma_id} -> {severity_score}")
                        else:
                            severity_scores.append(90)
                            matched_rules.append({
                                "sigma_id": sigma_id,
                                "level": "high",
                                "severity_score": 90,
                                "title": sigma_id
                            })
                            logger.warning(f"MongoDB에서 rule을 찾을 수 없음: {sigma_id}")
                    except Exception as e:
                        logger.warning(f"MongoDB 조회 실패 ({sigma_id}): {e}")
                        severity_scores.append(90)
                        matched_rules.append({
                            "sigma_id": sigma_id,
                            "level": "high",
                            "severity_score": 90,
                            "title": sigma_id
                        })

                if severity_scores:
                    avg_severity_score = sum(severity_scores) / len(severity_scores)
                else:
                    avg_severity_score = 30
            else:
                if any(span.get('tag', {}).get('error', False) for span in spans):
                    avg_severity_score = 60
                    severity = "medium"
                else:
                    avg_severity_score = 30
                    severity = "low"
                matched_rules = []
            
            if avg_severity_score >= 90:
                severity = "critical"
            elif avg_severity_score >= 80:
                severity = "high"
            elif avg_severity_score > 60:
                severity = "medium"
            else:
                severity = "low"
            
            summary = operation_name if operation_name else "Unknown Process"

            ai_summary = "테스트 요약"

            sigma_rule_title = ""
            if matched_rules:
                sigma_rule_title = matched_rules[0].get('title', '')

            current_time_ms = int(time.time() * 1000)
            detected_at_str = self._timestamp_to_korea_time(current_time_ms)

            existing_data = self.valkey_client.get(f"trace:{trace_id}")
            if existing_data:
                try:
                    existing = json.loads(existing_data)
                    existing_detected_at = existing.get('detected_at', '')
                    if existing_detected_at:
                        detected_at_str = existing_detected_at
                except:
                    pass

            alarm_card = {
                "trace_id": trace_id or "unknown",
                "detected_at": detected_at_str or datetime.now().strftime('%Y-%m-%dT%H:%M:%S'),
                "summary": summary or "Unknown Process",
                "host": host or "unknown",
                "os": os_type or "windows",
                "checked": False,
                "sigma_alert": sigma_alert or "",
                "matched_span_count": matched_span_count,  # sigma 매칭 span 개수
                "ai_summary": ai_summary or "테스트 요약",
                "severity": severity or "low",
                "severity_score": avg_severity_score or 30,
                "sigma_rule_title": sigma_rule_title if sigma_rule_title else (summary or "Unknown Process"),
                "matched_rules": matched_rules or [],
                "user_id": user_id
            }
            
            return alarm_card
            
        except Exception as e:
            logger.error(f"알람 카드 생성 실패: {e}")
            return trace_data 
    
    def _timestamp_to_korea_time(self, timestamp_ms: int) -> str:
        """timestamp를 한국 시간 문자열로 변환"""
        try:
            utc_dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
            korea_tz = timezone(timedelta(hours=9))
            korea_dt = utc_dt.astimezone(korea_tz)
            return korea_dt.strftime('%Y-%m-%dT%H:%M:%S')
        except Exception as e:
            logger.error(f"시간 변환 실패: {e}")
            return datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    
    def run(self):
        """Consumer 실행"""
        logger.info("Trace Consumer 시작")

        if not self.init_kafka_consumer():
            logger.error("Kafka Consumer 초기화 실패")
            return
        
        if not self.init_valkey_client():
            logger.error("Valkey 클라이언트 초기화 실패")
            return
        
        if not self.init_mongo_client():
            logger.error("MongoDB 클라이언트 초기화 실패")
            return
        
        try:
            logger.info("메시지 수신 대기 중...")
            
            while True:
                try:
                    message_batch = self.consumer.poll(timeout_ms=1000)
                    
                    for tp, messages in message_batch.items():
                        for message in messages:
                            try:
                                trace_data = message.value
                                trace_id = trace_data.get('trace_id', 'unknown')
                                logger.info(f"메시지 수신: {trace_id}")

                                if self.process_trace(trace_data):
                                    logger.info(f"Trace 처리 완료: {trace_id}")
                                else:
                                    logger.warning(f"Trace 처리 실패: {trace_id}")
                                    
                            except Exception as e:
                                logger.error(f"메시지 처리 중 오류: {e}")
                                
                except Exception as e:
                    logger.error(f"Consumer 실행 중 오류: {e}")
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            logger.info("Consumer 종료 요청")
        finally:
            if self.consumer:
                self.consumer.close()
            if self.valkey_client:
                self.valkey_client.close()
            if self.mongo_client:
                self.mongo_client.close()
            logger.info("Consumer 종료")

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Kafka Trace Consumer')
    parser.add_argument('--kafka-broker', default='localhost:9092', help='Kafka 브로커 주소')
    parser.add_argument('--kafka-topic', default='traces', help='Kafka 토픽명')
    parser.add_argument('--valkey-host', default='localhost', help='Valkey 호스트')
    parser.add_argument('--valkey-port', type=int, default=6379, help='Valkey 포트')
    parser.add_argument('--valkey-db', type=int, default=0, help='Valkey 데이터베이스')
    
    args = parser.parse_args()

    consumer = TraceConsumer(
        kafka_broker=args.kafka_broker,
        kafka_topic=args.kafka_topic,
        valkey_host=args.valkey_host,
        valkey_port=args.valkey_port,
        valkey_db=args.valkey_db
    )
    
    consumer.run()

if __name__ == "__main__":
    main() 