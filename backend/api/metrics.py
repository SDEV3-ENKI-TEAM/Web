from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from utils.auth_deps import get_current_user_with_roles

router = APIRouter(prefix="/metrics", tags=["metrics"], dependencies=[Depends(get_current_user_with_roles)])


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
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/donut-stats")
async def get_donut_stats(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
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
						"has_sigma_alert": {"terms": {"field": "tag.sigma@alert"}}
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
		trace_stats = response.get('aggregations', {}).get('trace_groups', {}).get('buckets', [])
		total_traces = len(trace_stats)
		anomaly_traces = 0
		for trace_bucket in trace_stats:
			has_sigma_alert = len(trace_bucket.get('has_sigma_alert', {}).get('buckets', [])) > 0
			if has_sigma_alert:
				anomaly_traces += 1
		normal_traces = total_traces - anomaly_traces
		normal_percentage = round((normal_traces / total_traces) * 100, 1) if total_traces > 0 else 0
		anomaly_percentage = round((anomaly_traces / total_traces) * 100, 1) if total_traces > 0 else 0
		return {
			"normalCount": normal_traces,
			"anomalyCount": anomaly_traces,
			"total": total_traces,
			"normalPercentage": normal_percentage,
			"anomalyPercentage": anomaly_percentage,
			"processed": total_traces,
			"failed": 0
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.get("/trace-stats")
async def get_trace_stats(request: Request, current_user: dict = Depends(get_current_user_with_roles)):
	try:
		opensearch_analyzer = request.app.state.opensearch
		query = {
			"query": {"match_all": {}},
			"sort": [{"startTime": {"order": "desc"}}],
			"size": 0,
			"aggs": {
				"trace_groups": {
					"terms": {"field": "traceID", "size": 10000},
					"aggs": {
						"has_sigma_alert": {"terms": {"field": "tag.sigma@alert"}}
					}
				}
			}
		}
		user_id = current_user["id"]
		username = current_user["username"]
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
		trace_stats = response.get('aggregations', {}).get('trace_groups', {}).get('buckets', [])
		total_traces = len(trace_stats)
		sigma_traces = 0
		for trace_bucket in trace_stats:
			has_sigma_alert = len(trace_bucket.get('has_sigma_alert', {}).get('buckets', [])) > 0
			if has_sigma_alert:
				sigma_traces += 1
		return {
			"totalTraces": total_traces,
			"sigmaMatchedTraces": sigma_traces
		}
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


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
	except Exception as e:
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
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
