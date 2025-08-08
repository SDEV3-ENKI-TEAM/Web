import json
import logging
import time
from typing import Any, Dict, List

import requests
from kafka import KafkaProducer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class JaegerKafkaBridge:
    """Jaeger에서 Trace 데이터를 수집하여 Kafka로 전송하는 브리지"""
    
    def __init__(self, 
                 jaeger_url: str = "http://3.36.80.36:16686",
                 kafka_broker: str = "localhost:9092",
                 kafka_topic: str = "traces",
                 poll_interval: int = 2,
                 valkey_host: str = "localhost",
                 valkey_port: int = 6379,
                 valkey_db: int = 0):
        self.jaeger_url = jaeger_url
        self.kafka_broker = kafka_broker
        self.kafka_topic = kafka_topic
        self.poll_interval = poll_interval
        self.valkey_host = valkey_host
        self.valkey_port = valkey_port
        self.valkey_db = valkey_db
        
        self.producer = None
        self.valkey_client = None
        
    def init_kafka_producer(self) -> bool:
        """Kafka Producer 초기화"""
        try:
            self.producer = KafkaProducer(
                bootstrap_servers=[self.kafka_broker],
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3
            )
            logger.info(f"Kafka Producer 초기화 완료: {self.kafka_broker}")
            return True
        except Exception as e:
            logger.error(f"Kafka Producer 초기화 실패: {e}")
            return False
    
    def init_valkey_client(self) -> bool:
        """Valkey 클라이언트 초기화"""
        try:
            import redis
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
    
    def get_jaeger_traces(self) -> List[Dict[str, Any]]:
        """Jaeger에서 최근 Trace 데이터 조회"""
        try:
            url = f"{self.jaeger_url}/api/traces"
            params = {
                'service': 'sysmon-agent',
                'start': int((time.time() - 2 * 24 * 3600) * 1000000),  # 2일 전
                'end': int((time.time() + 60) * 1000000),
                'limit': 100,
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            traces = data.get('data', [])
            
            logger.info(f"Jaeger에서 {len(traces)}개 Trace 조회")
            return traces
            
        except Exception as e:
            logger.error(f"Jaeger 조회 실패: {e}")
            return []
    
    def trace_to_kafka_message(self, trace: Dict[str, Any]) -> Dict[str, Any]:
        """Trace 데이터를 Kafka 메시지로 변환"""
        try:
            trace_id = trace.get('traceID', '')
            spans = trace.get('spans', [])
            
            if not trace_id or not spans:
                return None
            
            has_sigma_alert = False
            sigma_alert_value = ""
            for span in spans:
                tags = span.get('tags', [])
                for tag in tags:
                    if tag.get('key') == 'sigma.alert':
                        has_sigma_alert = True
                        sigma_alert_value = tag.get('value', '')
                        break
                if has_sigma_alert:
                    break
            
            if not has_sigma_alert:
                return None
            
            first_span = spans[0]
            operation_name = first_span.get('operationName', '')
            
            host = "unknown"
            os_type = "windows"
            user_id = None
            
            for span in spans:
                tags = span.get('tags', [])
                for tag in tags:
                    if tag.get('key') == 'ComputerName':
                        host = tag.get('value', 'unknown')
                    elif tag.get('key') == 'User':
                        host = tag.get('value', host)
                    elif tag.get('key') == 'Product':
                        os_type = tag.get('value', os_type)
                    elif tag.get('key') == 'user_id':
                        user_id = tag.get('value')
                if host != "unknown" and user_id is not None:
                    break
            
            # user_id가 없으면 기본값 설정 (임시 해결책)
            if user_id is None:
                user_id = "default_user"
            
            detected_at = int(time.time() * 1000)
            
            alarm_data = {
                "trace_id": trace_id,
                "detected_at": detected_at,
                "summary": f"{operation_name} - {len(spans)}개 이벤트",
                "span_count": len(spans),
                "host": host,
                "os": os_type,
                "checked": False,
                "sigma_alert": sigma_alert_value,
                "severity": "high",
                "severity_score": 90,
                "sigma_rule_title": sigma_alert_value,
                "spans": spans,
                "is_update": False,
                "previous_span_count": 0,
                "user_id": user_id
            }
            
            return alarm_data
            
        except Exception as e:
            logger.error(f"Trace 변환 실패: {e}")
            return None
    
    def send_to_kafka(self, alarm_data: Dict[str, Any]) -> bool:
        """Kafka로 알람 데이터 전송"""
        try:
            future = self.producer.send(self.kafka_topic, alarm_data)
            record_metadata = future.get(timeout=10)
            
            logger.info(f"Kafka 전송 완료: {alarm_data['trace_id']}")
            return True
            
        except Exception as e:
            logger.error(f"Kafka 전송 실패: {e}")
            return False
    
    def should_send_trace(self, trace_id: str, current_spans: List[Dict]) -> bool:
        """trace를 전송해야 하는지 확인 (sigma 매칭 span 개수 변화 감지)"""
        try:
            existing_trace_key = f"trace:{trace_id}"
            existing_data = self.valkey_client.get(existing_trace_key)
            
            if not existing_data:
                return True
            
            existing = json.loads(existing_data)
            existing_matched_span_count = existing.get('matched_span_count', 0)
            
            # 현재 sigma 매칭된 span 개수 계산
            current_matched_span_count = 0
            for span in current_spans:
                tags = span.get('tags', [])
                for tag in tags:
                    if tag.get('key') == 'sigma.alert':
                        current_matched_span_count += 1
                        break  # 한 span에서 하나의 sigma.alert만 카운트
            
            if current_matched_span_count != existing_matched_span_count:
                logger.info(f"Sigma 매칭 span 개수 변화 감지: {trace_id} ({existing_matched_span_count} → {current_matched_span_count})")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"업데이트 확인 실패: {e}")
            return True
    
    def run(self):
        """브리지 실행"""
        logger.info("Jaeger → Kafka Bridge 시작")
        
        if not self.init_kafka_producer():
            logger.error("Kafka Producer 초기화 실패")
            return
        
        if not self.init_valkey_client():
            logger.error("Valkey 클라이언트 초기화 실패")
            return
        
        try:
            logger.info(f"Jaeger 폴링 시작: {self.jaeger_url}")
            
            while True:
                try:
                    traces = self.get_jaeger_traces()
                    
                    new_traces_count = 0
                    
                    for trace in traces:
                        trace_id = trace.get('traceID', '')
                        
                        # 중복 체크
                        spans = trace.get('spans', [])
                        if not self.should_send_trace(trace_id, spans):
                            continue
                        
                        alarm_data = self.trace_to_kafka_message(trace)
                        
                        if alarm_data:
                            if self.send_to_kafka(alarm_data):
                                new_traces_count += 1
                                logger.info(f"새로운 Trace 전송: {trace_id}")
                            else:
                                logger.error(f"Trace 전송 실패: {trace_id}")
                        else:
                            logger.info(f"Trace 변환 실패 (sigma.alert 없음): {trace_id}")
                    
                    if new_traces_count > 0:
                        logger.info(f"새로운 Trace {new_traces_count}개 전송")
                    else:
                        logger.info("새로운 Trace 없음")

                    time.sleep(self.poll_interval)
                    
                except Exception as e:
                    logger.error(f"브리지 실행 중 오류: {e}")
                    time.sleep(5)
                    
        except KeyboardInterrupt:
            logger.info("브리지 종료 요청")
        finally:
            if self.producer:
                self.producer.close()
            if self.valkey_client:
                self.valkey_client.close()
            logger.info("브리지 종료")

def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Jaeger → Kafka Bridge')
    parser.add_argument('--jaeger-url', default='http://3.36.80.36:16686', help='Jaeger URL')
    parser.add_argument('--kafka-broker', default='localhost:9092', help='Kafka 브로커')
    parser.add_argument('--kafka-topic', default='traces', help='Kafka 토픽')
    parser.add_argument('--poll-interval', type=int, default=5, help='폴링 간격 (초)')
    
    args = parser.parse_args()
    
    bridge = JaegerKafkaBridge(
        jaeger_url=args.jaeger_url,
        kafka_broker=args.kafka_broker,
        kafka_topic=args.kafka_topic,
        poll_interval=args.poll_interval
    )
    
    bridge.run()

if __name__ == "__main__":
    main() 