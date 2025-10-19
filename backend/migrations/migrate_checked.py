"""
LLM Analysis 테이블에 checked 컬럼 추가 마이그레이션
실행: python backend/migrations/migrate_checked.py
"""
import sys
import os
from pathlib import Path

# backend 디렉토리를 sys.path에 추가
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from database.database import engine, Base, LLMAnalysis
from sqlalchemy import text

def migrate():
    print("🔄 LLM Analysis 테이블 마이그레이션 시작...")
    
    try:
        with engine.connect() as conn:
            # 테이블이 존재하는지 확인
            result = conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name = 'llm_analysis'"
            ))
            table_exists = result.scalar() > 0
            
            if not table_exists:
                print("⚠️  llm_analysis 테이블이 없습니다. 새로 생성합니다...")
                Base.metadata.create_all(bind=engine)
                print("✅ llm_analysis 테이블이 생성되었습니다!")
            else:
                # checked 컬럼이 있는지 확인
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.columns "
                    "WHERE table_schema = DATABASE() AND table_name = 'llm_analysis' "
                    "AND column_name = 'checked'"
                ))
                column_exists = result.scalar() > 0
                
                if column_exists:
                    print("✅ checked 컬럼이 이미 존재합니다!")
                else:
                    print("➕ checked 컬럼을 추가합니다...")
                    conn.execute(text(
                        "ALTER TABLE llm_analysis "
                        "ADD COLUMN checked BOOLEAN NOT NULL DEFAULT FALSE "
                        "AFTER similar_trace_ids"
                    ))
                    conn.commit()
                    print("✅ checked 컬럼이 추가되었습니다!")
                
                # 인덱스 추가
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM information_schema.statistics "
                    "WHERE table_schema = DATABASE() AND table_name = 'llm_analysis' "
                    "AND index_name = 'idx_checked'"
                ))
                index_exists = result.scalar() > 0
                
                if not index_exists:
                    print("➕ checked 인덱스를 추가합니다...")
                    conn.execute(text(
                        "CREATE INDEX idx_checked ON llm_analysis(checked)"
                    ))
                    conn.commit()
                    print("✅ checked 인덱스가 추가되었습니다!")
                else:
                    print("✅ checked 인덱스가 이미 존재합니다!")
        
        print("\n🎉 마이그레이션이 완료되었습니다!")
        print("\n📋 테이블 구조:")
        with engine.connect() as conn:
            result = conn.execute(text("DESCRIBE llm_analysis"))
            for row in result:
                print(f"  {row[0]}: {row[1]} {row[2]} {row[3]}")
        
    except Exception as e:
        print(f"❌ 마이그레이션 실패: {e}")
        sys.exit(1)

if __name__ == "__main__":
    migrate()

