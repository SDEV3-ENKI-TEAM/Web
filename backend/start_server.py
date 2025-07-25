#!/usr/bin/env python3
import uvicorn
from security_api import app

if __name__ == "__main__":
    print("EventAgent 백엔드 API 서버 시작...")
    print("OpenSearch 연결 테스트...")
    
    # OpenSearch 연결 테스트
    try:
        from opensearch_analyzer import OpenSearchAnalyzer
        analyzer = OpenSearchAnalyzer()
        status = analyzer.check_jaeger_indices()
        
        if status['status'] == 'success':
            print(f"OpenSearch 연결 성공! {status['total_documents']:,}개 문서 발견")
        else:
            print(f"OpenSearch 연결 경고: {status['message']}")
    except Exception as e:
        print(f"OpenSearch 연결 실패: {e}")
    
    print("서버 시작 중... http://127.0.0.1:8003")
    
    uvicorn.run(
        "security_api:app",
        host="127.0.0.1", 
        port=8003,  # 포트 8003으로 변경
        reload=True,
        log_level="info"
    ) 