#!/usr/bin/env python3
import os
import yaml
import glob
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, Optional, List
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, WriteError, BulkWriteError
from pymongo.operations import UpdateOne
from dotenv import load_dotenv
from tqdm import tqdm
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('sigma_import_advanced.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


class SigmaRuleImporterAdvanced:
    def __init__(self, 
                 mongo_uri: str = None,
                 db_name: str = None, 
                 collection_name: str = None,
                 bulk_size: int = 100):
        """
        Sigma 룰 임포터 초기화 (고급 버전)
        
        Args:
            mongo_uri: MongoDB 연결 URI (환경변수에서 가져옴)
            db_name: 데이터베이스 이름 (환경변수에서 가져옴)
            collection_name: 컬렉션 이름 (환경변수에서 가져옴)
            bulk_size: Bulk 연산 배치 크기
        """
        self.mongo_uri = mongo_uri or os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
        self.db_name = db_name or os.getenv('MONGODB_DB', 'security')
        self.collection_name = collection_name or os.getenv('MONGODB_COLLECTION', 'rules')
        self.bulk_size = bulk_size
        
        logger.info(f"MongoDB 연결: {self.mongo_uri}")
        logger.info(f"데이터베이스: {self.db_name}")
        logger.info(f"컬렉션: {self.collection_name}")
        logger.info(f"Bulk 배치 크기: {self.bulk_size}")
        
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]
        
        self.collection.create_index("sigma_id", unique=True)
        logger.info("MongoDB 인덱스 생성 완료")
        
    def calculate_severity_score(self, level: str) -> int:
        """
        level을 기반으로 severity_score 계산
        
        Args:
            level: Sigma 룰의 level (high, medium, low)
            
        Returns:
            severity_score: 90, 60, 30 중 하나
        """
        level_mapping = {
            "high": 90,
            "medium": 60,
            "low": 30
        }
        return level_mapping.get(level.lower(), 30)
    
    def extract_rule_data(self, yaml_content: Dict[str, Any], file_path: str) -> Optional[Dict[str, Any]]:
        """
        YAML 파일에서 룰 데이터 추출 (메타데이터 추가)
        
        Args:
            yaml_content: 파싱된 YAML 내용
            file_path: 원본 파일 경로
            
        Returns:
            추출된 룰 데이터 또는 None (유효하지 않은 경우)
        """
        try:
            if not yaml_content.get('title') or not yaml_content.get('id'):
                logger.warning(f"필수 필드 누락: {file_path}")
                return None
            
            if yaml_content.get('status') == 'deprecated':
                logger.info(f"스킵(Deprecated): {file_path}")
                return None
            
            level = yaml_content.get('level', 'low')
            
            rule_data = {
                'title': yaml_content.get('title', ''),
                'sigma_id': yaml_content.get('id', ''),
                'description': yaml_content.get('description', ''),
                'status': yaml_content.get('status', ''),
                'logsource': yaml_content.get('logsource', {}),
                'detection': yaml_content.get('detection', {}),
                'falsepositives': yaml_content.get('falsepositives', []),
                'level': level,
                'severity_score': self.calculate_severity_score(level),
                'rule_id': Path(file_path).stem,
                'source_file': file_path,
                'imported_at': self.get_current_timestamp(),
                'author': yaml_content.get('author', ''),
                'date': str(yaml_content.get('date', '')) if yaml_content.get('date') else '',
                'modified': str(yaml_content.get('modified', '')) if yaml_content.get('modified') else '',
                'references': yaml_content.get('references', []),
                'tags': yaml_content.get('tags', []),
                'fields': yaml_content.get('fields', [])
            }
            
            return rule_data
            
        except Exception as e:
            logger.error(f"데이터 추출 중 오류 ({file_path}): {e}")
            return None
    
    def get_current_timestamp(self) -> str:
        """현재 시간을 ISO 형식으로 반환"""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((WriteError, BulkWriteError))
    )
    def bulk_upsert_rules(self, rules_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        룰 데이터를 MongoDB에 bulk upsert
        
        Args:
            rules_data: 저장할 룰 데이터 리스트
            
        Returns:
            처리 결과 통계
        """
        if not rules_data:
            return {"inserted": 0, "updated": 0, "failed": 0}
        
        try:
            bulk_operations = []
            for rule_data in rules_data:
                bulk_operations.append(
                    UpdateOne(
                        {"sigma_id": rule_data["sigma_id"]},
                        {"$set": rule_data},
                        upsert=True
                    )
                )

            result = self.collection.bulk_write(bulk_operations, ordered=False)
            
            stats = {
                "inserted": result.upserted_count,
                "updated": result.modified_count,
                "failed": len(rules_data) - result.upserted_count - result.modified_count
            }
            
            logger.info(f"Bulk 연산 완료: 삽입={stats['inserted']}, 업데이트={stats['updated']}, 실패={stats['failed']}")
            return stats
            
        except BulkWriteError as e:
            logger.error(f"Bulk 연산 오류: {e}")
            return {"inserted": 0, "updated": 0, "failed": len(rules_data)}
        except Exception as e:
            logger.error(f"예상치 못한 오류: {e}")
            return {"inserted": 0, "updated": 0, "failed": len(rules_data)}
    
    def process_yaml_file(self, file_path: str) -> Dict[str, int]:
        """
        단일 YAML 파일 처리 (다중 문서 지원)
        
        Args:
            file_path: 처리할 YAML 파일 경로
            
        Returns:
            처리 결과 통계
        """
        stats = {"processed": 0, "success": 0, "failed": 0}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                yaml_documents = list(yaml.safe_load_all(file))
            
            if not yaml_documents:
                logger.warning(f"빈 파일 또는 유효하지 않은 YAML: {file_path}")
                stats["failed"] += 1
                return stats
            
            logger.debug(f"파일 처리 시작: {file_path} ({len(yaml_documents)}개 문서)")
            
            for i, yaml_content in enumerate(yaml_documents):
                stats["processed"] += 1
                
                if not yaml_content:
                    logger.warning(f"빈 문서 건너뛰기: {file_path} (문서 {i+1})")
                    stats["failed"] += 1
                    continue
                
                rule_data = self.extract_rule_data(yaml_content, file_path)
                if not rule_data:
                    stats["failed"] += 1
                    continue
                
                stats["success"] += 1
            
            return stats
            
        except yaml.YAMLError as e:
            logger.error(f"YAML 파싱 오류 ({file_path}): {e}")
            stats["failed"] += 1
            return stats
        except FileNotFoundError:
            logger.error(f"파일을 찾을 수 없음: {file_path}")
            stats["failed"] += 1
            return stats
        except Exception as e:
            logger.error(f"파일 처리 중 오류 ({file_path}): {e}")
            stats["failed"] += 1
            return stats
    
    def clear_collection(self) -> bool:
        """컬렉션의 모든 문서 삭제"""
        try:
            result = self.collection.delete_many({})
            logger.info(f"컬렉션 초기화 완료: {result.deleted_count}개 문서 삭제")
            return True
        except Exception as e:
            logger.error(f"컬렉션 초기화 오류: {e}")
            return False
    
    def import_all_rules(self, rules_dir: str = None, dry_run: bool = False) -> Dict[str, int]:
        """
        rules 디렉토리의 모든 YAML 파일을 재귀적으로 처리
        
        Args:
            rules_dir: Sigma 룰 파일들이 있는 디렉토리 (환경변수에서 가져옴)
            dry_run: 실제 저장하지 않고 시뮬레이션만 실행
            
        Returns:
            처리 결과 통계
        """
        rules_dir = rules_dir or os.getenv('RULES_DIR', 'rules')
        
        if not os.path.exists(rules_dir):
            logger.error(f"디렉토리를 찾을 수 없음: {rules_dir}")
            return {"total": 0, "success": 0, "failed": 0, "processed": 0}

        yaml_files = glob.glob(os.path.join(rules_dir, "**/*.yml"), recursive=True)
        yaml_files.extend(glob.glob(os.path.join(rules_dir, "**/*.yaml"), recursive=True))
        
        if not yaml_files:
            logger.warning(f"YAML 파일을 찾을 수 없음: {rules_dir}")
            return {"total": 0, "success": 0, "failed": 0, "processed": 0}
        
        logger.info(f"총 {len(yaml_files)}개의 YAML 파일을 찾았습니다.")
        
        if dry_run:
            logger.info("DRY RUN 모드: 실제 저장하지 않습니다.")
        
        total_stats = {"total": len(yaml_files), "success": 0, "failed": 0, "processed": 0}
        all_rules_data = []

        with tqdm(yaml_files, desc="파일 처리", unit="file") as pbar:
            for file_path in pbar:
                file_stats = self.process_yaml_file(file_path)
                total_stats["success"] += file_stats["success"]
                total_stats["failed"] += file_stats["failed"]
                total_stats["processed"] += file_stats["processed"]

                if not dry_run and file_stats["success"] > 0:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as file:
                            yaml_documents = list(yaml.safe_load_all(file))
                            
                        for yaml_content in yaml_documents:
                            if yaml_content and yaml_content.get('title') and yaml_content.get('id'):
                                if yaml_content.get('status') != 'deprecated':
                                    rule_data = self.extract_rule_data(yaml_content, file_path)
                                    if rule_data:
                                        all_rules_data.append(rule_data)
                    except Exception as e:
                        logger.error(f"룰 데이터 수집 오류 ({file_path}): {e}")
                
                pbar.set_postfix({
                    '성공': total_stats["success"],
                    '실패': total_stats["failed"]
                })     
        if not dry_run and all_rules_data:
            logger.info(f"총 {len(all_rules_data)}개의 룰을 Bulk 연산으로 저장합니다...")

            for i in range(0, len(all_rules_data), self.bulk_size):
                batch = all_rules_data[i:i + self.bulk_size]
                batch_stats = self.bulk_upsert_rules(batch)
                
                logger.info(f"배치 {i//self.bulk_size + 1}: {len(batch)}개 처리")
        
        return total_stats
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """MongoDB 컬렉션 통계 조회"""
        try:
            total_count = self.collection.count_documents({})
            level_stats = self.collection.aggregate([
                {"$group": {"_id": "$level", "count": {"$sum": 1}}}
            ])
            
            stats = {
                "total_rules": total_count,
                "level_distribution": {doc["_id"]: doc["count"] for doc in level_stats}
            }
            
            return stats
        except Exception as e:
            logger.error(f"통계 조회 오류: {e}")
            return {"total_rules": 0, "level_distribution": {}}
    
    def close(self):
        """MongoDB 연결 종료"""
        self.client.close()
        logger.info("MongoDB 연결 종료")


def parse_arguments():
    """명령행 인수 파싱"""
    parser = argparse.ArgumentParser(
        description="Sigma 룰 파일들을 MongoDB에 저장하는 고급 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python import_sigma_rules_advanced.py --dir rules
  python import_sigma_rules_advanced.py --dry-run
  python import_sigma_rules_advanced.py --clear-collection
  python import_sigma_rules_advanced.py --dir custom_rules --bulk-size 50
        """
    )
    
    parser.add_argument(
        '--dir', '--directory',
        type=str,
        default=None,
        help='Sigma 룰 파일들이 있는 디렉토리 (기본값: 환경변수 RULES_DIR 또는 "rules")'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='실제 저장하지 않고 시뮬레이션만 실행'
    )
    
    parser.add_argument(
        '--clear-collection',
        action='store_true',
        help='임포트 전에 컬렉션의 모든 문서를 삭제'
    )
    
    parser.add_argument(
        '--bulk-size',
        type=int,
        default=100,
        help='Bulk 연산 배치 크기 (기본값: 100)'
    )
    
    parser.add_argument(
        '--mongo-uri',
        type=str,
        default=None,
        help='MongoDB 연결 URI (기본값: 환경변수 MONGODB_URI)'
    )
    
    parser.add_argument(
        '--db-name',
        type=str,
        default=None,
        help='데이터베이스 이름 (기본값: 환경변수 MONGODB_DB)'
    )
    
    parser.add_argument(
        '--collection-name',
        type=str,
        default=None,
        help='컬렉션 이름 (기본값: 환경변수 MONGODB_COLLECTION)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='상세한 로그 출력'
    )
    
    return parser.parse_args()


