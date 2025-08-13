import json
import logging
import time
from typing import Any, Dict, List, Optional

from kafka import KafkaConsumer, KafkaProducer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _get_attr_value(attr_value_obj: Dict[str, Any]) -> Any:
    """Extract primitive value from OTLP Attribute value object."""
    if not isinstance(attr_value_obj, dict):
        return attr_value_obj
    for key in ("stringValue", "intValue", "boolValue", "doubleValue"):
        if key in attr_value_obj:
            value = attr_value_obj[key]
            if key == "intValue":
                try:
                    return int(value)
                except Exception:
                    return value
            return value
    return None


essential_keys = {"trace_id", "detected_at", "summary", "spans"}


def _attributes_to_tags(attributes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    tags: List[Dict[str, Any]] = []
    for attr in attributes or []:
        key = attr.get("key")
        value = _get_attr_value(attr.get("value", {}))
        if key is None:
            continue
        tags.append({"key": key, "value": value})
    return tags


def _group_spans_by_trace(resource_spans_obj: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Group OTLP spans by traceId within one resourceSpans payload."""
    trace_id_to_spans: Dict[str, List[Dict[str, Any]]] = {}

    scope_spans = resource_spans_obj.get("scopeSpans", [])
    for scope in scope_spans:
        spans = scope.get("spans", [])
        for span in spans:
            trace_id = span.get("traceId")
            if not trace_id:
                continue

            operation_name = span.get("name", "")
            attributes = span.get("attributes", [])
            tags = _attributes_to_tags(attributes)

            transformed_span = {
                "operationName": operation_name,
                "tags": tags
            }

            trace_id_to_spans.setdefault(trace_id, []).append(transformed_span)

    return trace_id_to_spans


def _compute_detected_at_ms(resource_spans_obj: Dict[str, Any], spans_by_trace: Dict[str, List[Dict[str, Any]]]) -> Dict[str, int]:
    """Compute earliest startTimeUnixNano per trace if available; fallback to now."""
    trace_id_to_earliest_ms: Dict[str, int] = {}

    scope_spans = resource_spans_obj.get("scopeSpans", [])
    for scope in scope_spans:
        for span in scope.get("spans", []):
            trace_id = span.get("traceId")
            if not trace_id or trace_id not in spans_by_trace:
                continue
            start_ns = span.get("startTimeUnixNano")
            try:
                start_ns_int = int(start_ns)
                start_ms = start_ns_int // 1_000_000
            except Exception:
                start_ms = int(time.time() * 1000)

            if trace_id not in trace_id_to_earliest_ms:
                trace_id_to_earliest_ms[trace_id] = start_ms
            else:
                trace_id_to_earliest_ms[trace_id] = min(trace_id_to_earliest_ms[trace_id], start_ms)

    now_ms = int(time.time() * 1000)
    for trace_id in spans_by_trace.keys():
        if trace_id not in trace_id_to_earliest_ms:
            trace_id_to_earliest_ms[trace_id] = now_ms

    return trace_id_to_earliest_ms


def _has_sigma_or_error(spans: List[Dict[str, Any]]) -> bool:
    has_sigma = False
    has_error = False
    for span in spans:
        for tag in span.get("tags", []):
            if tag.get("key") == "sigma.alert":
                has_sigma = True
                break
        if has_sigma:
            break
    return has_sigma or has_error


def normalize_and_send(producer: KafkaProducer, out_topic: str, raw_message: Dict[str, Any]) -> int:
    """Normalize one raw OTLP message and emit normalized trace documents.
    Returns number of records emitted.
    """
    emitted = 0
    resource_spans_list = raw_message.get("resourceSpans", [])

    for resource_spans in resource_spans_list:
        spans_by_trace = _group_spans_by_trace(resource_spans)
        if not spans_by_trace:
            continue

        detected_at_ms_map = _compute_detected_at_ms(resource_spans, spans_by_trace)

        for trace_id, spans in spans_by_trace.items():
            if not spans:
                continue

            if not _has_sigma_or_error(spans):
                continue

            first_operation = spans[0].get("operationName", "")
            summary = f"{first_operation} - {len(spans)}개 이벤트" if first_operation else f"{len(spans)}개 이벤트"

            normalized_doc = {
                "trace_id": trace_id,
                "detected_at": detected_at_ms_map.get(trace_id, int(time.time() * 1000)),
                "summary": summary,
                "spans": spans
            }

            if not all(k in normalized_doc for k in essential_keys):
                continue

            try:
                producer.send(out_topic, normalized_doc)
                emitted += 1
            except Exception as e:
                logger.error(f"Kafka produce failed for trace {trace_id}: {e}")

    return emitted


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Normalize OTLP raw_trace to traces topic")
    parser.add_argument("--kafka-broker", default="localhost:9092", help="Kafka broker address")
    parser.add_argument("--in-topic", default="raw_trace", help="Input topic with OTLP data")
    parser.add_argument("--out-topic", default="traces", help="Output topic for normalized traces")
    parser.add_argument("--group-id", default="raw_trace_normalizer_group", help="Kafka consumer group id")
    parser.add_argument("--log-level", default="INFO", help="Logging level")

    args = parser.parse_args()
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper(), logging.INFO))

    logger.info("Starting raw_trace normalizer")
    logger.info(f"Kafka: {args.kafka_broker}, in={args.in_topic}, out={args.out_topic}")

    consumer = KafkaConsumer(
        args.in_topic,
        bootstrap_servers=[args.kafka_broker],
        auto_offset_reset='latest',
        enable_auto_commit=True,
        group_id=args.group_id,
        value_deserializer=lambda m: json.loads(m.decode('utf-8')),
        consumer_timeout_ms=1000
    )

    producer = KafkaProducer(
        bootstrap_servers=[args.kafka_broker],
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        acks='all',
        retries=3
    )

    try:
        while True:
            message_batch = consumer.poll(timeout_ms=1000)
            total_emitted = 0
            for _tp, messages in message_batch.items():
                for message in messages:
                    try:
                        raw = message.value
                        emitted = normalize_and_send(producer, args.out_topic, raw)
                        total_emitted += emitted
                    except Exception as e:
                        logger.error(f"Normalization error: {e}")
            if total_emitted:
                logger.info(f"Emitted {total_emitted} normalized trace(s)")
    except KeyboardInterrupt:
        logger.info("Shutting down normalizer")
    finally:
        try:
            producer.flush(timeout=5)
        except Exception:
            pass
        producer.close()
        consumer.close()


if __name__ == "__main__":
    main() 