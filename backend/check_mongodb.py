#!/usr/bin/env python3
"""
MongoDB 연결 및 Sigma 룰 데이터 확인 스크립트
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

# .env 파일 로드
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path, encoding='utf-8')

def check_mongodb():
    print("="*60)
    print("MongoDB 연결 및 데이터 확인")
    print("="*60 + "\n")
    
    # 환경 변수 확인
    mongo_uri = os.getenv("MONGO_URI")
    mongo_db = os.getenv("MONGO_DB", "security")
    mongo_collection = os.getenv("MONGO_COLLECTION", "sigma_rules")
    
    print("📋 환경 변수:")
    print(f"   MONGO_URI: {mongo_uri or '❌ 설정되지 않음'}")
    print(f"   MONGO_DB: {mongo_db}")
    print(f"   MONGO_COLLECTION: {mongo_collection}\n")
    
    if not mongo_uri:
        print("❌ MongoDB URI가 설정되지 않았습니다!")
        print("\n해결 방법:")
        print("1. backend/.env 파일에 다음을 추가하세요:")
        print("   MONGO_URI=mongodb://admin:adminpassword@localhost:27017/")
        print("   MONGO_DB=security")
        print("   MONGO_COLLECTION=sigma_rules\n")
        print("2. 또는 docker-compose.yml의 MongoDB 서비스를 확인하세요")
        return False
    
    # MongoDB 연결 시도
    print("🔌 MongoDB 연결 시도...")
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print("   ✅ MongoDB 연결 성공!\n")
    except Exception as e:
        print(f"   ❌ MongoDB 연결 실패: {e}\n")
        print("해결 방법:")
        print("1. MongoDB가 실행 중인지 확인:")
        print("   docker-compose up -d mongodb")
        print("2. MongoDB 포트가 열려있는지 확인: 27017")
        print("3. 연결 정보가 올바른지 확인\n")
        return False
    
    # 데이터베이스 및 컬렉션 확인
    print("📊 데이터베이스 정보:")
    try:
        db = client[mongo_db]
        collection = db[mongo_collection]
        
        # 컬렉션 존재 확인
        collections = db.list_collection_names()
        print(f"   데이터베이스: {mongo_db}")
        print(f"   컬렉션 목록: {collections}\n")
        
        if mongo_collection not in collections:
            print(f"⚠️  컬렉션 '{mongo_collection}'이(가) 존재하지 않습니다!")
            print("\n해결 방법:")
            print("   scripts 디렉토리에서 Sigma 룰 임포트:")
            print("   cd scripts")
            print("   python import_sigma_rules_advanced.py\n")
            return False
        
        # 문서 개수 확인
        count = collection.count_documents({})
        print(f"📈 Sigma 룰 통계:")
        print(f"   총 문서 수: {count}개")
        
        if count == 0:
            print("\n❌ Sigma 룰 데이터가 없습니다!")
            print("\n해결 방법:")
            print("   1. scripts 디렉토리로 이동:")
            print("      cd scripts")
            print("   2. Sigma 룰 임포트:")
            print("      python import_sigma_rules_advanced.py")
            return False
        
        # 샘플 데이터 확인
        print("\n📄 샘플 Sigma 룰:")
        sample = collection.find_one()
        if sample:
            print(f"   Sigma ID: {sample.get('sigma_id', 'N/A')}")
            print(f"   Title: {sample.get('title', 'N/A')}")
            print(f"   Level: {sample.get('level', 'N/A')}")
            print(f"   Severity Score: {sample.get('severity_score', 'N/A')}")
        
        print("\n✅ MongoDB와 Sigma 룰 데이터가 정상입니다!")
        return True
        
    except Exception as e:
        print(f"❌ 데이터 확인 중 오류: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    try:
        success = check_mongodb()
        if success:
            print("\n" + "="*60)
            print("✅ 모든 확인이 완료되었습니다!")
            print("="*60)
        else:
            print("\n" + "="*60)
            print("⚠️  문제를 해결한 후 다시 실행하세요.")
            print("="*60)
    except KeyboardInterrupt:
        print("\n\n중단되었습니다.")
    except Exception as e:
        print(f"\n예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()

