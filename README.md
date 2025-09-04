# AI-Detector

실시간 보안 위협 탐지 및 시각화 시스템

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
├── backend/                          # Python FastAPI 백엔드
│   ├── api/                          # API 라우터 (auth, settings, alarms, traces, metrics, sigma 등)
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── settings.py
│   │   ├── traces.py
│   │   ├── metrics.py
│   │   ├── alarms.py
│   │   └── sigma.py
│   ├── database/                     # DB 모델 및 세션
│   │   ├── database.py
│   │   └── user_models.py
│   ├── kafka/                        # Kafka 컨슈머, SSE, Slack 알림
│   │   ├── consumer.py
│   │   ├── raw_trace_normalizer.py
│   │   ├── sse.py
│   │   └── slack_notify.py
│   ├── utils/                        # 공용 유틸(암호화, JWT, 미들웨어 등)
│   │   ├── auth_deps.py
│   │   ├── auth_middleware.py
│   │   ├── crypto_utils.py
│   │   ├── jwt_utils.py
│   │   └── opensearch_analyzer.py
│   ├── security_api.py               # 메인 API 앱 엔트리
│   ├── start_server.py               # 서버 실행 스크립트
│   └── requirements.txt              # 백엔드 패키지 목록
│
├── frontend/                         # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/                      # App Router 및 API 프록시
│   │   │   ├── api/
│   │   │   │   ├── _utils/           # 백엔드 프록시 유틸
│   │   │   │   └── settings/
│   │   │   │       └── slack/
│   │   │   │           └── test/
│   │   │   ├── dashboard/
│   │   │   ├── alarms/
│   │   │   ├── settings/
│   │   │   ├── agents/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── scripts/
│   └── import_sigma_rules_advanced.py  # Sigma 룰 MongoDB 임포트 스크립트
│
├── EventAgent-main/                  # 에이전트, OTEL, Jaeger, Docker 구성
│   └── docker-compose.yml
│
├── LLMDetection-main/                # LLM 기반 감지 컴포넌트(ChromaDB, LLM 컨슈머 등)
│   ├── Detector/
│   └── kafka/
│
├── assets/
├── requirements.txt                  # 루트 공용 요구사항(있을 경우)
└── README.md
```

---

## 설치 및 실행 가이드

### 1. 필수 요구사항

- Python 3.8+
- Node.js 18+
- OpenSearch
- MongoDB (Sigma 룰 저장용)
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

SLACK_ENC_KEY
```

---

### 6. sse서버, kafka 실행

```bash
cd backend/kafka

# sse서버 실행
python sse.py
# kafka consumer 실행(root폴더에서 실행)
python -m backend.kafka.consumer
# raw_trace 정규화 실행
python raw_trace_normalizer.py
```

---

### 7. detector.py, chromaDB, llm consumer 실행

```bash
cd LLMDetectio-main

# chroma DB 실행
cd Detector
chroma run --host 127.0.0.1 --port 8000
# chroma server 실행
uvicorn chroma_api:app --reload --port 9000
# detector.py 실행
python detector.py
# kafka consumer 실행
cd Kafka
python consumer.py
```

---

### 8. EventAgent 실행

```bash
cd EventAgent_main

# 1) SysmonAgent 관리자 권한으로 실행
./SysmonAgent.exe

# 2) sigma_matcher
./sigma_matcher.exe

# 3) OTEL Collector
압축 해제
otelcol-contrib --config otel-collector-config.yaml

# 4) Docker 기반 서비스 실행 (Kafka, Jaeger, OpenSearch)
docker compose pull
docker‑compose up -d

# 5) Kafka 토픽 생성
docker exec -it kafka kafka-topics --create --topic raw_trace --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
# Kafka 실시간 데이터 확인
docker exec -it kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic raw_trace
```
