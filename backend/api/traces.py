from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from auth.auth_deps import get_current_user_with_roles

router = APIRouter(prefix="/traces", tags=["traces"])


def to_korea_time(utc_timestamp_ms: int) -> str:
	utc_dt = datetime.fromtimestamp(utc_timestamp_ms / 1000, tz=timezone.utc)
	korea_tz = timezone(timedelta(hours=9))
	korea_dt = utc_dt.astimezone(korea_tz)
	return korea_dt.strftime('%Y-%m-%dT%H:%M:%S')


@router.get("/search/{trace_id}")
async def search_trace_by_id(
	trace_id: str,
	request: Request,
	current_user: dict = Depends(get_current_user_with_roles),
):
	try:
		opensearch_analyzer = request.app.state.opensearch
		if not opensearch_analyzer:
			raise HTTPException(status_code=500, detail="OpenSearch not initialized")

		user_id = current_user["id"]
		username = current_user["username"]

		query = {
			"query": {
				"bool": {
					"must": [
						{"term": {"traceID": trace_id}},
						{"bool": {
							"should": [
								{"term": {"tag.user_id": str(user_id)}},
								{"term": {"tag.user_id": username}}
							]
						}}
					]
				}
			},
			"size": 1
		}

		user_access = opensearch_analyzer.client.search(
			index="jaeger-span-*",
			body=query
		)

		if not user_access['hits']['hits']:
			return {
				"data": None,
				"found": False,
				"message": f"Trace ID '{trace_id}'를 찾을 수 없거나 접근 권한이 없습니다."
			}

		events = opensearch_analyzer.get_process_tree_events(trace_id)

		if not events:
			return {
				"data": None,
				"found": False,
				"message": f"Trace ID '{trace_id}'를 찾을 수 없습니다."
			}

		events.sort(key=lambda x: x.get('timestamp', ''))

		first_event = events[0] if events else {}

		alert_events = [event for event in events if event.get('has_alert', False)]
		has_any_alert = len(alert_events) > 0

		host_info = {"hostname": "-", "ip": "-", "os": "-"}
		if events:
			first_event_source = events[0].get('_source', {})
			process_tag = first_event_source.get('process', {}).get('tag', {})
			host_info = {
				"hostname": process_tag.get("host@name", "-"),
				"ip": process_tag.get("ip@address", "-"),
				"os": process_tag.get("os@type", "-")
			}

		trace_data = {
			"trace_id": trace_id,
			"host": host_info,
			"events": events,
			"timestamp": first_event.get('timestamp', ''),
			"label": "이상" if has_any_alert else "정상",
			"severity": "high" if has_any_alert else "low",
		}

		return {
			"data": trace_data,
			"found": True,
			"message": f"Trace ID '{trace_id}'를 찾았습니다."
		}
	except Exception as e:
		return {
			"data": None,
			"found": False,
			"message": f"검색 중 오류가 발생했습니다: {str(e)}"
		}
