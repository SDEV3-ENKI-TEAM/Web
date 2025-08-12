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

## 환경변수 설정

프로젝트 실행을 위해 다음 환경변수들을 설정해야 합니다. `backend/.env` 파일을 생성하고 아래 설정을 추가하세요.

### 필수 환경변수

```bash
# JWT 설정
JWT_SECRET_KEY=your-super-secret-jwt-key-here-change-this-in-production
JWT_REFRESH_SECRET_KEY=your-super-secret-jwt-refresh-key-here-change-this-in-production
JWT_ISSUER=shitftx
JWT_AUDIENCE=shitftx-users

# MySQL 설정
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=

# MongoDB 설정
MONGO_URI=
MONGO_DB=
MONGO_COLLECTION=

# Redis 설정
REDIS_HOST=
REDIS_PORT=
REDIS_DB=

# OpenSearch 설정
OPENSEARCH_HOST=
OPENSEARCH_PORT=
OPENSEARCH_USE_SSL=
OPENSEARCH_VERIFY_CERTS=
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=
TRACE_INDEX_PATTERN=

# AWS 설정 (OpenSearch용)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Valkey 설정 (Rate Limiting)
VALKEY_HOST=
VALKEY_PORT=
VALKEY_DB=

# OpenAI 설정
OPENAI_API_KEY=

# Sigma Rules 설정
RULES_DIR=
TRACE_INDEX_PATTERN=
```

### 보안 주의사항

- **프로덕션 환경에서는 반드시 강력한 JWT 키를 사용하세요**
- **데이터베이스 비밀번호는 복잡하게 설정하세요**
- **`.env` 파일은 절대 Git에 커밋하지 마세요**
- **프로덕션에서는 SSL/TLS를 활성화하세요**

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

# 환경변수 파일 생성
cp env_example.txt .env
# .env 파일을 편집하여 실제 값으로 설정

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

### 4. Spring Boot 백엔드 빌드 및 실행

#### 필수 요구사항

```bash
cd backend
./mvn clean install -DskipTests
./mvn spring-boot:run
# 또는
mvn spring-boot:run  # Windows
```

---

### 5. Sigma 룰 MongoDB 임포트

Sigma 룰을 MongoDB에 임포트하여 보안 분석에 활용할 수 있습니다.

#### 필수 요구사항

- MongoDB (로컬 또는 원격)
- Python 3.8+

#### 설치 및 실행

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

#### CLI 옵션

| 옵션                 | 설명                             | 기본값                                      |
| -------------------- | -------------------------------- | ------------------------------------------- |
| `--dir`              | Sigma 룰 디렉토리 경로           | `EventAgent-main/sigma_matcher/rules/rules` |
| `--dry-run`          | 실제 저장하지 않고 테스트만 실행 | False                                       |
| `--clear-collection` | 기존 컬렉션 데이터 삭제          | False                                       |
| `--bulk-size`        | Bulk 연산 크기                   | 100                                         |
| `--mongo-uri`        | MongoDB 연결 URI                 | `mongodb://localhost:27017`                 |
| `--db-name`          | 데이터베이스 이름                | `security`                                  |
| `--collection-name`  | 컬렉션 이름                      | `rules`                                     |
| `--verbose`          | 상세 로그 출력                   | False                                       |

#### 임포트된 데이터 구조

각 Sigma 룰은 다음 필드로 MongoDB에 저장:

- `title`: 룰 제목
- `sigma_id`: Sigma 룰 ID
- `description`: 룰 설명
- `level`: 위험도 레벨 (high/medium/low/critical/warning/informational)
- `severity_score`: 위험도 점수 (high=90, medium=60, low=30)
- `status`: 룰 상태 (stable/deprecated)
- `logsource`: 로그 소스 정보
- `detection`: 탐지 조건
- `falsepositives`: 오탐 가능성
- `author`: 작성자
- `date`: 작성일
- `modified`: 수정일
- `references`: 참조 링크
- `tags`: 태그 목록
- `fields`: 추가 필드
- `rule_id`: 파일명 기반 룰 ID
- `source_file`: 원본 파일 경로
- `imported_at`: 임포트 시간
