# AI-Detector

실시간 보안 위협 탐지 및 시각화 시스템

---

## 프로젝트 개요

AI-Detector는 Sysmon ETW(Event Tracing for Windows) 데이터를 실시간으로 분석하여 보안 위협을 탐지하고 시각화하는 종합 보안 솔루션입니다. Sigma 규칙 기반 악성 행위를 탐지하며, React Flow를 통해 프로세스 트리와 보안 이벤트를 직관적으로 시각화합니다.

---

## 기술 스택

### Backend

- Python FastAPI - 고성능 API 서버
- OpenSearch/Elasticsearch - 보안 데이터 저장 및 검색
- Pandas - 데이터 분석 및 전처리
- Uvicorn - ASGI 서버
- MongoDB - Sigma 룰 저장 및 관리
- PyMongo - MongoDB Python 드라이버

### Frontend

- Next.js 14 - React 기반 프레임워크
- React Flow - 인터랙티브 노드 그래프 시각화
- Tailwind CSS - 유틸리티 기반 스타일링
- TypeScript

### Sigma 룰 처리

- PyYAML - YAML 파일 파싱
- Tenacity - 재시도 로직
- TQDM - 진행도 표시
- Python-dotenv - 환경 변수 관리

---

## 프로젝트 구조

```
AI-Detector/
├── backend/                  # Python FastAPI 백엔드
│   ├── security_api.py       # 메인 API 서버
│   ├── opensearch_analyzer.py# OpenSearch 분석기
│   ├── requirements.txt      # Python 패키지 목록
│   └── ...
├── frontend/                 # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── context/
│   │   ├── lib/
│   │   └── ...
│   ├── package.json
│   └── ...
├── import_sigma_rules_advanced.py  # Sigma 룰 MongoDB 임포트 스크립트
├── requirements.txt
└── README.md
```

---

## 설치 및 실행 가이드

### 1. 필수 요구사항

- Python 3.8+
- Node.js 18+
- OpenSearch
- MongoDB (Sigma 룰 저장용)
- (Spring Boot 백엔드 사용 시) JDK 11+, Maven 3.6+
- MySQL

---

### 2. 백엔드(FastAPI) 설치 및 실행

```bash
cd backend

pip install -r requirements.txt

# 서버 실행
python Start_server.py
```

---

### 3. 프론트엔드(Next.js) 설치 및 실행

```bash
cd frontend
npm install

# 개발 서버 실행
npm run dev
# http://localhost:3000 에서 접속
```

---

### 4. Sigma 룰 MongoDB 임포트

```bash
# Python 패키지 설치
pip install -r requirements.txt

# 기본 임포트 (EventAgent-main/sigma_matcher/rules/rules 디렉토리 사용)
python import_sigma_rules_advanced.py

# 특정 디렉토리 임포트
python import_sigma_rules_advanced.py --dir EventAgent-main/sigma_matcher/rules/rules/windows

# 컬렉션 초기화 후 임포트
python import_sigma_rules_advanced.py --clear-collection

# Dry run (실제 저장하지 않고 테스트)
python import_sigma_rules_advanced.py --dry-run

# 상세 로그 출력
python import_sigma_rules_advanced.py --verbose
```

---

### 5. env파일 생성

```bash
MYSQL_HOST
MYSQL_PORT
MYSQL_USER
MYSQL_PASSWORD
MYSQL_DATABASE

MONGO_URI
MONGO_DB
MONGO_COLLECTION

OPENSEARCH_HOST
OPENSEARCH_PORT
TRACE_INDEX_PATTERN

VALKEY_HOST
VALKEY_PORT
VALKEY_DB
KAFKA_BROKER
KAFKA_TOPIC

JAEGER_URL

JWT_SECRET_KEY
JWT_REFRESH_SECRET_KEY
```
