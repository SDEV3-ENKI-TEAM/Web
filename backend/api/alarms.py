import os
import json

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from utils.auth_deps import get_current_user_with_roles

router = APIRouter(prefix="/alarms", tags=["alarms"], dependencies=[Depends(get_current_user_with_roles)])


def to_korea_time(utc_timestamp_ms: int) -> str:
	return datetime.fromtimestamp(utc_timestamp_ms / 1000).strftime('%Y-%m-%dT%H:%M:%S')


class AlarmStatusUpdate(BaseModel):
	trace_id: str
	checked: bool


@router.get("")
async def get_alarm_traces(request: Request, offset: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user["id"]
		username = current_user["username"]

		query = {
			"query": {
				"bool": {
					"should": [
						{"term": {"tag.otel@status_code": "ERROR"}},
						{"exists": {"field": "tag.sigma@alert"}},
						{"term": {"tag.error": True}}
					]
				}
			},
			"sort": [{"startTime": {"order": "desc"}}],
			"size": max(limit * 5, 10000),
			"from": 0
		}

		query["query"]["bool"]["must"] = [
			{"bool": {
				"should": [
					{"term": {"tag.user_id": str(user_id)}},
					{"term": {"tag.user_id": username}}
				]
			}}
		]

		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)

		alarms = []
		seen_trace_ids = set()
		trace_span_counts = {}

		unique_trace_ids = list(set(span['_source'].get("traceID", "") for span in response['hits']['hits'] if span['_source'].get("traceID", "")))

		for trace_id in unique_trace_ids:
			sigma_span_count = 0
			for span in response['hits']['hits']:
				src = span['_source']
				if src.get('traceID', '') == trace_id:
					tag = src.get('tag', {})
					if tag.get('sigma@alert') and tag.get('sigma@alert').strip():
						sigma_span_count += 1
			trace_span_counts[trace_id] = sigma_span_count

		for span in response['hits']['hits']:
			src = span['_source']
			trace_id = src.get("traceID", "")
			if trace_id in seen_trace_ids:
				continue
			seen_trace_ids.add(trace_id)
			tag = src.get('tag', {})
			alarms.append({
				"trace_id": trace_id,
				"detected_at": to_korea_time(src.get("startTimeMillis", 0)),
				"summary": src.get("operationName") or "-",
				"host": tag.get("User", "-"),
				"os": tag.get("Product", "-"),
				"checked": False,
				"sigma_alert": tag.get("sigma@alert"),
				"span_count": trace_span_counts.get(trace_id, 0),
				"ai_summary": "테스트 요약",
				"user_id": user_id
			})

		total = len(alarms)
		paged = alarms[offset:offset+limit]
		has_more = offset + limit < total
		return {
			"alarms": paged,
			"total": total,
			"offset": offset,
			"limit": limit,
			"hasMore": has_more,
			"user_id": user_id
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/infinite")
async def get_alarms_infinite(request: Request, cursor: Optional[str] = None, limit: int = 20, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user["id"]
		username = current_user["username"]

		query = {
			"query": {
				"bool": {
					"should": [
						{"term": {"tag.otel@status_code": "ERROR"}},
						{"exists": {"field": "tag.sigma@alert"}},
						{"term": {"tag.error": True}}
					],
					"must": [
						{"bool": {
							"should": [
								{"term": {"tag.user_id": str(user_id)}},
								{"term": {"tag.user_id": username}}
							]
						}}
					]
				}
			},
			"sort": [{"startTime": {"order": "desc"}}],
			"size": 1000,
			"from": 0
		}

		if cursor:
			try:
				cursor_time = datetime.fromisoformat(cursor.replace('Z', '+00:00'))
				query["query"]["bool"]["filter"] = [
					{"range": {"startTimeMillis": {"lt": int(cursor_time.timestamp() * 1000)}}}
				]
			except:
				pass

		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		alarms = []
		seen_trace_ids = set()
		for span in response['hits']['hits']:
			src = span['_source']
			trace_id = src.get("traceID", "")
			if trace_id in seen_trace_ids:
				continue
			seen_trace_ids.add(trace_id)
			tag = src.get('tag', {})
			alarms.append({
				"trace_id": trace_id,
				"detected_at": to_korea_time(src.get("startTimeMillis", 0)),
				"summary": src.get("operationName") or "-",
				"host": tag.get("User", "-"),
				"os": tag.get("Product", "-"),
				"checked": False,
				"user_id": user_id
			})
		return {
			"alarms": alarms[:limit],
			"hasMore": len(alarms) > limit,
			"nextCursor": alarms[limit-1]["detected_at"] if len(alarms) > limit else None,
			"user_id": user_id
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/severity")
async def get_alarms_severity(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		mongo_collection = request.app.state.mongo_collection
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user["id"]
		username = current_user["username"]
		if mongo_collection is None:
			raise HTTPException(status_code=500, detail="MongoDB 연결이 없습니다.")
		query = {
			"query": {
				"bool": {
					"must": [
						{"bool": {
							"should": [
								{"term": {"tag.user_id": str(user_id)}},
								{"term": {"tag.user_id": username}}
							]
						}},
						{"term": {"tag.error": True}},
						{"exists": {"field": "tag.sigma@alert"}}
					]
				}
			},
			"size": 1000
		}
		spans_data = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		severity_data = {}
		for hit in spans_data['hits']['hits']:
			source = hit['_source']
			tag = source.get('tag', {})
			sigma_alert_id = tag.get('sigma@alert')
			if sigma_alert_id:
				rule_info = mongo_collection.find_one({"sigma_id": sigma_alert_id})
				if rule_info:
					level = rule_info.get('level', 'medium')
					severity_score = rule_info.get('severity_score', 60)
					title = rule_info.get('title', 'Unknown Rule')
					severity_data[sigma_alert_id] = {
						"level": level,
						"severity_score": severity_score,
						"title": title,
						"sigma_id": sigma_alert_id
					}
		return {"severity_data": severity_data, "total_alerts": len(severity_data)}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/{trace_id}/severity")
async def get_trace_severity(trace_id: str, request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		mongo_collection = request.app.state.mongo_collection
		opensearch_analyzer = request.app.state.opensearch
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
			"size": 1000
		}
		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		if not response['hits']['hits']:
			return {
				"trace_id": trace_id,
				"severity": "low",
				"level": "low",
				"severity_score": 30,
				"matched_rules": [],
				"found": False
			}
		severity_scores = []
		matched_rules = []
		for span in response['hits']['hits']:
			src = span['_source']
			tag = src.get('tag', {})
			sigma_alert = tag.get('sigma@alert', '')
			if sigma_alert:
				rule_info = mongo_collection.find_one({"sigma_id": sigma_alert}) if mongo_collection else None
				if rule_info:
					severity_score = rule_info.get('severity_score', 30)
					level = rule_info.get('level', 'low')
					title = rule_info.get('title', '')
					severity_scores.append(severity_score)
					matched_rules.append({
						"sigma_id": sigma_alert,
						"level": level,
						"severity_score": severity_score,
						"title": title
					})
				else:
					severity_scores.append(90)
					matched_rules.append({
						"sigma_id": sigma_alert,
						"level": "high",
						"severity_score": 90,
						"title": sigma_alert
					})
		if severity_scores:
			avg_severity_score = sum(severity_scores) / len(severity_scores)
		else:
			avg_severity_score = 30
			severity = "low"
		if avg_severity_score >= 90:
			severity = "critical"
		elif avg_severity_score >= 80:
			severity = "high"
		elif avg_severity_score > 60:
			severity = "medium"
		else:
			severity = "low"
		return {
			"trace_id": trace_id,
			"severity": severity,
			"level": severity,
			"severity_score": avg_severity_score,
			"matched_rules": matched_rules,
			"found": True
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/check")
async def update_alarm_status(payload: AlarmStatusUpdate):
	try:
		status_file = "alarm_status.json"
		alarm_status = {}
		if os.path.exists(status_file):
			try:
				with open(status_file, 'r', encoding='utf-8') as f:
					alarm_status = json.load(f)
			except:
				alarm_status = {}
		alarm_status[payload.trace_id] = payload.checked
		with open(status_file, 'w', encoding='utf-8') as f:
			json.dump(alarm_status, f, ensure_ascii=False, indent=2)
		return {"success": True, "message": "알림 상태가 업데이트되었습니다."}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
