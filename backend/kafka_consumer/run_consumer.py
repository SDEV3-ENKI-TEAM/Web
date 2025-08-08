import logging
import sys
from pathlib import Path

from kafka_consumer.consumer import TraceConsumer

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def main():
    """Consumer 실행"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Kafka Trace Consumer 실행')
    parser.add_argument('--kafka-broker', default='localhost:9092', help='Kafka 브로커 주소')
    parser.add_argument('--kafka-topic', default='traces', help='Kafka 토픽명')
    parser.add_argument('--valkey-host', default='localhost', help='Valkey 호스트')
    parser.add_argument('--valkey-port', type=int, default=6379, help='Valkey 포트')
    parser.add_argument('--valkey-db', type=int, default=0, help='Valkey 데이터베이스')
    parser.add_argument('--log-level', default='INFO', help='로그 레벨')
    
    args = parser.parse_args()
    
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    logger.info("Kafka Consumer 시작")
    logger.info(f"설정:")
    logger.info(f"  - Kafka: {args.kafka_broker} -> {args.kafka_topic}")
    logger.info(f"  - Valkey: {args.valkey_host}:{args.valkey_port}")
    
    consumer = TraceConsumer(
        kafka_broker=args.kafka_broker,
        kafka_topic=args.kafka_topic,
        valkey_host=args.valkey_host,
        valkey_port=args.valkey_port,
        valkey_db=args.valkey_db
    )
    
    try:
        consumer.run()
    except KeyboardInterrupt:
        logger.info("사용자에 의해 종료됨")
    except Exception as e:
        logger.error(f"Consumer 실행 중 오류: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 