def main():
    """메인 함수"""
    args = parse_arguments()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("Sigma 룰 MongoDB 임포트 시작 (고급 버전)...")
    
    try:
        importer = SigmaRuleImporterAdvanced(
            mongo_uri=args.mongo_uri,
            db_name=args.db_name,
            collection_name=args.collection_name,
            bulk_size=args.bulk_size
        )
       
        if args.clear_collection:
            if not importer.clear_collection():
                logger.error("컬렉션 초기화 실패")
                return
      
        before_stats = importer.get_collection_stats()
        logger.info(f"임포트 전 통계: {before_stats}")

        default_rules_dir = args.dir or "EventAgent-main/sigma_matcher/rules/rules"

        import_stats = importer.import_all_rules(
            rules_dir=default_rules_dir,
            dry_run=args.dry_run
        )
        
        if not args.dry_run:
            after_stats = importer.get_collection_stats()
            
            # 결과 출력
            logger.info("\n" + "="*60)
            logger.info("임포트 완료!")
            logger.info(f"총 파일 수: {import_stats['total']}")
            logger.info(f"처리된 문서 수: {import_stats['processed']}")
            logger.info(f"성공: {import_stats['success']}")
            logger.info(f"실패: {import_stats['failed']}")
            logger.info(f"임포트 후 총 룰 수: {after_stats['total_rules']}")
            logger.info(f"레벨별 분포: {after_stats['level_distribution']}")
            logger.info("="*60)
        else:
            logger.info("\n" + "="*60)
            logger.info("DRY RUN 완료!")
            logger.info(f"총 파일 수: {import_stats['total']}")
            logger.info(f"처리된 문서 수: {import_stats['processed']}")
            logger.info(f"성공: {import_stats['success']}")
            logger.info(f"실패: {import_stats['failed']}")
            logger.info("="*60)

        importer.close()
        
    except Exception as e:
        logger.error(f"스크립트 실행 중 오류: {e}")


if __name__ == "__main__":
    main() 