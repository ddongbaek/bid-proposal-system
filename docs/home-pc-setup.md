# 집 PC 환경 세팅 가이드

회사 PC의 개발 환경을 집 PC에 동일하게 구성하는 문서.

---

## 1. 필수 소프트웨어 설치

### 1-1. Python 3.11 이상
- 다운로드: https://www.python.org/downloads/
- 현재 회사 PC: **Python 3.14.3**
- 설치 시 **"Add Python to PATH"** 반드시 체크
- 확인: `python --version`

### 1-2. Node.js LTS
- 다운로드: https://nodejs.org/
- 현재 회사 PC: **Node v24.12.0**, npm 11.6.2
- 확인: `node --version && npm --version`

### 1-3. Git
- 다운로드: https://git-scm.com/downloads
- 현재 회사 PC: **git 2.53.0**
- 확인: `git --version`

### 1-4. Claude Code (선택)
- Anthropic CLI: https://docs.anthropic.com/en/docs/claude-code
- 프로젝트 작업 시 AI 어시스턴트로 사용 중

---

## 2. 프로젝트 코드 가져오기

### 방법 A: 구글 드라이브 동기화 (현재 방식)
회사 PC에서 `E:\구글드라이브_동기화\Claude\04_bid-proposal-system`에 저장되어 있음.
구글 드라이브로 동기화하면 집 PC에서도 같은 파일을 볼 수 있음.

### 방법 B: USB/외장하드 복사
프로젝트 폴더 전체를 복사. 단, `node_modules/`, `__pycache__/` 제외해도 됨.

### 방법 C: GitHub 사용 (권장)
현재 remote가 설정되어 있지 않음. GitHub에 올리려면:
```bash
# 회사 PC에서 (1회)
cd "프로젝트 경로"
git remote add origin https://github.com/YOUR_USER/bid-proposal-system.git
git push -u origin master

# 집 PC에서
git clone https://github.com/YOUR_USER/bid-proposal-system.git
```

> **주의**: `.env` 파일은 `.gitignore`에 포함되어 git에 안 올라감. 별도로 복사 필요.

---

## 3. 프로젝트 설치

프로젝트 폴더로 이동 후:

```bash
# setup.bat 더블클릭 (자동으로 전부 설치)
setup.bat
```

또는 수동으로:

```bash
# 1) 백엔드 패키지 설치
cd backend
pip install -r requirements.txt

# 2) Playwright Chromium 설치 (PDF 생성용, ~100MB)
python -m playwright install chromium

# 3) 프론트엔드 패키지 설치
cd ../frontend
npm install
```

### pyhwp (HWP 변환) 설치 확인
`pip install -r requirements.txt`에서 `pyhwp>=0.1b15`가 설치됨.
확인:
```bash
python -c "import hwp5; print(hwp5.__version__)"
# 0.1b15 이 나오면 OK

which hwp5html   # 또는 where hwp5html (Windows CMD)
# 경로가 나오면 OK
```

---

## 4. 환경 변수 (.env)

프로젝트 루트에 `.env` 파일 생성 (`.env.example` 참고):

```env
# 필수: Gemini API 키 (AI 기능용)
GEMINI_API_KEY=여기에_실제_키_입력

# 나머지는 기본값 사용 (주석 해제 불필요)
# DEV_MODE=true
# DATABASE_URL=sqlite:///data/db/bid_proposal.db
```

> **Gemini API 키**: https://aistudio.google.com/apikey 에서 발급
> 회사 PC의 `.env` 파일을 그대로 복사해도 됨 (같은 키 공유 가능)

---

## 5. 데이터(DB) 이관

### SQLite DB 파일
- 위치: `data/db/bid_proposal.db` (약 4.8MB)
- 인력 정보, 입찰 데이터, 장표 등 모든 데이터 포함
- **이 파일을 복사하면 모든 데이터가 그대로 옮겨짐**

