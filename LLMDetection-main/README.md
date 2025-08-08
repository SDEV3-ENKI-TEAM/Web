LLM 기반 이상 탐지
--- 

### .env 파일 생성 필요
OPENAI_API_KEY=sk-proj-h... <br>
CHROMA_OPENAI_API_KEY=sk-proj-h... <br>
OPENSEARCH_HOST=search-eventagentservice ~~~ .ap-northeast-2.es.amazonaws.com 
<br>
<br>


### 흐름
1. AWS Opensearch에서 trace 가져옴
2. 데이터 전처리, 요약해서 자연어로 변환
3. 벡터 db에서 임계값 0.7로 유사도 검색 
   * 유사 로그가 있는 경우: 유사 로그의 메타데이터를 참고하여 판단
   * 유사 로그가 없는 경우: LLM 판단
4. decision이 suspicious가 나온 경우 재판단 요청
5. 결과 chroma db에 저장
<br>


### 이상 탐지 실행
1. anomaly_detect.py 파일 실행
2. 터미널 출력 결과 예시
<img width="1110" height="729" alt="스크린샷 2025-08-05 오후 3 06 14" src="https://github.com/user-attachments/assets/508c9c56-8082-4226-a6d0-a11ebb9a1d42" />

<br>
<br>




### chomadb API
1. uvicorn chroma_api:app --reload --port 9000 실행
2. http://127.0.0.1:9000 접속
3. /log 경로에서 원본 트레이스 ID, 요약된 로그, 메타데이터 확인
<img width="1437" height="707" alt="스크린샷 2025-08-07 오후 3 42 57" src="https://github.com/user-attachments/assets/07ff5892-567a-4573-bc77-7c1615f761c1" />

