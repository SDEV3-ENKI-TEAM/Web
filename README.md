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

### Frontend

- Next.js 14 - React 기반 프레임워크
- React Flow - 인터랙티브 노드 그래프 시각화
- Tailwind CSS - 유틸리티 기반 스타일링
- TypeScript

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
├── README.md
└── INSTALL_GUIDE.md
```

---

## 설치 및 실행 가이드

### 1. 필수 요구사항

- Python 3.8+
- Node.js 18+
- OpenSearch
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

### 4. Spring Boot 백엔드 빌드 및 실행

```bash
cd backend
./mvn clean install -DskipTests
./mvn spring-boot:run
# 또는
mvnw.cmd spring-boot:run  # Windows
```
