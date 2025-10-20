import json
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
import re
import sys
import os
from pathlib import Path

import redis
from kafka import KafkaConsumer
from pymongo import MongoClient
from dotenv import load_dotenv

# .env 파일 로드
try:
    env_path = Path(__file__).resolve().parent.parent / '.env'
    load_dotenv(env_path, encoding='utf-8')
except Exception as e:
    print(f".env 파일 로드 중 오류: {e}")
    try:
        load_dotenv(env_path, encoding='cp949')
    except Exception as e2:
        print(f"cp949 인코딩도 실패: {e2}")
        load_dotenv()

# database 모듈 임포트를 위한 경로 추가
sys.path.append(str(Path(__file__).resolve().parent.parent))
from database.database import SessionLocal, LLMAnalysis

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

KST = timezone(timedelta(hours=9))


class TraceConsumer:
    """Kafka에서 Trace 데이터를 수신하여 Valkey에 저장하는 Consumer"""

    def __init__(
        self,
        kafka_broker: str = None,
        kafka_topic: str = None,
        valkey_host: str = None,
        valkey_port: int = None,
        valkey_db: int = None,
        mongo_uri: str = None,
        mongo_db: str = None,
        mongo_collection: str = None,
    ):
        # 환경 변수에서 값 가져오기 (인자로 전달된 값이 없으면)
        self.kafka_broker = kafka_broker or os.getenv("KAFKA_BROKER", "localhost:9092")
        self.kafka_topic = kafka_topic or os.getenv("KAFKA_TOPIC", "traces")
        self.valkey_host = valkey_host or os.getenv("VALKEY_HOST", "localhost")
        self.valkey_port = valkey_port or int(os.getenv("VALKEY_PORT", "6379"))
        self.valkey_db = valkey_db if valkey_db is not None else int(os.getenv("VALKEY_DB", "0"))
        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.mongo_db = mongo_db or os.getenv("MONGO_DB", "security")
        self.mongo_collection = mongo_collection or os.getenv("MONGO_COLLECTION", "rules")

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
            self.consumer.subscribe([self.kafka_topic, "llm_result"])
            logger.info(
                f"Kafka Consumer 초기화 완료: {self.kafka_broker} -> subscribe {[self.kafka_topic, 'ai-result-topic', 'llm_result']}"
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
            prev_severity_score = None
            prev_sigma_rule_title = None
            if existing_data:
                try:
                    existing_card = json.loads(existing_data) if existing_data else {}
                    if isinstance(existing_card, dict):
                        prev_count = int(existing_card.get("matched_span_count", 0))
                        prev_unique = int(existing_card.get("matched_rule_unique_count", 0))
                        prev_severity_score = existing_card.get("severity_score")
                        prev_sigma_rule_title = existing_card.get("sigma_rule_title")
                except Exception:
                    prev_count = 0
                    prev_unique = 0
                    prev_severity_score = None
                    prev_sigma_rule_title = None

            try:
                curr_count = int(alarm_card.get("matched_span_count", 0))
            except Exception:
                curr_count = 0
            try:
                curr_unique = int(alarm_card.get("matched_rule_unique_count", 0))
            except Exception:
                curr_unique = 0
            curr_severity_score = alarm_card.get("severity_score")
            curr_sigma_rule_title = alarm_card.get("sigma_rule_title")

            if curr_count < prev_count:
                alarm_card["matched_span_count"] = prev_count
                curr_count = prev_count
            if curr_unique < prev_unique:
                alarm_card["matched_rule_unique_count"] = prev_unique
                curr_unique = prev_unique

            is_update = (curr_count > prev_count) or (curr_unique > prev_unique)
            if not is_new_card and not is_update:
                if prev_severity_score is not None and curr_severity_score is not None:
                    try:
                        if float(curr_severity_score) != float(prev_severity_score):
                            is_update = True
                    except Exception:
                        if str(curr_severity_score) != str(prev_severity_score):
                            is_update = True
                if not is_update:
                    if (prev_sigma_rule_title or "") != (curr_sigma_rule_title or ""):
                        is_update = True

            try:
                pending_key = f"pending_ai:{trace_id}"
                pending_raw = self.valkey_client.get(pending_key)
                if pending_raw:
                    try:
                        pending = json.loads(pending_raw)
                    except Exception:
                        pending = {}
                    
                    # 모든 AI 관련 필드 병합
                    pending_reason = pending.get("reason")
                    pending_decision = pending.get("decision")
                    pending_long_summary = pending.get("long_summary")
                    pending_score = pending.get("score")
                    pending_mitigation = pending.get("mitigation_suggestions")
                    pending_similar = pending.get("similar_trace_ids")
                    
                    if pending_reason:
                        alarm_card["ai_summary"] = pending_reason
                        alarm_card["has_ai"] = True
                    if pending_decision:
                        alarm_card["ai_decision"] = pending_decision
                    if pending_long_summary:
                        alarm_card["ai_long_summary"] = pending_long_summary
                    if pending_score:
                        alarm_card["ai_score"] = pending_score
                    if pending_mitigation:
                        alarm_card["ai_mitigation"] = pending_mitigation
                    if pending_similar:
                        alarm_card["ai_similar_traces"] = pending_similar
                    
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

            self.valkey_client.set(
                trace_key, json.dumps(alarm_card, ensure_ascii=False)
            )
            self.valkey_client.expire(trace_key, 86400)

            event_key = "sse_events"
            event_data = {
                "type": "trace_update",
                "trace_id": trace_id,
                "data": {
                    "trace_id": trace_id,
                    "user_id": str(alarm_card.get("user_id", "default_user")),
                    "username": str(alarm_card.get("user_id", "default_user")),
                    "summary": alarm_card.get("summary", ""),
                    "severity": alarm_card.get("severity", "low"),
                    "severity_score": alarm_card.get("severity_score", 30),
                    "matched_span_count": alarm_card.get("matched_span_count", 0),
                    "matched_rule_unique_count": alarm_card.get("matched_rule_unique_count", 0),
                    "is_new": is_new_card
                },
                "timestamp": int(time.time() * 1000),
            }
            self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
            self.valkey_client.ltrim(event_key, 0, 999)

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

            event_key = "sse_events"
            if is_new_card:
                event_data = {
                    "type": "new_trace",
                    "trace_id": trace_id,
                    "data": alarm_card,
                    "timestamp": int(time.time() * 1000),
                }
                self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
                self.valkey_client.ltrim(event_key, 0, 999)
                try:
                    from .slack_notify import send_slack_alert
                    severity = str(alarm_card.get("severity", "unknown"))
                    _ = send_slack_alert(severity, trace_id=trace_id, summary=alarm_card.get("summary"), host=alarm_card.get("host"))
                except Exception as e:
                    logger.warning(f"Slack notify failed: {e}")
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
                                    "count": 1,
                                    "last_ts": int(time.time() * 1000),
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
                                    "count": 1,
                                    "last_ts": int(time.time() * 1000),
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
                                "count": 1,
                                "last_ts": int(time.time() * 1000),
                            }
                        )

                if matched_rules:
                    if severity_scores:
                        avg_severity_score = sum(severity_scores) / len(severity_scores)
                    else:
                        avg_severity_score = 30
                    try:
                        top_score = max(r.get("severity_score", 0) for r in matched_rules)
                    except Exception:
                        top_score = 30
                    top_candidates = [r for r in matched_rules if r.get("severity_score", 0) == top_score]
                    def level_weight(lv: str) -> int:
                        lv = (lv or "").lower()
                        if lv == "critical":
                            return 4
                        if lv == "high":
                            return 3
                        if lv == "medium":
                            return 2
                        if lv == "low":
                            return 1
                        return 0
                    top_candidates.sort(key=lambda r: (
                        -r.get("count", 0),
                        -r.get("last_ts", 0),
                        -level_weight(r.get("level", "")),
                        str(r.get("sigma_id", "")),
                    ))
                    top_rule = top_candidates[0]
                    sigma_rule_title = top_rule.get("title", "")
                else:
                    avg_severity_score = 30
                    sigma_rule_title = ""
            else:
                if any(span.get("tag", {}).get("error", False) for span in spans):
                    avg_severity_score = 60
                    severity = "medium"
                else:
                    avg_severity_score = 30
                    severity = "low"
                matched_rules = []
                sigma_rule_title = ""

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

    def process_ai_result(self, raw_value: Any, message_key: Optional[bytes] = None) -> bool:
        """ai-result-topic 또는 llm_result 메시지에서 요약(reason)을 추출해 ai_summary로 병합 저장 (traces 선행 보장)"""
        try:
            payload: str
            if isinstance(raw_value, (bytes, bytearray)):
                payload = raw_value.decode("utf-8", errors="ignore")
            else:
                payload = str(raw_value)

            trace_id: str = ""
            reason: str = ""
            decision: str = ""
            long_summary: str = ""
            score: float = 0.0
            mitigation_suggestions: str = ""
            similar_trace_ids: list = []

            # 1) JSON 포맷 우선 시도
            try:
                obj = json.loads(payload)
                if isinstance(obj, dict):
                    # 다양한 키 대응: trace_id | traceID | traceId
                    _trace_id = obj.get("trace_id") or obj.get("traceID") or obj.get("traceId")
                    trace_id = str(_trace_id) if _trace_id is not None and _trace_id != "null" and _trace_id else ""
                    
                    # traceID가 없으면 Kafka message key에서 시도
                    if not trace_id and message_key:
                        try:
                            key_str = message_key.decode("utf-8") if isinstance(message_key, bytes) else str(message_key)
                            if key_str and key_str != "None":
                                trace_id = key_str
                                logger.info(f"Kafka 메시지 key에서 traceID 추출: {trace_id}")
                        except Exception:
                            pass

                    # reason | summary.summary | summary(문자열)
                    _reason = obj.get("reason")
                    if not _reason:
                        _summary_field = obj.get("summary")
                        if isinstance(_summary_field, dict):
                            _reason = _summary_field.get("summary")
                        elif isinstance(_summary_field, str):
                            _reason = _summary_field
                    reason = str(_reason) if _reason is not None else ""

                    # decision | prediction
                    _decision = obj.get("decision") or obj.get("prediction")
                    decision = str(_decision) if _decision is not None else ""

                    # long_summary 보조 정보 (있으면 카드에 저장)
                    _long = obj.get("long_summary")
                    long_summary = str(_long) if _long is not None else ""
                    
                    # score (LLM 신뢰도 점수)
                    _score = obj.get("score")
                    if _score is not None:
                        try:
                            score = float(_score)
                        except (ValueError, TypeError):
                            score = 0.0
                    
                    # mitigation_suggestions (대응 방안)
                    _mitigation = obj.get("mitigation_suggestions")
                    mitigation_suggestions = str(_mitigation) if _mitigation is not None else ""
                    
                    # similar_trace_ids (유사 트레이스)
                    _similar = obj.get("similar_trace_ids")
                    if isinstance(_similar, list):
                        similar_trace_ids = _similar
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
                logger.warning(f"AI 결과에서 trace_id를 찾지 못함. 데이터: {payload[:200]}")
                return False

            if not reason:
                logger.info(f"AI 결과에 reason이 비어있음: {trace_id}")
                # reason이 없어도 다른 정보가 있으면 계속 진행

            trace_key = f"trace:{trace_id}"
            existing = self.valkey_client.get(trace_key)

            if not existing:
                # 카드가 아직 없으면 보류 저장(pending_ai)만 하고 종료
                pending_key = f"pending_ai:{trace_id}"
                pending_obj = {}
                if reason:
                    pending_obj["reason"] = reason
                if decision:
                    pending_obj["decision"] = decision
                if long_summary:
                    pending_obj["long_summary"] = long_summary
                if score > 0:
                    pending_obj["score"] = score
                if mitigation_suggestions:
                    pending_obj["mitigation_suggestions"] = mitigation_suggestions
                if similar_trace_ids:
                    pending_obj["similar_trace_ids"] = similar_trace_ids
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

            # AI 분석 결과 병합
            if reason:
                card["ai_summary"] = reason
            if decision:
                card["ai_decision"] = decision
            card["has_ai"] = True
            if long_summary:
                card["ai_long_summary"] = long_summary
            if score > 0:
                card["ai_score"] = score
            if mitigation_suggestions:
                card["ai_mitigation"] = mitigation_suggestions
            if similar_trace_ids:
                card["ai_similar_traces"] = similar_trace_ids

            self.valkey_client.set(trace_key, json.dumps(card, ensure_ascii=False))
            self.valkey_client.expire(trace_key, 86400)

            event_key = "sse_events"
            event_data = {
                "type": "ai_update",
                "trace_id": trace_id,
                "data": {
                    "ai_summary": reason if reason else None,
                    "ai_decision": decision if decision else None,
                    "ai_score": score if score > 0 else None,
                    "ai_long_summary": long_summary if long_summary else None,
                    "ai_mitigation": mitigation_suggestions if mitigation_suggestions else None,
                    "ai_similar_traces": similar_trace_ids if similar_trace_ids else None,
                    "user_id": str(card.get("user_id", "default_user")),
                    "username": str(card.get("user_id", "default_user"))
                },
                "timestamp": int(time.time() * 1000),
            }
            self.valkey_client.lpush(event_key, json.dumps(event_data, ensure_ascii=False))
            self.valkey_client.ltrim(event_key, 0, 999)

            try:
                self._save_to_mysql(
                    trace_id=trace_id,
                    user_id=card.get("user_id"),
                    summary=reason,
                    long_summary=long_summary,
                    mitigation_suggestions=mitigation_suggestions,
                    score=score,
                    prediction=decision,
                    similar_trace_ids=similar_trace_ids
                )
            except Exception as mysql_error:
                logger.warning(f"MySQL 저장 실패 (계속 진행): {mysql_error}")

            logger.info(f"AI 요약 저장 완료: {trace_id} (existing)")
            return True
        except Exception as e:
            logger.error(f"AI 결과 처리 실패: {e}")
            return False
    
    def _save_to_mysql(
        self,
        trace_id: str,
        user_id: str = None,
        summary: str = None,
        long_summary: str = None,
        mitigation_suggestions: str = None,
        score: float = None,
        prediction: str = None,
        similar_trace_ids: list = None
    ):
        """LLM 분석 결과를 MySQL에 저장"""
        db = SessionLocal()
        try:
            # 기존 레코드 확인
            existing = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == trace_id).first()
            
            if existing:
                # 업데이트
                if user_id is not None:
                    existing.user_id = str(user_id)
                if summary:
                    existing.summary = summary
                if long_summary:
                    existing.long_summary = long_summary
                if mitigation_suggestions:
                    existing.mitigation_suggestions = mitigation_suggestions
                if score is not None:
                    existing.score = score
                if prediction:
                    existing.prediction = prediction
                if similar_trace_ids:
                    existing.similar_trace_ids = json.dumps(similar_trace_ids, ensure_ascii=False)
                
                db.commit()
                logger.info(f"MySQL 업데이트 완료: {trace_id}")
            else:
                # 새로 생성
                new_analysis = LLMAnalysis(
                    trace_id=trace_id,
                    user_id=str(user_id) if user_id is not None else None,
                    summary=summary,
                    long_summary=long_summary,
                    mitigation_suggestions=mitigation_suggestions,
                    score=score,
                    prediction=prediction,
                    similar_trace_ids=json.dumps(similar_trace_ids, ensure_ascii=False) if similar_trace_ids else None
                )
                db.add(new_analysis)
                db.commit()
                logger.info(f"MySQL 저장 완료: {trace_id}")
        except Exception as e:
            db.rollback()
            logger.error(f"MySQL 저장 실패: {e}")
            raise
        finally:
            db.close()

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

                                if topic in ("ai-result-topic", "llm_result"):
                                    # Kafka 메시지 key에서 traceID 추출 시도
                                    message_key = getattr(message, 'key', None)
                                    if self.process_ai_result(raw_value, message_key):
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
    """메인 함수 - 환경 변수(.env)에서 설정을 자동으로 읽어옵니다"""
    logger.info("Trace Consumer 시작 - 환경 변수에서 설정 로드")
    
    # 환경 변수로부터 자동으로 설정을 가져옵니다
    consumer = TraceConsumer()
    
    # 현재 설정 출력
    logger.info(f"Kafka Broker: {consumer.kafka_broker}")
    logger.info(f"Kafka Topic: {consumer.kafka_topic}")
    logger.info(f"Valkey: {consumer.valkey_host}:{consumer.valkey_port}/{consumer.valkey_db}")
    logger.info(f"MongoDB: {consumer.mongo_uri}")
    
    consumer.run()


if __name__ == "__main__":
    main()
