from opensearchpy import OpenSearch
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import json
import os
from dotenv import load_dotenv

load_dotenv()

class SecurityLogAnalyzer:
    def __init__(self):
        self.client = OpenSearch(
            hosts=[{'host': os.getenv('OPENSEARCH_HOST', 'localhost'), 'port': 9200}],
            http_auth=(os.getenv('OPENSEARCH_USER', 'admin'), os.getenv('OPENSEARCH_PASSWORD', 'admin')),
            use_ssl=True,
            verify_certs=False,
            ssl_show_warn=False
        )
        
    def create_index(self, index_name):
        """보안 로그를 저장할 인덱스를 생성합니다."""
        index_settings = {
            "settings": {
                "index": {
                    "number_of_shards": 1,
                    "number_of_replicas": 1
                }
            },
            "mappings": {
                "properties": {
                    "timestamp": {"type": "date"},
                    "source_ip": {"type": "ip"},
                    "destination_ip": {"type": "ip"},
                    "event_type": {"type": "keyword"},
                    "severity": {"type": "keyword"},
                    "message": {"type": "text"},
                    "user": {"type": "keyword"},
                    "protocol": {"type": "keyword"},
                    "port": {"type": "integer"},
                    "bytes": {"type": "long"},
                    "status": {"type": "keyword"}
                }
            }
        }
        
        if not self.client.indices.exists(index=index_name):
            self.client.indices.create(index=index_name, body=index_settings)
            
    def ingest_log(self, index_name, log_data):
        """보안 로그를 OpenSearch에 저장합니다."""
        try:
            response = self.client.index(
                index=index_name,
                body=log_data,
                refresh=True
            )
            return response
        except Exception as e:
            print(f"로그 저장 중 오류 발생: {str(e)}")
            return None
            
    def search_logs(self, index_name, query, start_time=None, end_time=None):
        """보안 로그를 검색합니다."""
        search_query = {
            "query": {
                "bool": {
                    "must": [
                        {"query_string": {"query": query}}
                    ]
                }
            }
        }
        
        if start_time and end_time:
            search_query["query"]["bool"]["filter"] = [
                {
                    "range": {
                        "timestamp": {
                            "gte": start_time,
                            "lte": end_time
                        }
                    }
                }
            ]
            
        response = self.client.search(
            index=index_name,
            body=search_query
        )
        return response['hits']['hits']
        
    def detect_anomalies(self, index_name, time_window='1h'):
        """이상 탐지를 수행합니다."""
        # 시간 윈도우 내의 로그 데이터 수집
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=1)
        
        query = {
            "query": {
                "range": {
                    "timestamp": {
                        "gte": start_time.isoformat(),
                        "lte": end_time.isoformat()
                    }
                }
            }
        }
        
        response = self.client.search(
            index=index_name,
            body=query,
            size=1000
        )
        
        # 데이터 전처리
        logs = [hit['_source'] for hit in response['hits']['hits']]
        if not logs:
            return []
            
        df = pd.DataFrame(logs)
        
        # 이상 탐지 모델 학습 및 예측
        model = IsolationForest(contamination=0.1, random_state=42)
        features = df[['bytes', 'port']].fillna(0)
        df['anomaly_score'] = model.fit_predict(features)
        
        # 이상 탐지된 로그 반환
        anomalies = df[df['anomaly_score'] == -1].to_dict('records')
        return anomalies
        
    def get_security_metrics(self, index_name, time_window='1h'):
        """보안 메트릭을 계산합니다."""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=1)
        
        # 기본 집계 쿼리
        query = {
            "size": 0,
            "query": {
                "range": {
                    "timestamp": {
                        "gte": start_time.isoformat(),
                        "lte": end_time.isoformat()
                    }
                }
            },
            "aggs": {
                "total_events": {"value_count": {"field": "_id"}},
                "severity_distribution": {"terms": {"field": "severity"}},
                "event_types": {"terms": {"field": "event_type"}},
                "top_source_ips": {"terms": {"field": "source_ip", "size": 10}},
                "top_destination_ips": {"terms": {"field": "destination_ip", "size": 10}}
            }
        }
        
        response = self.client.search(
            index=index_name,
            body=query
        )
        
        return response['aggregations']

if __name__ == "__main__":
    analyzer = SecurityLogAnalyzer()
    analyzer.create_index("security-logs") 