### 복사할 폴더
```
data/
  db/bid_proposal.db        ← 필수 (DB 전체)
  uploads/                   ← 업로드된 파일 (자격증 등)
  generated/                 ← 생성된 PDF 파일 (약 3MB, 없어도 재생성 가능)
  thumbnails/                ← 빈 폴더 (자동 생성됨)
```

### 복사 방법
```bash
# 회사 PC에서 → USB 또는 클라우드로
# data/ 폴더 전체를 집 PC의 같은 위치에 복사

# data/ 폴더가 없으면 start.bat이 자동 생성하지만 DB는 비어있음
```

> **주의**: `data/` 폴더는 `.gitignore`에 포함되어 git으로 안 옮겨짐. 반드시 수동 복사.

---

## 6. 실행

```bash
# 시작 (더블클릭)
start.bat

# 자동으로:
#   - 백엔드 서버 (http://localhost:8000) 실행
#   - 프론트엔드 (http://localhost:5173) 실행
#   - 브라우저 자동 열기

# 종료
stop.bat
```

### 수동 실행 (터미널 2개)
```bash
# 터미널 1: 백엔드
cd backend
python -m uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트엔드
cd frontend
npm run dev
```

---

## 7. 동작 확인 체크리스트

| 항목 | 확인 방법 |
|------|----------|
| 백엔드 기동 | http://localhost:8000/api/health → `{"status": "ok"}` |
| Swagger 문서 | http://localhost:8000/api/docs |
| 프론트엔드 | http://localhost:5173 → 대시보드 표시 |
| DB 데이터 | 인력 목록 페이지에서 기존 인력 표시 |
| HWP 변환 | HWP 변환 페이지에서 .hwp 파일 업로드 → HTML 변환 |
| PDF 생성 | 입찰 워크스페이스에서 PDF 생성 버튼 클릭 |

---

## 8. 양쪽 PC 간 데이터 동기화

### 구글 드라이브 동기화 사용 시
- 코드 파일: 자동 동기화됨
- **DB 파일 충돌 주의**: 양쪽에서 동시에 실행하면 `bid_proposal.db` 충돌 가능
- 한쪽에서 `stop.bat`으로 종료 후 동기화 완료 확인 → 다른 쪽에서 시작

### GitHub 사용 시
```bash
# 작업 끝날 때 (회사/집 공통)
git add -A
git commit -m "작업 내용"
git push

# 작업 시작할 때
git pull
```
- DB와 업로드 파일은 git에 안 올라감 → 별도 동기화 필요 (드라이브/USB)

### 권장 워크플로우
1. **코드**: GitHub push/pull
2. **DB + uploads**: 구글 드라이브 동기화 또는 수동 복사
3. 작업 전 항상 `git pull` → 작업 후 `git push`

---

## 9. 트러블슈팅

| 증상 | 해결 |
|------|------|
| `python` 명령 안 됨 | Python 설치 시 PATH 추가 확인. 재부팅 후 재시도 |
| `pip install` 실패 | `pip install --upgrade pip` 후 재시도 |
| `npm install` 실패 | `node_modules` 삭제 후 `npm install` 재시도 |
| Playwright 에러 | `python -m playwright install chromium` 재실행 |
| hwp5html not found | `pip install pyhwp` 후 터미널 재시작 |
| 포트 이미 사용 중 | `stop.bat` 실행 또는 `netstat -ano \| findstr :8000` 으로 PID 확인 후 종료 |
| DB 빈 상태로 시작 | `data/db/bid_proposal.db` 파일 복사 확인 |
| uvicorn 코드 변경 안 반영 | `taskkill /F /IM python.exe` + `__pycache__` 삭제 후 재시작 |

---

## 10. 현재 미커밋 변경사항 (참고)

현재 회사 PC에 커밋되지 않은 변경사항이 있음:
- 편집기 개편 + 빈 박스 제거 + 자동 placeholder
- 회사정보/인감 + Settings 이미지 업로드
- PDF margin 0mm + HWP 백그라운드 변환

집 PC로 옮기기 전에 **커밋하거나**, 구글 드라이브 동기화로 파일 자체를 공유해야 함.
