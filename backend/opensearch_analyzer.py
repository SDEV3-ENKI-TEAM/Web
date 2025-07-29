from opensearchpy import OpenSearch
import json
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

class OpenSearchAnalyzer:
    def __init__(self, hosts=None):
        """OpenSearch 클라이언트를 초기화합니다 (EventAgent용)."""
        if not hosts:
            hosts = [{'host': 'localhost', 'port': 9200}]
        
        self.client = OpenSearch(
            hosts=hosts,
            http_compress=True,
            use_ssl=False,
            verify_certs=False,
            ssl_assert_hostname=False,
            ssl_show_warn=False
        )
        
    def check_jaeger_indices(self) -> Dict:
        """Jaeger 관련 인덱스 상태를 확인합니다."""
        try:
            
            indices = self.client.cat.indices(index="jaeger-*", format="json")
            
            if not indices:
                return {
                    "status": "warning", 
                    "message": "Jaeger 인덱스가 존재하지 않습니다. EventAgent가 실행 중인지 확인하세요."
                }
            
            total_docs = 0
            index_info = []
            
            for index in indices:
                index_name = index['index']
                doc_count = int(index['docs.count']) if index['docs.count'] != 'null' else 0
                total_docs += doc_count
                
                index_info.append({
                    "name": index_name,
                    "doc_count": doc_count,
                    "store_size": index['store.size'],
                    "status": index['status']
                })
            
            return {
                "status": "success",
                "total_documents": total_docs,
                "indices": index_info
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def get_jaeger_spans(self, limit: int = 100, offset: int = 0) -> Dict:
        """Jaeger 스팬 데이터를 가져옵니다."""
        query = {
            "query": {"match_all": {}},
            "sort": [{"startTime": {"order": "desc"}}],
            "size": limit,
            "from": offset
        }
        
        try:
            response = self.client.search(index="jaeger-span-*", body=query)
            return {
                "hits": response['hits']['hits'],
                "total": response['hits']['total']['value'] if 'total' in response['hits'] else len(response['hits']['hits'])
            }
        except Exception as e:
            print(f"Jaeger 스팬 검색 오류: {e}")
            return {"hits": [], "total": 0}
    
    def get_sigma_alerts(self, limit: int = 50) -> Dict:
        """Sigma 룰 매칭된 스팬을 조회합니다."""
        query = {
            "query": {
                "bool": {
                    "should": [
                        {"exists": {"field": "tags.sigma.alert"}},
                        {"term": {"tags.error": True}},
                        {"nested": {
                            "path": "tags",
                            "query": {
                                "bool": {
                                    "must": [
                                        {"term": {"tags.key": "sigma.alert"}},
                                        {"exists": {"field": "tags.value"}}
                                    ]
                                }
                            }
                        }}
                    ]
                }
            },
            "sort": [{"startTime": {"order": "desc"}}],
            "size": limit
        }
        
        try:
            response = self.client.search(index="jaeger-span-*", body=query)
            return {
                "hits": response['hits']['hits'],
                "total": response['hits']['total']['value'] if 'total' in response['hits'] else len(response['hits']['hits'])
            }
        except Exception as e:
            print(f"Sigma 알럿 검색 오류: {e}")
            return {"hits": [], "total": 0}
    
    def extract_process_from_operation_name(self, operation_name: str) -> str:
        """operationName에서 프로세스 정보를 추출합니다."""
        if not operation_name:
            return ""

        if 'pid:' in operation_name:
            import re
            pid_match = re.search(r'pid:(\d+)', operation_name)
            if pid_match:
                pid = pid_match.group(1)
                
                evt_match = re.search(r'evt:(\d+)', operation_name)
                if evt_match:
                    event_id = evt_match.group(1)
                    event_type = self.get_sysmon_event_type(event_id)

                    korean_event_types = {
                        'process_creation': '프로세스 생성',
                        'process_termination': '프로세스 종료',
                        'network_connection': '네트워크 연결',
                        'file_write': '파일 쓰기',
                        'registry_modification': '레지스트리 수정',
                        'file_access': '파일 접근'
                    }
                    
                    return korean_event_types.get(event_type, f"PID {pid}")
        
        if operation_name.startswith('process:'):
            pid = operation_name.replace('process:', '')
            return f"프로세스 {pid}"
        
        return ""

    def extract_event_id_from_operation_name(self, operation_name: str) -> str:
        """operationName에서 이벤트 ID를 추출합니다."""
        if not operation_name:
            return ""
        import re
        evt_match = re.search(r'evt:\s*(\d+)', operation_name)
        if evt_match:
            return evt_match.group(1)
        return ""

    def clean_process_name(self, raw_name: str) -> str:
        """프로세스 이름을 정리합니다."""
        if not raw_name or raw_name == 'unknown':
            return 'unknown'
        
        import os
        import re
        
        if '\\' in raw_name or '/' in raw_name:
            filename = os.path.basename(raw_name)
            raw_name = filename
        
        raw_name = re.sub(r'[()[\]{}]', '', raw_name)
        
        raw_name = raw_name.strip()

        cleaned_name = raw_name if raw_name else 'unknown'
        
        print(f"   🧹 최종 정리된 이름: '{cleaned_name}'")
        return cleaned_name

    def convert_korean_timestamp(self, korean_time: str) -> str:
        """한국어 시간 형식을 JavaScript가 읽을 수 있는 형식으로 변환합니다."""
        if not korean_time:
            return ""
        
        try:
            import re
            
            pattern = r'(\d{4}-\d{2}-\d{2}) (오전|오후) (\d{1,2}):(\d{2}):(\d{2})'
            match = re.match(pattern, korean_time)
            
            if match:
                date_part = match.group(1)
                ampm = match.group(2)
                hour = int(match.group(3))
                minute = match.group(4)
                second = match.group(5)

                if ampm == "오후" and hour != 12:
                    hour += 12
                elif ampm == "오전" and hour == 12:
                    hour = 0

                hour_str = f"{hour:02d}"
                
                return f"{date_part} {hour_str}:{minute}:{second}"
            else:
                return korean_time
                
        except Exception as e:
            print(f"한국어 시간 변환 오류: {e}")
            return korean_time

    def get_sysmon_event_type_korean(self, event_id: str) -> str:
        """Sysmon Event ID를 한국어 이벤트 타입으로 변환합니다."""
        korean_event_map = {
            "1": "프로세스 실행",
            "2": "파일 시간 변경", 
            "3": "네트워크 연결",
            "4": "Sysmon 서비스 상태",
            "5": "프로세스 종료",
            "6": "드라이버 로드",
            "7": "이미지 로드",
            "8": "원격 스레드 생성",
            "9": "파일 직접 접근",
            "10": "프로세스 접근",
            "11": "파일 쓰기",
            "12": "레지스트리 이벤트",
            "13": "레지스트리 값 설정",
            "14": "레지스트리 키 이름변경",
            "15": "파일 스트림 생성",
            "16": "서비스 설정 변경",
            "17": "파이프 생성",
            "18": "파이프 연결",
            "19": "WMI 이벤트 필터",
            "20": "WMI 이벤트 컨슈머",
            "21": "WMI 컨슈머 필터",
            "22": "DNS 이벤트",
            "23": "파일 삭제",
            "24": "클립보드 변경",
            "25": "프로세스 변조",
            "26": "파일 삭제 탐지"
        }
        result = korean_event_map.get(str(event_id), f"이벤트 {event_id}")
        return result

    def get_sysmon_event_type(self, event_id: str) -> str:
        """Sysmon Event ID를 이벤트 타입으로 변환합니다."""
        event_map = {
            "1": "process_creation",
            "2": "file_change_time", 
            "3": "network_connection",
            "4": "sysmon_service_state",
            "5": "process_termination",
            "6": "driver_loaded",
            "7": "image_loaded",
            "8": "create_remote_thread",
            "9": "raw_access_read",
            "10": "process_access",
            "11": "file_write",
            "12": "registry_event",
            "13": "registry_value_set",
            "14": "registry_key_rename",
            "15": "file_stream_created",
            "16": "service_configuration_change",
            "17": "pipe_created",
            "18": "pipe_connected",
            "19": "wmi_event_filter",
            "20": "wmi_event_consumer",
            "21": "wmi_event_consumer_filter",
            "22": "dns_event",
            "23": "file_delete",
            "24": "clipboard_changed",
            "25": "process_tampering",
            "26": "file_delete_detected"
        }
        return event_map.get(str(event_id), "unknown_event")
    
    def transform_jaeger_span_to_event(self, span: Dict) -> Dict:
        """Jaeger 스팬을 Events 페이지 형식으로 변환합니다."""
        source = span.get('_source', {})
        
        tags = {}

        if 'tags' in source:
            for tag in source['tags']:
                if isinstance(tag, dict) and 'key' in tag and 'value' in tag:
                    tags[tag['key']] = tag['value']

        if 'tag' in source and isinstance(source['tag'], dict):
            tags.update(source['tag'])
        

        raw_process_name = (
            tags.get('Image') or 
            tags.get('OriginalFileName') or 
            tags.get('image') or 
            tags.get('process.name') or 
            tags.get('proc.name') or
            source.get('process', {}).get('serviceName') or
            self.extract_process_from_operation_name(source.get('operationName', '')) or
            'unknown'
        )

        process_name = self.clean_process_name(raw_process_name)
        
        
        sysmon_event_id = (
            tags.get('sysmon@event_id') or  
            tags.get('sysmon.event_id') or 
            tags.get('ID') or              
            tags.get('EventID') or 
            tags.get('event_id') or
            tags.get('eventId') or
            self.extract_event_id_from_operation_name(source.get('operationName', '')) or
            ''
        )
        
        has_alert = (
            'sigma.alert' in tags or 
            tags.get('error') == 'true' or
            tags.get('error') == True or
            'alert' in tags or
            tags.get('sigma.alert') or
            tags.get('alert') or
            tags.get('sigma_alert')
        )
        
        alert_message = (
            tags.get('sigma.alert') or 
            tags.get('alert') or 
            tags.get('sigma_alert') or
            tags.get('RuleName') or
            tags.get('FormattedMessage') or
            tags.get('message') or
            (tags.get('error') if tags.get('error') != True else 'Suspicious activity detected') or
            ''
        )
        
        korean_timestamp = tags.get('TimeStamp', '')
        if korean_timestamp:
            converted_timestamp = self.convert_korean_timestamp(korean_timestamp)
            final_timestamp = converted_timestamp
        else:
            final_timestamp = tags.get('UtcTime') or tags.get('timestamp') or str(source.get('startTime', 0))

        result = {
            "event_id": span.get('_id', ''),
            "trace_id": source.get('traceID', ''),
            "span_id": source.get('spanID', ''),
            "timestamp": final_timestamp,
            "process_name": process_name,
            "event_type": self.get_sysmon_event_type(sysmon_event_id),
            "korean_event_type": self.get_sysmon_event_type_korean(sysmon_event_id),
            "sysmon_event_id": sysmon_event_id,
            "command_line": tags.get('CommandLine') or tags.get('command_line') or '',
            "parent_process": tags.get('ParentImage') or tags.get('parent_image') or '',
            "parent_command_line": tags.get('ParentCommandLine') or tags.get('parent_command_line') or '',
            "file_path": tags.get('TargetFilename') or tags.get('FileName') or tags.get('file_path') or '',
            "destination_ip": tags.get('DestinationIp') or tags.get('destination_ip') or '',
            "destination_port": tags.get('DestinationPort') or tags.get('destination_port') or '',
            "user": tags.get('User') or tags.get('user') or '',
            "has_alert": has_alert,
            "alert_message": alert_message,
            "severity": "high" if has_alert else "low",
            "operation_name": source.get('operationName', ''),
            "duration": source.get('duration', 0),
            "all_tags": tags
        }
        
        return result
    
    def get_process_tree_events(self, trace_id: str) -> List[Dict]:
        """특정 트레이스의 프로세스 트리 이벤트를 가져옵니다."""
        
        query = {
            "query": {
                "term": {
                    "traceID": trace_id
                }
            },
            "sort": [{"startTime": {"order": "asc"}}],
            "size": 100
        }
        
        try:
            response = self.client.search(index="jaeger-span-*", body=query)
            all_spans = response['hits']['hits']
            all_spans.sort(key=lambda x: x['_source'].get('startTime', 0))
        except Exception as e:
            print(f"검색 실패: {e}")
            return []
        
        events = []
        for i, span in enumerate(all_spans):
            source = span['_source']
            events.append(source)
        print(f"[DEBUG] 반환되는 이벤트 개수: {len(events)}")
        return events
    
    def get_event_statistics(self) -> Dict:
        """이벤트 통계를 가져옵니다."""
        try:
            total_query = {"query": {"match_all": {}}}
            total_response = self.client.count(index="jaeger-span-*", body=total_query)
    
            alert_query = {
                "query": {
                    "bool": {
                        "should": [
                            {"exists": {"field": "tags.sigma.alert"}},
                            {"term": {"tags.error": True}}
                        ]
                    }
                }
            }
            alert_response = self.client.count(index="jaeger-span-*", body=alert_query)

            agg_query = {
                "aggs": {
                    "event_types": {
                        "terms": {
                            "field": "operationName.keyword",
                            "size": 20
                        }
                    },
                    "process_images": {
                        "nested": {
                            "path": "tags"
                        },
                        "aggs": {
                            "images": {
                                "terms": {
                                    "field": "tags.value.keyword",
                                    "size": 10
                                }
                            }
                        }
                    }
                },
                "size": 0
            }
            
            agg_response = self.client.search(index="jaeger-span-*", body=agg_query)
            
            return {
                "total_spans": total_response['count'],
                "total_alerts": alert_response['count'],
                "event_types": agg_response.get('aggregations', {}).get('event_types', {}).get('buckets', []),
                "process_images": agg_response.get('aggregations', {}).get('process_images', {}).get('images', {}).get('buckets', [])
            }
        except Exception as e:
            print(f"통계 조회 오류: {e}")
            return {
                "total_spans": 0,
                "total_alerts": 0,
                "event_types": [],
                "process_images": []
            } 