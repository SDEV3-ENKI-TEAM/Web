import os
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Any, Dict

backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import pymongo.errors
import redis
import sqlalchemy.exc

from utils.auth_deps import get_current_user_with_roles

router = APIRouter(prefix="/alarms", tags=["alarms"], dependencies=[Depends(get_current_user_with_roles)])
logger = logging.getLogger(__name__)


def safe_mongo_find_one(collection, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
	"""MongoDB 컬렉션에서 안전하게 문서를 조회합니다.
	
	Args:
		collection: MongoDB 컬렉션 객체 (None일 수 있음)
		query: 조회 쿼리
	
	Returns:
		문서 또는 None
	
	Raises:
		RuntimeError: 컬렉션이 None인 경우
	"""
	if collection is None:
		logger.warning(f"MongoDB collection is None, cannot execute query: {query}")
		return None
	
	try:
		return collection.find_one(query)
	except (pymongo.errors.ConnectionFailure, pymongo.errors.ServerSelectionTimeoutError) as e:
		logger.error(f"MongoDB connection error: {e}")
		return None
	except pymongo.errors.OperationFailure as e:
		logger.error(f"MongoDB operation error: {e}")
		return None
	except Exception as e:
		logger.error(f"MongoDB unexpected error: {e}")
		return None


def parse_sigma_alert(sigma_alert_value) -> List[str]:
	"""sigma@alert 값을 파싱하여 sigma_id 리스트 반환"""
	if not sigma_alert_value:
		return []
	
	try:
		if isinstance(sigma_alert_value, str) and sigma_alert_value.strip().startswith('['):
			rule_ids = json.loads(sigma_alert_value)
			return [str(rid).strip() for rid in rule_ids if rid]
		elif isinstance(sigma_alert_value, str):
			return [sigma_alert_value.strip()]
		elif isinstance(sigma_alert_value, list):
			return [str(rid).strip() for rid in sigma_alert_value if rid]
		else:
			return [str(sigma_alert_value).strip()]
	except (json.JSONDecodeError, TypeError, ValueError) as e:
		logger.warning(f"Sigma alert parsing error: {e}")
		return [str(sigma_alert_value).strip()]


def to_korea_time(utc_timestamp_ms: int) -> str:
	return datetime.fromtimestamp(utc_timestamp_ms / 1000).strftime('%Y-%m-%dT%H:%M:%S')


class AlarmStatusUpdate(BaseModel):
	trace_id: str
	checked: bool


class TraceIdsPayload(BaseModel):
	trace_ids: list[str]


@router.post("/meta/batch")
async def get_alarm_meta_batch(payload: TraceIdsPayload, request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		if not payload.trace_ids:
			return {"meta": []}
		vk = getattr(request.app.state, "valkey", None)
		opensearch_analyzer = request.app.state.opensearch
		mongo_collection = request.app.state.mongo_collection
		user_id = current_user["id"]
		username = current_user["username"]

		keys = [f"trace:{tid}" for tid in payload.trace_ids]
		cached = []
		if vk:
			try:
				cached = vk.mget(keys)
			except (redis.ConnectionError, redis.TimeoutError) as e:
				logger.warning(f"Valkey connection error: {e}")
				cached = [None] * len(keys)
			except Exception as e:
				logger.warning(f"Valkey mget error: {e}")
				cached = [None] * len(keys)
		else:
			cached = [None] * len(keys)

		results_map = {}
		miss_ids = []
		for tid, raw in zip(payload.trace_ids, cached):
			if raw:
				try:
					import json
					results_map[tid] = json.loads(raw)
				except json.JSONDecodeError as e:
					logger.warning(f"JSON decode error for trace {tid}: {e}")
				except Exception as e:
					logger.warning(f"Unexpected error parsing trace {tid}: {e}")
			else:
				miss_ids.append(tid)

		if miss_ids:
			query = {
				"query": {
					"bool": {
						"must": [
							{"terms": {"traceID": miss_ids}},
							{"bool": {
								"should": [
									{"term": {"tag.user_id": str(user_id)}},
									{"term": {"tag.user_id": username}}
								]
							}}
						]
					}
				},
				"size": 10000
			}
			resp = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
			by_trace = {}
			for hit in resp["hits"]["hits"]:
				src = hit["_source"]
				tid = src.get("traceID")
				if not tid:
					continue
				by_trace.setdefault(tid, []).append(src)

			import json
			for tid in miss_ids:
				spans = by_trace.get(tid, [])
				if not spans:
					continue
				
				operation = ""
				host = "-"
				os_type = "-"
				for s in spans:
					if not operation:
						operation = s.get("operationName", "")
					if host == "-":
						host = s.get("tag", {}).get("User", "-")
					if os_type == "-":
						os_type = s.get("tag", {}).get("Product", "-")
					if operation and host != "-" and os_type != "-":
						break
				
				unique_rule_ids = set()
				matched_span_count = 0
				for s in spans:
					tag = s.get("tag", {})
					sigma_alert = tag.get("sigma@alert")
					if sigma_alert:
						for rule_id in parse_sigma_alert(sigma_alert):
							unique_rule_ids.add(rule_id)
						matched_span_count += 1
				severity_scores = []
				matched_rules = []
				for sigma_id in unique_rule_ids:
					rule_info = mongo_collection.find_one({"sigma_id": sigma_id}) if (mongo_collection is not None) else None
					if rule_info:
						severity_scores.append(rule_info.get("severity_score", 30))
						matched_rules.append({
							"sigma_id": sigma_id,
							"level": rule_info.get("level", "low"),
							"severity_score": rule_info.get("severity_score", 30),
							"title": rule_info.get("title", "")
						})
				avg = sum(severity_scores) / len(severity_scores) if severity_scores else 30
				if avg >= 90:
					severity = "critical"
				elif avg >= 80:
					severity = "high"
				elif avg > 60:
					severity = "medium"
				else:
					severity = "low"
				def _level_weight(lv: str) -> int:
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
				top_title = ""
				if matched_rules:
					try:
						top_score = max(r.get("severity_score", 0) for r in matched_rules)
					except (ValueError, TypeError) as e:
						logger.warning(f"Severity score calculation error: {e}")
						top_score = 0
					except Exception as e:
						logger.warning(f"Unexpected error calculating top score: {e}")
						top_score = 0
					candidates = [r for r in matched_rules if r.get("severity_score", 0) == top_score]
					candidates.sort(key=lambda r: (-_level_weight(r.get("level", "")), str(r.get("sigma_id", ""))))
					top_title = candidates[0].get("title", "") if candidates else ""
				sigma_rule_title = top_title or (operation or "-")
				card = {
					"trace_id": tid,
					"detected_at": spans[0].get("startTimeMillis", 0),
					"summary": operation or "-",
					"host": host or "-",
					"os": os_type or "-",
					"checked": False,
					"matched_span_count": matched_span_count,
					"matched_rule_unique_count": len(unique_rule_ids),
					"severity": severity,
					"severity_score": avg,
					"matched_rules": matched_rules,
					"user_id": username,
					"sigma_rule_title": sigma_rule_title
				}
				results_map[tid] = card
				if vk:
					try:
						vk.set(f"trace:{tid}", json.dumps(card, ensure_ascii=False))
						vk.expire(f"trace:{tid}", 86400)
					except (redis.ConnectionError, redis.TimeoutError) as e:
						logger.warning(f"Valkey connection error saving trace {tid}: {e}")
					except Exception as e:
						logger.warning(f"Valkey save error for trace {tid}: {e}")

		ordered = [results_map.get(tid) for tid in payload.trace_ids if results_map.get(tid)]
		return {"meta": ordered}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_alarm_traces(request: Request, offset: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		vk = getattr(request.app.state, "valkey", None)
		opensearch_analyzer = request.app.state.opensearch
		mongo_collection = request.app.state.mongo_collection
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
			"size": max(limit * 5, 10000),
			"from": 0
		}

		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)

		seen = set()
		trace_ids = []
		for span in response['hits']['hits']:
			src = span['_source']
			tid = src.get("traceID", "")
			if tid and tid not in seen:
				seen.add(tid)
				trace_ids.append(tid)

		total = len(trace_ids)
		paged = trace_ids[offset:offset+limit]

		if paged:
			keys = [f"trace:{tid}" for tid in paged]
			cached = []
			if vk:
				try:
					cached = vk.mget(keys)
				except (redis.ConnectionError, redis.TimeoutError) as e:
					logger.warning(f"Valkey connection error in infinite endpoint: {e}")
					cached = [None] * len(keys)
				except Exception as e:
					logger.warning(f"Valkey mget error in infinite endpoint: {e}")
					cached = [None] * len(keys)
			else:
				cached = [None] * len(keys)
			miss_ids = []
			for tid, raw in zip(paged, cached):
				if raw:
					continue
				miss_ids.append(tid)
			if miss_ids:
				q2 = {
					"query": {
						"bool": {
							"must": [
								{"terms": {"traceID": miss_ids}},
								{"bool": {
									"should": [
										{"term": {"tag.user_id": str(user_id)}},
										{"term": {"tag.user_id": username}}
									]
								}}
							]
						}
					},
					"size": 10000
				}
				resp2 = opensearch_analyzer.client.search(index="jaeger-span-*", body=q2)
				by_trace = {}
				for hit in resp2["hits"]["hits"]:
					src = hit["_source"]
					t = src.get("traceID")
					if not t:
						continue
					by_trace.setdefault(t, []).append(src)
				import json
				for t in miss_ids:
					spans = by_trace.get(t, [])
					if not spans:
						continue
					operation = ""
					host = "-"
					os_type = "-"
					for s in spans:
						if not operation:
							operation = s.get("operationName", "")
						if host == "-":
							host = s.get("tag", {}).get("User", "-")
						if os_type == "-":
							os_type = s.get("tag", {}).get("Product", "-")
						if operation and host != "-" and os_type != "-":
							break
					
					unique_rule_ids = set()
					matched_span_count = 0
					for s in spans:
						tag = s.get("tag", {})
						sigma_alert = tag.get("sigma@alert")
						if sigma_alert:
							for rule_id in parse_sigma_alert(sigma_alert):
								unique_rule_ids.add(rule_id)
							matched_span_count += 1
					severity_scores = []
					for sigma_id in unique_rule_ids:
						rule_info = mongo_collection.find_one({"sigma_id": sigma_id}) if (mongo_collection is not None) else None
						if rule_info:
							severity_scores.append(rule_info.get("severity_score", 30))
					avg = sum(severity_scores) / len(severity_scores) if severity_scores else 30
					if avg >= 90:
						sev = "critical"
					elif avg >= 80:
						sev = "high"
					elif avg > 60:
						sev = "medium"
					else:
						sev = "low"
					def _level_weight(lv: str) -> int:
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
					top_title = ""
					matched_rules_for_title = []
					for sigma_id in unique_rule_ids:
						ri = mongo_collection.find_one({"sigma_id": sigma_id}) if (mongo_collection is not None) else None
						if ri:
							matched_rules_for_title.append({
								"sigma_id": sigma_id,
								"level": ri.get("level", "low"),
								"severity_score": ri.get("severity_score", 30),
								"title": ri.get("title", "")
							})
					if matched_rules_for_title:
						top_score = max(r.get("severity_score", 0) for r in matched_rules_for_title)
						cands = [r for r in matched_rules_for_title if r.get("severity_score", 0) == top_score]
						cands.sort(key=lambda r: (-_level_weight(r.get("level", "")), str(r.get("sigma_id", ""))))
						top_title = cands[0].get("title", "") if cands else ""
					sigma_rule_title = top_title or (operation or "-")
					card = {
						"trace_id": t,
						"detected_at": spans[0].get("startTimeMillis", 0),
						"summary": operation or "-",
						"host": host or "-",
						"os": os_type or "-",
						"checked": False,
						"matched_span_count": matched_span_count,
						"matched_rule_unique_count": len(unique_rule_ids),
						"severity": sev,
						"severity_score": avg,
						"user_id": username,
						"sigma_rule_title": sigma_rule_title
					}
					if vk:
						try:
							vk.set(f"trace:{t}", json.dumps(card, ensure_ascii=False))
							vk.expire(f"trace:{t}", 86400)
						except Exception:
							pass

		has_more = offset + limit < total
		return {
			"trace_ids": paged,
			"total": total,
			"offset": offset,
			"limit": limit,
			"hasMore": has_more
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
			except (ValueError, TypeError) as e:
				logger.warning(f"Invalid cursor format: {e}")
			except Exception as e:
				logger.warning(f"Unexpected error parsing cursor: {e}")

		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		alarms = []
		by_trace = {}
		for span in response['hits']['hits']:
			src = span['_source']
			trace_id = src.get("traceID", "")
			if not trace_id:
				continue
			by_trace.setdefault(trace_id, []).append(src)
		
		for trace_id, spans in by_trace.items():
			operation = ""
			host = "-"
			os_type = "-"
			detected_at = 0
			
			for s in spans:
				if not operation:
					operation = s.get("operationName", "")
				if host == "-":
					host = s.get("tag", {}).get("User", "-")
				if os_type == "-":
					os_type = s.get("tag", {}).get("Product", "-")
				if detected_at == 0:
					detected_at = s.get("startTimeMillis", 0)
				if operation and host != "-" and os_type != "-" and detected_at:
					break
			
			alarms.append({
				"trace_id": trace_id,
				"detected_at": to_korea_time(detected_at),
				"summary": operation or "-",
				"host": host,
				"os": os_type,
				"checked": False,
				"user_id": user_id
			})
		
		try:
			from database.database import SessionLocal, LLMAnalysis
			db = SessionLocal()
			try:
				trace_ids = [alarm["trace_id"] for alarm in alarms]
				llm_data = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id.in_(trace_ids)).all()
				llm_map = {item.trace_id: item for item in llm_data}
				
				for alarm in alarms:
					llm_info = llm_map.get(alarm["trace_id"])
					if llm_info:
						if llm_info.score is not None:
							alarm["ai_score"] = llm_info.score
						if llm_info.prediction:
							alarm["ai_decision"] = llm_info.prediction
						if llm_info.summary:
							alarm["ai_summary"] = llm_info.summary
						alarm["checked"] = bool(llm_info.checked) if llm_info.checked is not None else False
			finally:
				db.close()
		except (sqlalchemy.exc.SQLAlchemyError, sqlalchemy.exc.OperationalError) as e:
			logger.warning(f"Database error in LLM analysis: {e}")
		except Exception as e:
			logger.warning(f"Unexpected error in LLM analysis: {e}")
		
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
			sigma_alert = tag.get('sigma@alert')
			if sigma_alert:
				for sigma_alert_id in parse_sigma_alert(sigma_alert):
					if sigma_alert_id not in severity_data:
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


@router.get("/{trace_id}")
async def get_alarm_detail(trace_id: str, request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	"""특정 trace_id의 알람 상세 정보 조회"""
	try:
		opensearch_analyzer = request.app.state.opensearch
		mongo_collection = request.app.state.mongo_collection
		user_id = current_user.get("id")
		username = current_user.get("username")
		
		# OpenSearch에서 trace 데이터 조회
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
			"size": 10000,
			"sort": [{"startTimeMillis": {"order": "asc"}}]
		}
		
		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		
		if not response['hits']['hits']:
			raise HTTPException(status_code=404, detail="Trace not found")
		
		spans = response['hits']['hits']
		events = [span['_source'] for span in spans]
		
		# 기본 정보 추출
		first_span = spans[0]['_source']
		tags = first_span.get('tag', {})
		
		# Severity 계산
		severity_scores = []
		matched_sigma_ids = set()
		for span in spans:
			src = span['_source']
			tag = src.get('tag', {})
			sigma_alert = tag.get('sigma@alert', '')
			if sigma_alert:
				for rule_id in parse_sigma_alert(sigma_alert):
					matched_sigma_ids.add(rule_id)
					rule_info = safe_mongo_find_one(mongo_collection, {"sigma_id": rule_id})
					if rule_info:
						severity_scores.append(rule_info.get('severity_score', 30))
					else:
						severity_scores.append(90)
		
		if severity_scores:
			avg_severity_score = sum(severity_scores) / len(severity_scores)
		else:
			avg_severity_score = 30
		
		if avg_severity_score >= 90:
			severity = "critical"
		elif avg_severity_score >= 80:
			severity = "high"
		elif avg_severity_score > 60:
			severity = "medium"
		else:
			severity = "low"
		
		# LLM 분석 결과 조회
		from database.database import SessionLocal, LLMAnalysis
		db = SessionLocal()
		try:
			llm_analysis = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == trace_id).first()
			
			ai_summary = None
			ai_long_summary = None
			ai_decision = None
			ai_score = None
			ai_mitigation = None
			ai_similar_traces = []
			
			if llm_analysis:
				ai_summary = llm_analysis.summary
				ai_long_summary = llm_analysis.long_summary
				ai_decision = llm_analysis.prediction
				ai_score = llm_analysis.score
				ai_mitigation = llm_analysis.mitigation_suggestions
				
				if llm_analysis.similar_trace_ids:
					try:
						ai_similar_traces = json.loads(llm_analysis.similar_trace_ids) if isinstance(llm_analysis.similar_trace_ids, str) else llm_analysis.similar_trace_ids
					except:
						ai_similar_traces = []
		finally:
			db.close()
		
		# 응답 데이터 구성
		trace_data = {
			"trace_id": trace_id,
			"timestamp": first_span.get('startTime', ''),
			"host": tags.get('ComputerName', tags.get('hostname', 'unknown')),
			"os": tags.get('os', 'unknown'),
			"label": ai_decision if ai_decision else ("anomaly" if matched_sigma_ids else "normal"),
			"severity": severity,
			"events": events,
			"sigma_match": list(matched_sigma_ids),
			"prompt_input": ai_summary or "",
			"ai_summary": ai_summary,
			"ai_long_summary": ai_long_summary,
			"ai_decision": ai_decision,
			"ai_score": ai_score,
			"ai_mitigation": ai_mitigation,
			"ai_similar_traces": ai_similar_traces
		}
		
		return {"data": trace_data}
		
	except HTTPException:
		raise
	except Exception as e:
		logger.error(f"알람 상세 조회 오류: {e}")
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
		processed_rule_ids = set()
		for span in response['hits']['hits']:
			src = span['_source']
			tag = src.get('tag', {})
			sigma_alert = tag.get('sigma@alert', '')
			if sigma_alert:
				for rule_id in parse_sigma_alert(sigma_alert):
					if rule_id in processed_rule_ids:
						continue
					processed_rule_ids.add(rule_id)
					rule_info = mongo_collection.find_one({"sigma_id": rule_id}) if (mongo_collection is not None) else None
					if rule_info:
						severity_score = rule_info.get('severity_score', 30)
						level = rule_info.get('level', 'low')
						title = rule_info.get('title', '')
						severity_scores.append(severity_score)
						matched_rules.append({
							"sigma_id": rule_id,
							"level": level,
							"severity_score": severity_score,
							"title": title
						})
					else:
						severity_scores.append(90)
						matched_rules.append({
							"sigma_id": rule_id,
							"level": "high",
							"severity_score": 90,
							"title": rule_id
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
async def update_alarm_status(payload: AlarmStatusUpdate, request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		from database.database import SessionLocal, LLMAnalysis
		db = SessionLocal()
		try:
			llm_record = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == payload.trace_id).first()
			
			if llm_record:
				llm_record.checked = payload.checked
			else:
				llm_record = LLMAnalysis(
					trace_id=payload.trace_id,
					checked=payload.checked
				)
				db.add(llm_record)
			
			db.commit()
			
			vk = getattr(request.app.state, "valkey", None)
			if vk:
				try:
					cached_data = vk.get(f"trace:{payload.trace_id}")
					if cached_data:
						import json
						alarm_data = json.loads(cached_data)
						alarm_data['checked'] = payload.checked
						vk.set(f"trace:{payload.trace_id}", json.dumps(alarm_data, ensure_ascii=False))
						vk.expire(f"trace:{payload.trace_id}", 86400)
				except (redis.ConnectionError, redis.TimeoutError) as e:
					logger.warning(f"Valkey connection error updating alarm status: {e}")
				except json.JSONDecodeError as e:
					logger.warning(f"JSON decode error updating alarm status: {e}")
				except Exception as e:
					logger.warning(f"Unexpected error updating alarm status: {e}")
			
			return {"success": True, "message": "알림 상태가 업데이트되었습니다."}
		finally:
			db.close()
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/warm-cache")
async def warm_cache(request: Request, limit: int = 200, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		vk = getattr(request.app.state, "valkey", None)
		if not vk:
			raise HTTPException(status_code=500, detail="Valkey 연결이 없습니다.")
		opensearch_analyzer = request.app.state.opensearch
		mongo_collection = request.app.state.mongo_collection
		user_id = current_user["id"]
		username = current_user["username"]

		def unique_trace_ids_from_hits(hits):
			seen = set()
			ids = []
			for h in hits:
				src = h.get("_source", {})
				tid = src.get("traceID")
				if tid and tid not in seen:
					seen.add(tid)
					ids.append(tid)
			return ids

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
			"size": max(limit * 5, 1000),
			"from": 0
		}

		resp = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		candidate_ids = unique_trace_ids_from_hits(resp.get("hits", {}).get("hits", []))[:limit]
		if not candidate_ids:
			return {"warmed": 0, "cached": 0, "total": 0, "ids": []}

		keys = [f"trace:{tid}" for tid in candidate_ids]
		try:
			cached_values = vk.mget(keys)
		except (redis.ConnectionError, redis.TimeoutError) as e:
			logger.warning(f"Valkey connection error in warm-cache: {e}")
			cached_values = [None] * len(keys)
		except Exception as e:
			logger.warning(f"Valkey mget error in warm-cache: {e}")
			cached_values = [None] * len(keys)
		miss_ids = []
		for tid, raw in zip(candidate_ids, cached_values):
			if not raw:
				miss_ids.append(tid)

		def chunk(lst, n):
			for i in range(0, len(lst), n):
				yield lst[i:i+n]

		warmed = 0
		for batch in chunk(miss_ids, 500):
			if not batch:
				continue
			q2 = {
				"query": {
					"bool": {
						"must": [
							{"terms": {"traceID": batch}},
							{"bool": {
								"should": [
									{"term": {"tag.user_id": str(user_id)}},
									{"term": {"tag.user_id": username}}
								]
							}}
						]
					}
				},
				"size": 10000
			}
			resp2 = opensearch_analyzer.client.search(index="jaeger-span-*", body=q2)
			by_trace = {}
			for hit in resp2.get("hits", {}).get("hits", []):
				src = hit.get("_source", {})
				t = src.get("traceID")
				if not t:
					continue
				by_trace.setdefault(t, []).append(src)

			for tid in batch:
				spans = by_trace.get(tid, [])
				if not spans:
					continue
				
				operation = ""
				host = "-"
				os_type = "-"
				for s in spans:
					if not operation:
						operation = s.get("operationName", "")
					if host == "-":
						host = s.get("tag", {}).get("User", "-")
					if os_type == "-":
						os_type = s.get("tag", {}).get("Product", "-")
					if operation and host != "-" and os_type != "-":
						break
				
				unique_rule_ids = set()
				matched_span_count = 0
				for s in spans:
					tag = s.get("tag", {})
					sigma_alert = tag.get("sigma@alert")
					if sigma_alert and sigma_alert.strip():
						try:
							for rule_id in parse_sigma_alert(sigma_alert):
								unique_rule_ids.add(rule_id)
							matched_span_count += 1
						except Exception as e:
							logger.warning(f"Failed to parse sigma alert: {e}")
							continue

				severity_scores = []
				matched_rules = []
				for sigma_id in unique_rule_ids:
					rule_info = mongo_collection.find_one({"sigma_id": sigma_id}) if (mongo_collection is not None) else None
					if rule_info:
						severity_scores.append(rule_info.get("severity_score", 30))
						matched_rules.append({
							"sigma_id": sigma_id,
							"level": rule_info.get("level", "low"),
							"severity_score": rule_info.get("severity_score", 30),
							"title": rule_info.get("title", "")
						})
					else:
						severity_scores.append(90)
						matched_rules.append({
							"sigma_id": sigma_id,
							"level": "high",
							"severity_score": 90,
							"title": sigma_id
						})

				avg = sum(severity_scores) / len(severity_scores) if severity_scores else 30
				if avg >= 90:
					severity = "critical"
				elif avg >= 80:
					severity = "high"
				elif avg > 60:
					severity = "medium"
				else:
					severity = "low"

				def _level_weight(lv: str) -> int:
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
				top_title = ""
				if matched_rules:
					try:
						top_score = max(r.get("severity_score", 0) for r in matched_rules)
					except (ValueError, TypeError) as e:
						logger.warning(f"Severity score calculation error in warm-cache: {e}")
						top_score = 0
					except Exception as e:
						logger.warning(f"Unexpected error calculating top score in warm-cache: {e}")
						top_score = 0
					cands = [r for r in matched_rules if r.get("severity_score", 0) == top_score]
					cands.sort(key=lambda r: (-_level_weight(r.get("level", "")), str(r.get("sigma_id", ""))))
					top_title = cands[0].get("title", "") if cands else ""
				sigma_rule_title = top_title or (operation or "-")

				detected_at_ms = spans[0].get("startTimeMillis", 0)
				card = {
					"trace_id": tid,
					"detected_at": detected_at_ms,
					"summary": operation or "-",
					"host": host or "-",
					"os": os_type or "-",
					"checked": False,
					"matched_span_count": matched_span_count,
					"matched_rule_unique_count": len(unique_rule_ids),
					"severity": severity,
					"severity_score": avg,
					"matched_rules": matched_rules,
					"user_id": username,
					"sigma_rule_title": sigma_rule_title
				}

				try:
					existing_raw = vk.get(f"trace:{tid}")
					if existing_raw:
						try:
							existing = json.loads(existing_raw)
						except json.JSONDecodeError as e:
							logger.warning(f"JSON decode error for existing trace {tid}: {e}")
							existing = {}
						except Exception as e:
							logger.warning(f"Unexpected error parsing existing trace {tid}: {e}")
							existing = {}
						prev_count = int(existing.get("matched_span_count", 0)) if isinstance(existing, dict) else 0
						prev_unique = int(existing.get("matched_rule_unique_count", 0)) if isinstance(existing, dict) else 0
						if card["matched_span_count"] < prev_count:
							card["matched_span_count"] = prev_count
						if card["matched_rule_unique_count"] < prev_unique:
							card["matched_rule_unique_count"] = prev_unique
				except (redis.ConnectionError, redis.TimeoutError) as e:
					logger.warning(f"Valkey connection error checking existing trace {tid}: {e}")
				except Exception as e:
					logger.warning(f"Unexpected error checking existing trace {tid}: {e}")

				try:
					from database.database import SessionLocal, LLMAnalysis
					db = SessionLocal()
					try:
						llm_data = db.query(LLMAnalysis).filter(LLMAnalysis.trace_id == tid).first()
						if llm_data:
							card["ai_summary"] = llm_data.summary
							card["ai_long_summary"] = llm_data.long_summary
							card["ai_mitigation"] = llm_data.mitigation_suggestions
							card["ai_score"] = llm_data.score
							card["ai_decision"] = llm_data.prediction
							card["checked"] = bool(llm_data.checked) if llm_data.checked is not None else False
							if llm_data.similar_trace_ids:
								try:
									card["ai_similar_traces"] = json.loads(llm_data.similar_trace_ids)
								except json.JSONDecodeError as e:
									logger.warning(f"JSON decode error for similar traces {tid}: {e}")
									card["ai_similar_traces"] = []
								except Exception as e:
									logger.warning(f"Unexpected error parsing similar traces {tid}: {e}")
									card["ai_similar_traces"] = []
					finally:
						db.close()
				except (sqlalchemy.exc.SQLAlchemyError, sqlalchemy.exc.OperationalError) as e:
					logger.warning(f"Database error in LLM analysis for trace {tid}: {e}")
				except Exception as e:
					logger.warning(f"Unexpected error in LLM analysis for trace {tid}: {e}")

				try:
					vk.set(f"trace:{tid}", json.dumps(card, ensure_ascii=False))
					vk.expire(f"trace:{tid}", 86400)
					warmed += 1
				except (redis.ConnectionError, redis.TimeoutError) as e:
					logger.warning(f"Valkey connection error saving trace {tid}: {e}")
				except Exception as e:
					logger.warning(f"Valkey save error for trace {tid}: {e}")

		return {"warmed": warmed, "cached": len(candidate_ids) - len(miss_ids), "total": len(candidate_ids), "ids": candidate_ids}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
