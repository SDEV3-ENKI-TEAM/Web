import os
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from opensearchpy import OpenSearch

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
        """OpenSearch 클라이언트를 초기화합니다."""
        if not hosts:
            opensearch_host = os.getenv('OPENSEARCH_HOST')
            opensearch_port = int(os.getenv('OPENSEARCH_PORT'))
            opensearch_use_ssl = os.getenv('OPENSEARCH_USE_SSL', 'false').lower() == 'true'
            opensearch_verify_certs = os.getenv('OPENSEARCH_VERIFY_CERTS', 'false').lower() == 'true'

            opensearch_username = os.getenv('OPENSEARCH_USERNAME')
            opensearch_password = os.getenv('OPENSEARCH_PASSWORD')

            if opensearch_host and isinstance(opensearch_host, str):
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
                        'NetworkConnect': '네트워크 연결',
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
        
        return raw_name if raw_name else 'unknown'

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
            'sigma@alert' in tags or
            tags.get('error') == 'true' or
            tags.get('error') is True or
            (str(tags.get('otel@status_code', '')).upper() == 'ERROR') or
            'alert' in tags or
            tags.get('sigma.alert') or
            tags.get('sigma@alert') or
            tags.get('alert') or
            tags.get('sigma_alert')
        )

        alert_message = (
            tags.get('sigma.alert') or
            tags.get('sigma@alert') or
            tags.get('sigma@rule_title') or
            tags.get('alert') or
            tags.get('sigma_alert') or
            tags.get('RuleName') or
            tags.get('otel@status_description') or
            tags.get('FormattedMessage') or
            tags.get('message') or
            (tags.get('error') if tags.get('error') is not True else 'Suspicious activity detected') or
            ''
        )
        
        korean_timestamp = tags.get('TimeStamp', '')
        if korean_timestamp:
            converted_timestamp = self.convert_korean_timestamp(korean_timestamp)
            final_timestamp = converted_timestamp
        else:
            final_timestamp = tags.get('UtcTime') or tags.get('timestamp') or str(source.get('startTime', 0))

        return {
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
            "sigma_alert": tags.get('sigma@alert') or tags.get('sigma.alert') or tags.get('sigma_alert') or '',
            "sigma_rule_title": tags.get('sigma@rule_title') or '',
            "otel_status_code": tags.get('otel@status_code') or '',
            "otel_status_description": tags.get('otel@status_description') or '',
            "has_alert": has_alert,
            "alert_message": alert_message,
            "severity": "high" if has_alert else "low",
            "operation_name": source.get('operationName', ''),
            "duration": source.get('duration', 0),
            "all_tags": tags
        }
    
    def get_process_tree_events(self, trace_id: str) -> List[Dict]:
        query = {
            "query": {"term": {"traceID": trace_id}},
            "sort": [{"startTimeMillis": {"order": "asc"}}],
            "size": 1000
        }
        try:
            response = self.client.search(index="jaeger-span-*", body=query)
            all_spans = response['hits']['hits']
            all_spans.sort(key=lambda x: x['_source'].get('startTimeMillis', 0))
        except Exception as e:
            print(f"검색 실패: {e}")
            return []
        events: List[Dict] = []
        for span in all_spans:
            source = span['_source']
            events.append(source)
        return events
    
    def get_sysmon_event_type(self, event_id: str) -> str:
        """Sysmon 이벤트 ID를 이벤트 타입으로 변환합니다."""
        if not event_id:
            return "unknown"
        
        event_types = {
            "1": "process_creation",
            "2": "file_time_change",
            "3": "network_connection",
            "4": "sysmon_service_state_change",
            "5": "process_termination",
            "6": "driver_load",
            "7": "image_load",
            "8": "create_remote_thread",
            "9": "raw_access_read",
            "10": "process_access",
            "11": "file_create",
            "12": "registry_create_delete",
            "13": "registry_value_set",
            "14": "registry_object_rename",
            "15": "file_create_stream_hash",
            "16": "service_config_change",
            "17": "pipe_created",
            "18": "pipe_connected",
            "19": "wmi_event",
            "20": "wmi_consumer",
            "21": "wmi_consumer_filter",
            "22": "dns_query",
            "23": "file_delete",
            "24": "clipboard_change",
            "25": "process_tampering",
            "26": "file_delete_detected",
            "27": "file_block_executable",
            "28": "file_block_shredding"
            }
    
        return event_types.get(event_id, "unknown")

    def get_sysmon_event_type_korean(self, event_id: str) -> str:
        """Sysmon 이벤트 ID를 한국어 이벤트 타입으로 변환합니다."""
        if not event_id:
            return "알 수 없음"
        
        korean_event_types = {
            "1": "프로세스 생성",
            "2": "파일 시간 변경",
            "3": "네트워크 연결",
            "4": "Sysmon 서비스 상태 변경",
            "5": "프로세스 종료",
            "6": "드라이버 로드",
            "7": "이미지 로드",
            "8": "원격 스레드 생성",
            "9": "원시 액세스 읽기",
            "10": "프로세스 액세스",
            "11": "파일 생성",
            "12": "레지스트리 생성/삭제",
            "13": "레지스트리 값 설정",
            "14": "레지스트리 객체 이름 변경",
            "15": "파일 생성 스트림 해시",
            "16": "서비스 구성 변경",
            "17": "파이프 생성",
            "18": "파이프 연결",
            "19": "WMI 이벤트",
            "20": "WMI 소비자",
            "21": "WMI 소비자 필터",
            "22": "DNS 쿼리",
            "23": "파일 삭제",
            "24": "클립보드 변경",
            "25": "프로세스 조작",
            "26": "파일 삭제 감지",
            "27": "실행 파일 차단",
            "28": "파일 파쇄 차단"
        }
        
        return korean_event_types.get(event_id, "알 수 없음")
    

    
 