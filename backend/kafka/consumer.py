import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict
import re

import redis
from kafka import KafkaConsumer
from pymongo import MongoClient

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


class TraceConsumer:
    """Kafka에서 Trace 데이터를 수신하여 Valkey에 저장하는 Consumer"""

    def __init__(
        self,
        kafka_broker: str = "localhost:9092",
        kafka_topic: str = "traces",
        valkey_host: str = "localhost",
        valkey_port: int = 6379,
        valkey_db: int = 0,
        mongo_uri: str = "mongodb://localhost:27017",
        mongo_db: str = "security",
        mongo_collection: str = "rules",
    ):
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

        self.mongo_collection_client = None

    def init_kafka_consumer(self) -> bool:
        """Kafka Consumer 초기화"""
        try:
            self.consumer = KafkaConsumer(
                bootstrap_servers=[self.kafka_broker],
                auto_offset_reset="latest",
                enable_auto_commit=True,
                group_id="trace_consumer_group",
                value_deserializer=lambda m: m,  # raw bytes, 토픽별로 파싱
                consumer_timeout_ms=1000,
            )
            # traces + ai-result-topic 동시 구독
            self.consumer.subscribe([self.kafka_topic, "ai-result-topic"])
            logger.info(
                f"Kafka Consumer 초기화 완료: {self.kafka_broker} -> subscribe {[self.kafka_topic, 'ai-result-topic']}"
            )
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
                decode_responses=True,
            )
            self.valkey_client.ping()
            logger.info(
                f"Valkey 클라이언트 초기화 완료: {self.valkey_host}:{self.valkey_port}"
            )
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

            self.mongo_client.admin.command("ping")
            logger.info(f"MongoDB 클라이언트 초기화 완료: {self.mongo_uri}")
            return True
        except Exception as e:
            logger.error(f"MongoDB 클라이언트 초기화 실패: {e}")
            return False

    def process_trace(self, trace_data: Dict[str, Any]) -> bool:
        """완성된 Trace 데이터를 처리하고 Valkey에 저장"""
        try:
            trace_id = trace_data.get("trace_id")
            detected_at = trace_data.get("detected_at")
            summary = trace_data.get("summary")

            if not trace_id or not detected_at or not summary:
                logger.warning(f"필수 필드 누락된 Trace: {trace_id}")
                return False

            if not isinstance(trace_id, str):
                logger.warning(
                    f"trace_id가 문자열이 아님: {type(trace_id)} - {trace_id}"
                )
                return False

            trace_id = trace_data["trace_id"]
            spans = trace_data.get("spans", [])
            trace_key = f"trace:{trace_id}"
            existing_data = self.valkey_client.get(trace_key)
            is_new_card = existing_data is None
            is_update = False

            alarm_card = self.create_alarm_card(trace_data, 0)
            if not alarm_card or not isinstance(alarm_card, dict):
                return True

            prev_count = 0
            prev_unique = 0
            if existing_data:
                try:
                    existing_card = json.loads(existing_data) if existing_data else {}
                    if isinstance(existing_card, dict):
                        prev_count = int(existing_card.get("matched_span_count", 0))
                        prev_unique = int(existing_card.get("matched_rule_unique_count", 0))
                except Exception:
                    prev_count = 0
                    prev_unique = 0

            try:
                curr_count = int(alarm_card.get("matched_span_count", 0))
            except Exception:
                curr_count = 0
            try:
                curr_unique = int(alarm_card.get("matched_rule_unique_count", 0))
            except Exception:
                curr_unique = 0

            # 감소 방지(보수적으로 이전값 유지)
            if curr_count < prev_count:
                alarm_card["matched_span_count"] = prev_count
                curr_count = prev_count
            if curr_unique < prev_unique:
                alarm_card["matched_rule_unique_count"] = prev_unique
                curr_unique = prev_unique

            is_update = (curr_count > prev_count) or (curr_unique > prev_unique)

            # AI 보류분(pending_ai) 병합
            try:
                pending_key = f"pending_ai:{trace_id}"
                pending_raw = self.valkey_client.get(pending_key)
                if pending_raw:
                    try:
                        pending = json.loads(pending_raw)
                    except Exception:
                        pending = {}
                    pending_reason = pending.get("reason")
                    pending_decision = pending.get("decision")
                    if pending_reason:
                        alarm_card["ai_summary"] = pending_reason
                        alarm_card["has_ai"] = True
                    if pending_decision:
                        alarm_card["ai_decision"] = pending_decision
                    try:
                        self.valkey_client.delete(pending_key)
                    except Exception:
                        pass
            except Exception as e:
                logger.warning(f"pending_ai 병합 실패: {e}")

            if is_new_card:
                logger.info(
                    f"새로운 Trace: {trace_id} (sigma 매칭 span: {alarm_card.get('matched_span_count', 0)}개)"
                )

            # 저장 및 최근 목록 반영
            self.valkey_client.set(
                trace_key, json.dumps(alarm_card, ensure_ascii=False)
            )
            self.valkey_client.expire(trace_key, 86400)

            alarm_key = "recent_alarms"

            existing_alarms = self.valkey_client.lrange(alarm_key, 0, -1)
            for existing_alarm_str in existing_alarms:
                try:
                    existing_alarm = json.loads(existing_alarm_str)
                    if (
                        isinstance(existing_alarm, dict)
                        and existing_alarm.get("trace_id") == trace_id
                    ):
                        self.valkey_client.lrem(alarm_key, 0, existing_alarm_str)
                except json.JSONDecodeError:
                    continue

            self.valkey_client.lpush(
                alarm_key, json.dumps(alarm_card, ensure_ascii=False)
            )
            self.valkey_client.ltrim(alarm_key, 0, 99)

            # 이벤트 전송: 최초 저장은 무조건 new_trace, 그 외에는 업데이트시에만 trace_update
            event_key = "websocket_events"
            if is_new_card:
                event_data = {
                    "type": "new_trace",
                    "trace_id": trace_id,
                    "data": alarm_card,
                    "timestamp": int(time.time() * 1000),
                }
                self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
                self.valkey_client.ltrim(event_key, 0, 999)
            elif is_update:
                event_data = {
                    "type": "trace_update",
                    "trace_id": trace_id,
                    "data": alarm_card,
                    "timestamp": int(time.time() * 1000),
                }
                self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
                self.valkey_client.ltrim(event_key, 0, 999)

            logger.info(f"Trace 저장 완료: {trace_id} - {alarm_card['summary']}")
            return True

        except Exception as e:
            logger.error(f"Trace 처리 실패: {e}")
            return False

    def create_alarm_card(
        self, trace_data: Dict[str, Any], matched_span_count: int
    ) -> Dict[str, Any]:
        """Trace 데이터를 UI 카드 형태로 변환"""
        try:
            trace_id = trace_data["trace_id"]
            spans = trace_data.get("spans", [])

            first_span = spans[0] if spans else {}
            operation_name = first_span.get("operationName", "")

            host = "unknown"
            os_type = "windows"
            user_id = None

            for span in spans:
                tags = span.get("tags", [])
                for tag in tags:
                    if tag.get("key") == "ComputerName":
                        host = tag.get("value", "unknown")
                    elif tag.get("key") == "User":
                        host = tag.get("value", host)
                    elif tag.get("key") == "Product":
                        os_type = tag.get("value", os_type)
                    elif tag.get("key") == "user_id":
                        user_id = tag.get("value")
                if host != "unknown" and user_id is not None:
                    break

            if user_id is None:
                user_id = "default_user"

            if not host or host == "unknown":
                host = "unknown"
            if not os_type:
                os_type = "windows"

            sigma_alert_ids = set()
            has_error = False
            matched_span_count = 0
            unique_rule_ids = set()

            seen_key = f"seen_span_ids:{trace_id}"
            seen_rules_key = f"seen_rule_ids:{trace_id}"
            for span in spans:
                tags = span.get("tags", [])
                span_has_alert = False
                span_id = span.get("spanId")
                for tag in tags:
                    if tag.get("key") in ("sigma.alert", "sigma@alert"):
                        rule_id = tag.get("value", "")
                        if rule_id:
                            sigma_alert_ids.add((span_id, rule_id))
                            unique_rule_ids.add(rule_id)
                            try:
                                self.valkey_client.sadd(seen_rules_key, rule_id)
                            except Exception:
                                pass
                        if span_id:
                            try:
                                added = self.valkey_client.sadd(seen_key, span_id)
                                if added == 1:
                                    matched_span_count += 1
                            except Exception:
                                matched_span_count += 1
                        else:
                            matched_span_count += 1
                        span_has_alert = True
                        break
                    elif tag.get("key") == "error" and tag.get("value") is True:
                        has_error = True

                if span_has_alert:
                    continue
            try:
                self.valkey_client.expire(seen_key, 86400)
            except Exception:
                pass
            try:
                self.valkey_client.expire(seen_rules_key, 86400)
            except Exception:
                pass

            if not sigma_alert_ids:
                return {}

            # 최종 누적치로 재계산
            try:
                total_matched_spans = int(self.valkey_client.scard(seen_key))
            except Exception:
                total_matched_spans = matched_span_count
            try:
                total_unique_rules = int(self.valkey_client.scard(seen_rules_key))
            except Exception:
                total_unique_rules = len(unique_rule_ids)

            severity_scores = []
            matched_rules = []
            sigma_alert = ""

            if unique_rule_ids:
                for sigma_id in unique_rule_ids:
                    sigma_id = str(sigma_id).strip()
                    if not sigma_alert:
                        sigma_alert = sigma_id

                    try:
                        rule_info = self.mongo_collection_client.find_one(
                            {"sigma_id": sigma_id}
                        )
                        if rule_info:
                            severity_score = rule_info.get("severity_score", 30)
                            level = rule_info.get("level", "low")
                            title = rule_info.get("title", "")

                            severity_scores.append(severity_score)
                            matched_rules.append(
                                {
                                    "sigma_id": sigma_id,
                                    "level": level,
                                    "severity_score": severity_score,
                                    "title": title,
                                }
                            )
                            logger.info(
                                "MongoDB에서 severity_score 조회: {sigma_id} -> {severity_score}"
                            )
                        else:
                            severity_scores.append(90)
                            matched_rules.append(
                                {
                                    "sigma_id": sigma_id,
                                    "level": "high",
                                    "severity_score": 90,
                                    "title": sigma_id,
                                }
                            )
                            logger.warning(
                                f"MongoDB에서 rule을 찾을 수 없음: {sigma_id}"
                            )
                    except Exception as e:
                        logger.warning(f"MongoDB 조회 실패 ({sigma_id}): {e}")
                        severity_scores.append(90)
                        matched_rules.append(
                            {
                                "sigma_id": sigma_id,
                                "level": "high",
                                "severity_score": 90,
                                "title": sigma_id,
                            }
                        )

                if severity_scores:
                    avg_severity_score = sum(severity_scores) / len(severity_scores)
                else:
                    avg_severity_score = 30
            else:
                if any(span.get("tag", {}).get("error", False) for span in spans):
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

            ai_summary = "AI 추론중..."

            sigma_rule_title = ""
            if matched_rules:
                sigma_rule_title = matched_rules[0].get("title", "")

            detected_at_ms = trace_data.get("detected_at")
            try:
                detected_at_ms = int(detected_at_ms)
            except Exception:
                detected_at_ms = int(time.time() * 1000)

            alarm_card = {
                "trace_id": trace_id or "unknown",
                "detected_at": detected_at_ms,
                "summary": summary or "Unknown Process",
                "host": host or "unknown",
                "os": os_type or "windows",
                "checked": False,
                "sigma_alert": sigma_alert or "",
                "matched_span_count": total_matched_spans,
                "matched_rule_unique_count": total_unique_rules,
                "ai_summary": ai_summary or "AI 추론중...",
                "severity": severity or "low",
                "severity_score": avg_severity_score or 30,
                "sigma_rule_title": (
                    sigma_rule_title
                    if sigma_rule_title
                    else (summary or "Unknown Process")
                ),
                "matched_rules": matched_rules or [],
                "user_id": user_id,
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
            return korea_dt.strftime("%Y-%m-%dT%H:%M:%S")
        except Exception as e:
            logger.error(f"시간 변환 실패: {e}")
            return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    def process_ai_result(self, raw_value: Any) -> bool:
        """ai-result-topic 메시지에서 최종 reason을 추출해 ai_summary로 병합 저장 (traces 선행 보장)"""
        try:
            payload: str
            if isinstance(raw_value, (bytes, bytearray)):
                payload = raw_value.decode("utf-8", errors="ignore")
            else:
                payload = str(raw_value)

            trace_id: str = ""
            reason: str = ""
            decision: str = ""

            # 1) JSON 포맷 우선 시도
            try:
                obj = json.loads(payload)
                if isinstance(obj, dict):
                    trace_id = str(obj.get("trace_id", ""))
                    reason = str(obj.get("reason", ""))
                    decision = str(obj.get("decision", ""))
            except Exception:
                obj = None

            # 2) 문자열 포맷(Trace <id> Result: {...}) fallback 파싱
            if not trace_id:
                m = re.search(r"Trace\s+([0-9a-fA-F]+)\s+Result:\s*", payload)
                if m:
                    trace_id = m.group(1)
            if not reason:
                m2 = re.search(r"reason'\s*:\s*\"([\s\S]*?)\"\s*,\s*'retriever'", payload)
                if not m2:
                    m2 = re.search(r"reason'\s*:\s*\"([\s\S]*?)\"\s*\}\s*\}?\s*$", payload)
                if m2:
                    reason = m2.group(1)

            if not trace_id:
                logger.warning("AI 결과에서 trace_id를 찾지 못함")
                return False

            if not reason:
                logger.info(f"AI 결과에 reason이 비어있음: {trace_id}")
                return False

            trace_key = f"trace:{trace_id}"
            existing = self.valkey_client.get(trace_key)

            if not existing:
                # 카드가 아직 없으면 보류 저장(pending_ai)만 하고 종료
                pending_key = f"pending_ai:{trace_id}"
                pending_obj = {"reason": reason}
                if decision:
                    pending_obj["decision"] = decision
                try:
                    self.valkey_client.set(pending_key, json.dumps(pending_obj, ensure_ascii=False))
                    self.valkey_client.expire(pending_key, 600)
                except Exception as e:
                    logger.warning(f"pending_ai 저장 실패: {e}")
                logger.info(f"AI 결과 보류 저장(pending): {trace_id}")
                return True

            # 카드가 있으면 병합 저장 + ai_update 이벤트
            try:
                card = json.loads(existing)
                if not isinstance(card, dict):
                    card = {}
            except Exception:
                card = {}

            card["ai_summary"] = reason
            if decision:
                card["ai_decision"] = decision
            card["has_ai"] = True

            self.valkey_client.set(trace_key, json.dumps(card, ensure_ascii=False))
            self.valkey_client.expire(trace_key, 86400)

            # SSE 이벤트(ai_update) - username/user_id 포함
            event_key = "websocket_events"
            event_data = {
                "type": "ai_update",
                "trace_id": trace_id,
                "data": {"ai_summary": reason, "user_id": str(card.get("user_id", "default_user")), "username": str(card.get("user_id", "default_user"))},
                "timestamp": int(time.time() * 1000),
            }
            self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
            self.valkey_client.ltrim(event_key, 0, 999)

            logger.info(f"AI 요약 저장 완료: {trace_id} (existing)")
            return True
        except Exception as e:
            logger.error(f"AI 결과 처리 실패: {e}")
            return False

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
                                topic = getattr(message, 'topic', '')
                                raw_value = message.value

                                if topic == "ai-result-topic":
                                    if self.process_ai_result(raw_value):
                                        logger.info("AI 결과 처리 완료")
                                    else:
                                        logger.warning("AI 결과 처리 실패")
                                    continue

                                # traces 토픽 처리(JSON)
                                payload = raw_value.decode("utf-8", errors="ignore") if isinstance(raw_value, (bytes, bytearray)) else str(raw_value)
                                trace_data = json.loads(payload)
                                trace_id = trace_data.get("trace_id", "unknown")
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

    parser = argparse.ArgumentParser(description="Kafka Trace Consumer")
    parser.add_argument(
        "--kafka-broker", default="localhost:9092", help="Kafka 브로커 주소"
    )
    parser.add_argument("--kafka-topic", default="traces", help="Kafka 토픽명")
    parser.add_argument("--valkey-host", default="localhost", help="Valkey 호스트")
    parser.add_argument("--valkey-port", type=int, default=6379, help="Valkey 포트")
    parser.add_argument("--valkey-db", type=int, default=0, help="Valkey 데이터베이스")

    args = parser.parse_args()

    consumer = TraceConsumer(
        kafka_broker=args.kafka_broker,
        kafka_topic=args.kafka_topic,
        valkey_host=args.valkey_host,
        valkey_port=args.valkey_port,
        valkey_db=args.valkey_db,
    )

    consumer.run()


if __name__ == "__main__":
    main()
