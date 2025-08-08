from opensearchpy import OpenSearch
from typing import Dict, List
from dotenv import load_dotenv
import os
from pathlib import Path

try:
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path, encoding='utf-8')
except Exception as e:
    print(f".env 파일 로드 중 오류: {e}")
    try:
        load_dotenv(env_path, encoding='cp949')
    except Exception as e2:
        print(f"cp949 인코딩도 실패: {e2}")
        load_dotenv()

class OpenSearchAnalyzer:
    def __init__(self, hosts=None):
        """OpenSearch 클라이언트를 초기화합니다 (AWS OpenSearch용)."""
        if not hosts:
            opensearch_host = os.getenv('OPENSEARCH_HOST', 'localhost')
            opensearch_port = int(os.getenv('OPENSEARCH_PORT', 9200))
            opensearch_use_ssl = os.getenv('OPENSEARCH_USE_SSL', 'false').lower() == 'true'
            opensearch_verify_certs = os.getenv('OPENSEARCH_VERIFY_CERTS', 'false').lower() == 'true'

            aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
            aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
            aws_region = os.getenv('AWS_REGION', 'ap-northeast-2')

            opensearch_username = os.getenv('OPENSEARCH_USERNAME')
            opensearch_password = os.getenv('OPENSEARCH_PASSWORD')

            if opensearch_host.startswith('https://'):
                opensearch_host = opensearch_host.replace('https://', '')
            elif opensearch_host.startswith('http://'):
                opensearch_host = opensearch_host.replace('http://', '')
            
            hosts = [{'host': opensearch_host, 'port': opensearch_port}]
            
            http_auth = (opensearch_username, opensearch_password) if opensearch_username and opensearch_password else None
        
        self.client = OpenSearch(
            hosts=hosts,
            http_auth=http_auth,
            http_compress=True,
            use_ssl=opensearch_use_ssl,
            verify_certs=opensearch_verify_certs,
            ssl_assert_hostname=False,
            ssl_show_warn=False,
            timeout=30,
            max_retries=3,
            retry_on_timeout=True
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
        return events
    
    def test_connection(self) -> Dict:
        """AWS OpenSearch 연결을 테스트합니다."""
        try:
            # 클러스터 정보 가져오기
            info = self.client.info()
            
            # 인덱스 목록 가져오기
            indices = self.client.cat.indices(format="json")
            
            return {
                "status": "success",
                "message": "AWS OpenSearch 연결 성공",
                "cluster_info": {
                    "cluster_name": info.get('cluster_name', 'unknown'),
                    "version": info.get('version', {}).get('number', 'unknown')
                },
                "indices_count": len(indices),
                "indices": [index['index'] for index in indices[:10]]  # 처음 10개만
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"AWS OpenSearch 연결 실패: {str(e)}",
                "error_details": str(e)
            }
    
    def get_connection_info(self) -> Dict:
        """현재 연결 설정 정보를 반환합니다."""
        import os
        return {
            "host": os.getenv('OPENSEARCH_HOST', 'localhost'),
            "port": os.getenv('OPENSEARCH_PORT', '9200'),
            "use_ssl": os.getenv('OPENSEARCH_USE_SSL', 'false'),
            "verify_certs": os.getenv('OPENSEARCH_VERIFY_CERTS', 'false'),
            "region": os.getenv('AWS_REGION', 'ap-northeast-2'),
            "has_aws_credentials": bool(os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY')),
            "has_basic_auth": bool(os.getenv('OPENSEARCH_USERNAME') and os.getenv('OPENSEARCH_PASSWORD'))
        }
    
 