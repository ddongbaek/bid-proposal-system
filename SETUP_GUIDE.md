# 정량제안서 작성 시스템 — 새 PC 설치 가이드

> 다른 PC(집 등)에서 처음 셋업할 때 이 문서를 따라하세요.

---

## 1. 사전 준비 (프로그램 설치)

### 1-1. Python 3.11 이상
- 다운로드: https://www.python.org/downloads/
- 설치 시 **"Add Python to PATH"** 반드시 체크
- 확인:
  ```
  python --version
  ```

### 1-2. Node.js 20 LTS 이상
- 다운로드: https://nodejs.org/ (LTS 버전)
- 확인:
  ```
  node --version
  npm --version
  ```

### 1-3. Git
- 다운로드: https://git-scm.com/downloads
- 확인:
  ```
  git --version
  ```

---

## 2. 프로젝트 클론

```bash
git clone https://github.com/ddongbaek/bid-proposal-system.git
cd bid-proposal-system
```

또는 이미 구글 드라이브 동기화로 폴더가 있다면 그 폴더에서 바로 진행.

---

## 3. 환경변수 설정 (.env)

`.env` 파일은 보안상 git에 포함되지 않으므로 **수동 생성** 필요.

```bash
copy .env.example .env
```

그 다음 `.env` 파일을 메모장으로 열어서 수정:

```ini
# 필수 — Google Gemini API 키
GEMINI_API_KEY=여기에_실제_API키_입력

# 나머지는 기본값 사용 (수정 불필요)
```

### Gemini API 키 발급 방법
1. https://aistudio.google.com/apikey 접속
2. Google 계정 로그인
3. **"Create API Key"** 클릭
4. 생성된 키를 `.env`의 `GEMINI_API_KEY=` 뒤에 붙여넣기
5. 무료 플랜으로 충분 (분당 15회 요청)

---

## 4. 자동 설치 (권장)

```
setup.bat 더블클릭
```

이 스크립트가 아래를 자동으로 처리:
- Python/Node.js 설치 확인
- `data/` 하위 디렉토리 생성 (db, uploads, thumbnails, generated)
- `pip install -r requirements.txt` (백엔드 패키지)
- `playwright install chromium` (PDF 생성용 브라우저, ~100MB)
- `npm install` (프론트엔드 패키지)
- `.env` 파일 없으면 `.env.example`에서 복사

### 수동 설치 (setup.bat가 안 될 때)

```bash
# 터미널 1: 백엔드
cd backend
pip install -r requirements.txt
python -m playwright install chromium

# 터미널 2: 프론트엔드
cd frontend
npm install
```

---

## 5. 실행

```
start.bat 더블클릭
```

- 백엔드 서버 (포트 8000) + 프론트엔드 (포트 5173) 동시 실행
- 자동으로 브라우저 열림: http://localhost:5173
- 백엔드 API 문서: http://localhost:8000/api/docs

### 종료

```
stop.bat 더블클릭
```

또는 열린 터미널 창에서 `Ctrl+C`.

---

## 6. 폴더 구조 (데이터)

최초 실행 시 자동 생성되며, git에 포함되지 않음:

```
data/
├── db/               ← SQLite DB (bid_proposal.db)
├── uploads/          ← 업로드 파일 (자격증, PDF 등)
├── thumbnails/       ← PDF 썸네일 이미지
└── generated/        ← 생성된 PDF 파일
```

> 기존 PC의 데이터를 옮기려면 `data/` 폴더 전체를 복사하면 됩니다.

---

## 7. 트러블슈팅

### pip install 실패 — "Microsoft Visual C++ 14.0 or greater is required"
- pyhwp 등 일부 패키지에 C++ 빌드 도구 필요
- 설치: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- "Desktop development with C++" 워크로드 선택 후 설치

### playwright install 실패
```bash
# 수동 설치
cd backend
python -m playwright install chromium
```
- 회사 프록시 뒤에 있으면 `set HTTPS_PROXY=http://프록시주소:포트` 설정 후 재시도

### npm install 실패
```bash
# 캐시 클리어 후 재시도
cd frontend
npm cache clean --force
npm install
```

### 서버가 안 뜰 때
```bash
# 포트 충돌 확인
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# 기존 프로세스 종료
stop.bat
```

### "입찰 정보를 불러올 수 없습니다" 에러
- 백엔드 서버가 안 떠 있거나, AI 변환이 진행 중일 때 발생
- 백엔드 터미널 창 확인 → 에러 메시지 체크
- `.env`의 `GEMINI_API_KEY`가 유효한지 확인

### DB를 처음부터 다시 만들고 싶을 때
```bash
# data/db/bid_proposal.db 삭제 후 서버 재시작하면 자동 생성
del data\db\bid_proposal.db
```

---

## 8. 요약 (빠른 체크리스트)

| 단계 | 명령/행동 | 확인 |
|------|----------|------|
| Python 설치 | `python --version` → 3.11+ | ☐ |
| Node.js 설치 | `node --version` → 20+ | ☐ |
| Git 클론 | `git clone ...` 또는 드라이브 동기화 | ☐ |
| .env 생성 | `copy .env.example .env` → API키 입력 | ☐ |
| 패키지 설치 | `setup.bat` 더블클릭 | ☐ |
| 실행 | `start.bat` 더블클릭 | ☐ |
| 접속 | http://localhost:5173 | ☐ |
