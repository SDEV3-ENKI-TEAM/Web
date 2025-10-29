import sys
from datetime import datetime
from pathlib import Path

backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, Depends, HTTPException, Request

import sqlalchemy.exc
import logging

from utils.auth_deps import get_current_user_with_roles

router = APIRouter(prefix="/metrics", tags=["metrics"], dependencies=[Depends(get_current_user_with_roles)])
logger = logging.getLogger(__name__)


@router.get("/timeseries")
async def get_timeseries(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user.get("id")
		username = current_user.get("username")
		query = {
			"query": {"match_all": {}},
			"size": 0,
			"aggs": {
				"trace_groups": {
					"terms": {"field": "traceID", "size": 10000},
					"aggs": {
						"min_start": {"min": {"field": "startTimeMillis"}},
						"total_duration": {"sum": {"field": "duration"}},
						"span_count": {"value_count": {"field": "traceID"}},
						"sigma_hit": {"filter": {"exists": {"field": "tag.sigma@alert"}}}
					}
				}
			}
		}
		query["query"] = {
			"bool": {
				"must": [
					{"bool": {
						"should": [
							{"term": {"tag.user_id": str(user_id)}},
							{"term": {"tag.user_id": username}}
						]
					}}
				]
			}
		}
		response = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		buckets = response.get('aggregations', {}).get('trace_groups', {}).get('buckets', [])
		result = []
		for b in buckets:
			min_start = b.get('min_start', {}).get('value')
			if min_start is None:
				continue
			timestamp = datetime.fromtimestamp(min_start / 1000).strftime('%Y-%m-%dT%H:%M:%S')
			result.append({
				"timestamp": timestamp,
				"duration": int(b.get('total_duration', {}).get('value', 0)),
				"trace_id": b.get('key'),
				"span_count": int(b.get('span_count', {}).get('value', 0)),
				"has_anomaly": (b.get('sigma_hit', {}).get('doc_count', 0) > 0),
				"operation_name": "",
				"service_name": ""
			})
		result.sort(key=lambda x: x['timestamp'])
		if len(result) > 30:
			step = len(result) // 30
			result = result[::step]
		return result
	except (ValueError, TypeError, KeyError) as e:
		logger.error(f"Timeseries 데이터 처리 오류: {e}")
		raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")
	except Exception as e:
		logger.error(f"Timeseries 예상치 못한 오류: {e}")
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/donut-stats")
async def get_donut_stats_from_mysql(current_user: dict = Depends(get_current_user_with_roles)):
    try:
        from database.database import SessionLocal, LLMAnalysis
        db = SessionLocal()
        try:
            uid = str(current_user.get("id")) if current_user.get("id") is not None else None
            uname = current_user.get("username")

            q = db.query(LLMAnalysis)
            if uid or uname:
                from sqlalchemy import or_
                filters = []
                if uid:
                    filters.append(LLMAnalysis.user_id == uid)
                if uname:
                    filters.append(LLMAnalysis.user_id == uname)
                if filters:
                    q = q.filter(or_(*filters))
        
            total = q.count()
            benign_count = q.filter(LLMAnalysis.prediction == "benign").count()
            malicious_count = q.filter(LLMAnalysis.prediction == "malicious").count()

            normal_traces = benign_count
            anomaly_traces = malicious_count

            normal_percentage = round((normal_traces / total) * 100, 1) if total > 0 else 0
            anomaly_percentage = round((anomaly_traces / total) * 100, 1) if total > 0 else 0

            return {
                "normalCount": normal_traces,
                "anomalyCount": anomaly_traces,
                "total": total,
                "normalPercentage": normal_percentage,
                "anomalyPercentage": anomaly_percentage,
                "processed": total,
                "failed": 0,
            }
        finally:
            db.close()
    except (sqlalchemy.exc.SQLAlchemyError, sqlalchemy.exc.OperationalError) as e:
        logger.error(f"Database error in donut-stats: {e}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in donut-stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trace-stats")
async def get_trace_stats(current_user: dict = Depends(get_current_user_with_roles)):
	from database.database import SessionLocal, LLMAnalysis
	from sqlalchemy import or_, func
	db = SessionLocal()
	try:
		uid = current_user.get("id")
		uname = current_user.get("username")
		q = db.query(LLMAnalysis)
		filters = []
		if uid is not None:
			filters.append(LLMAnalysis.user_id == str(uid))
		if uname:
			filters.append(LLMAnalysis.user_id == uname)
		if filters:
			q = q.filter(or_(*filters))

		total_traces = q.count()
		malicious_count = q.filter(LLMAnalysis.prediction == "malicious").count()
		unchecked_count = q.filter(LLMAnalysis.prediction == None).count()

		return {
			"totalTraces": total_traces,
			"sigmaMatchedTraces": malicious_count,
			"unchecked": unchecked_count,
		}
	except (sqlalchemy.exc.SQLAlchemyError, sqlalchemy.exc.OperationalError) as e:
		logger.error(f"Database error in trace-stats: {e}")
		raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {str(e)}")
	except Exception as e:
		logger.error(f"Unexpected error in trace-stats: {e}")
		raise HTTPException(status_code=500, detail=str(e))
	finally:
		db.close()


@router.get("/bar-chart")
async def get_bar_chart_data(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user["id"]
		username = current_user["username"]
		query = {
			"query": {
				"bool": {
					"must": [
						{"bool": {
							"should": [
								{"term": {"tag.user_id": str(user_id)}},
								{"term": {"tag.user_id": username}}
							]
						}}
					],
					"should": [
						{"term": {"tag.error": True}},
						{"exists": {"field": "tag.sigma@alert"}}
					]
				}
			},
			"sort": [{"startTime": {"order": "desc"}}],
			"size": 1000
		}
		spans_data = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		user_stats = {}
		for span in spans_data['hits']['hits']:
			src = span['_source']
			user = src.get('tag', {}).get('user', 'unknown')
			if user not in user_stats:
				user_stats[user] = {'normalCount': 0, 'anomalyCount': 0}
			user_stats[user]['anomalyCount'] += 1
		sorted_users = sorted(
			user_stats.items(),
			key=lambda x: x[1]['normalCount'] + x[1]['anomalyCount'],
			reverse=True
		)[:5]
		return [
			{
				'user': user,
				'normalCount': stats['normalCount'],
				'anomalyCount': stats['anomalyCount']
			}
			for user, stats in sorted_users
		]
	except (ValueError, TypeError, KeyError) as e:
		logger.error(f"Bar chart 데이터 처리 오류: {e}")
		raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")
	except Exception as e:
		logger.error(f"Unexpected error in bar-chart: {e}")
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/heatmap")
async def get_heatmap_data(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		user_id = current_user["id"]
		username = current_user["username"]
		query = {
			"query": {
				"bool": {
					"must": [
						{"bool": {
							"should": [
								{"term": {"tag.user_id": str(user_id)}},
								{"term": {"tag.user_id": username}}
							]
						}}
					],
					"should": [
						{"term": {"tag.error": True}},
						{"exists": {"field": "tag.sigma@alert"}}
					]
				}
			},
			"sort": [{"startTime": {"order": "desc"}}],
			"size": 1000
		}
		spans_data = opensearch_analyzer.client.search(index="jaeger-span-*", body=query)
		time_stats = {}
		for span in spans_data['hits']['hits']:
			src = span['_source']
			start_time = src.get('startTimeMillis', 0)
			if start_time > 0:
				hour = datetime.fromtimestamp(start_time / 1000).hour
				if hour not in time_stats:
					time_stats[hour] = 0
				time_stats[hour] += 1
		heatmap_data = []
		for hour in range(24):
			count = time_stats.get(hour, 0)
			heatmap_data.append({'hour': hour, 'count': count})
		return heatmap_data
	except (ValueError, TypeError, KeyError) as e:
		logger.error(f"Heatmap 데이터 처리 오류: {e}")
		raise HTTPException(status_code=500, detail=f"데이터 처리 오류: {str(e)}")
	except Exception as e:
		logger.error(f"Unexpected error in heatmap: {e}")
		raise HTTPException(status_code=500, detail=str(e))
