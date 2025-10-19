#!/usr/bin/env python3
"""
OpenSearch 연결 테스트 스크립트
독립적으로 실행 가능한 간단한 연결 확인 도구
"""

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    from opensearchpy import OpenSearch
    from opensearchpy.exceptions import ConnectionError, AuthenticationException
except ImportError as e:
    print(f"❌ 필요한 패키지가 설치되어 있지 않습니다: {e}")
    print("다음 명령어로 설치하세요: pip install opensearch-py python-dotenv")
    sys.exit(1)

# .env 파일 로드
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    try:
        load_dotenv(env_path, encoding='utf-8')
        print(f"✅ .env 파일 로드: {env_path}")
    except Exception as e:
        try:
            load_dotenv(env_path, encoding='cp949')
            print(f"✅ .env 파일 로드 (cp949): {env_path}")
        except Exception as e2:
            print(f"⚠️  .env 파일 로드 실패, 환경 변수 사용: {e2}")
            load_dotenv()
else:
    print(f"⚠️  .env 파일이 없습니다: {env_path}")
    print("환경 변수를 사용합니다.")


def test_opensearch_connection():
    """OpenSearch 연결을 테스트합니다."""
    
    print("\n" + "="*60)
    print("OpenSearch 연결 테스트")
    print("="*60 + "\n")
    
    # 환경 변수 읽기
    opensearch_host = os.getenv('OPENSEARCH_HOST', 'localhost')
    opensearch_port = int(os.getenv('OPENSEARCH_PORT', '9200'))
    opensearch_use_ssl = os.getenv('OPENSEARCH_USE_SSL', 'false').lower() == 'true'
    opensearch_verify_certs = os.getenv('OPENSEARCH_VERIFY_CERTS', 'false').lower() == 'true'
    opensearch_username = os.getenv('OPENSEARCH_USERNAME')
    opensearch_password = os.getenv('OPENSEARCH_PASSWORD')
    
    # 호스트 정리 (프로토콜 제거)
    if opensearch_host.startswith('https://'):
        opensearch_host = opensearch_host.replace('https://', '')
        opensearch_use_ssl = True
    elif opensearch_host.startswith('http://'):
        opensearch_host = opensearch_host.replace('http://', '')
    
    # 연결 정보 출력
    print("📋 연결 정보:")
    print(f"   Host: {opensearch_host}")
    print(f"   Port: {opensearch_port}")
    print(f"   SSL: {opensearch_use_ssl}")
    print(f"   Verify Certs: {opensearch_verify_certs}")
    print(f"   Username: {opensearch_username or '(없음)'}")
    print(f"   Password: {'*' * len(opensearch_password) if opensearch_password else '(없음)'}")
    print()
    
    # HTTP Auth 설정
    http_auth = None
    if opensearch_username and opensearch_password:
        http_auth = (opensearch_username, opensearch_password)
    
    # OpenSearch 클라이언트 생성
    try:
        print("🔌 OpenSearch 클라이언트 생성 중...")
        client = OpenSearch(
            hosts=[{'host': opensearch_host, 'port': opensearch_port}],
            http_auth=http_auth,
            http_compress=True,
            use_ssl=opensearch_use_ssl,
            verify_certs=opensearch_verify_certs,
            ssl_assert_hostname=False,
            ssl_show_warn=False,
            timeout=10,
            max_retries=1,
            retry_on_timeout=False
        )
        print("✅ 클라이언트 생성 완료\n")
    except Exception as e:
        print(f"❌ 클라이언트 생성 실패: {e}\n")
        return False
    
    # 1. 기본 연결 테스트
    print("1️⃣  기본 연결 테스트 (ping)...")
    try:
        if client.ping():
            print("   ✅ Ping 성공\n")
        else:
            print("   ❌ Ping 실패\n")
            return False
    except ConnectionError as e:
        print(f"   ❌ 연결 오류: {e}\n")
        return False
    except AuthenticationException as e:
        print(f"   ❌ 인증 오류: {e}\n")
        return False
    except Exception as e:
        print(f"   ❌ 예상치 못한 오류: {e}\n")
        return False
    
    # 2. 클러스터 정보 조회
    print("2️⃣  클러스터 정보 조회...")
    try:
        info = client.info()
        print(f"   ✅ 클러스터 이름: {info.get('cluster_name', 'N/A')}")
        print(f"   ✅ 버전: {info.get('version', {}).get('number', 'N/A')}")
        print(f"   ✅ Lucene 버전: {info.get('version', {}).get('lucene_version', 'N/A')}\n")
    except Exception as e:
        print(f"   ⚠️  클러스터 정보 조회 실패: {e}\n")
    
    # 3. 클러스터 상태 확인
    print("3️⃣  클러스터 상태 확인...")
    try:
        health = client.cluster.health()
        status = health.get('status', 'unknown')
        status_emoji = {
            'green': '🟢',
            'yellow': '🟡',
            'red': '🔴'
        }.get(status, '⚪')
        
        print(f"   {status_emoji} 상태: {status.upper()}")
        print(f"   ✅ 노드 수: {health.get('number_of_nodes', 'N/A')}")
        print(f"   ✅ 데이터 노드 수: {health.get('number_of_data_nodes', 'N/A')}")
        print(f"   ✅ 활성 샤드: {health.get('active_shards', 'N/A')}")
        print(f"   ✅ 활성 프라이머리 샤드: {health.get('active_primary_shards', 'N/A')}\n")
    except Exception as e:
        print(f"   ⚠️  클러스터 상태 확인 실패: {e}\n")
    
    # 4. 인덱스 목록 조회
    print("4️⃣  인덱스 목록 조회...")
    try:
        indices = client.cat.indices(format='json')
        if indices:
            print(f"   ✅ 총 {len(indices)}개의 인덱스 발견:")
            # Jaeger 관련 인덱스만 필터링
            jaeger_indices = [idx for idx in indices if 'jaeger' in idx.get('index', '').lower()]
            if jaeger_indices:
                print("\n   📊 Jaeger 관련 인덱스:")
                for idx in jaeger_indices[:10]:  # 최대 10개만 출력
                    index_name = idx.get('index', 'N/A')
                    docs_count = idx.get('docs.count', 'N/A')
                    store_size = idx.get('store.size', 'N/A')
                    print(f"      - {index_name}")
                    print(f"        문서 수: {docs_count}, 크기: {store_size}")
                if len(jaeger_indices) > 10:
                    print(f"      ... 외 {len(jaeger_indices) - 10}개 더")
            else:
                print("   ⚠️  Jaeger 관련 인덱스가 없습니다.")
        else:
            print("   ⚠️  인덱스가 없습니다.")
        print()
    except Exception as e:
        print(f"   ⚠️  인덱스 목록 조회 실패: {e}\n")
    
    # 5. Jaeger span 검색 테스트
    print("5️⃣  Jaeger Span 검색 테스트...")
    try:
        search_body = {
            "query": {"match_all": {}},
            "size": 1
        }
        result = client.search(index="jaeger-span-*", body=search_body)
        total_hits = result.get('hits', {}).get('total', {})
        if isinstance(total_hits, dict):
            count = total_hits.get('value', 0)
        else:
            count = total_hits
        
        print(f"   ✅ 검색 성공! 총 {count}개의 span 발견")
        
        if count > 0:
            first_hit = result.get('hits', {}).get('hits', [])[0]
            source = first_hit.get('_source', {})
            print(f"   📄 샘플 데이터:")
            print(f"      Trace ID: {source.get('traceID', 'N/A')}")
            print(f"      Span ID: {source.get('spanID', 'N/A')}")
            print(f"      Operation: {source.get('operationName', 'N/A')}")
            print(f"      Service: {source.get('process', {}).get('serviceName', 'N/A')}")
        print()
    except Exception as e:
        print(f"   ⚠️  검색 실패: {e}\n")
    
    print("="*60)
    print("✅ OpenSearch 연결 테스트 완료!")
    print("="*60 + "\n")
    
    return True


def main():
    """메인 함수"""
    try:
        success = test_opensearch_connection()
        if success:
            print("🎉 모든 테스트를 통과했습니다!")
            sys.exit(0)
        else:
            print("⚠️  일부 테스트가 실패했습니다.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  사용자가 테스트를 중단했습니다.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

