# 정량제안서 작성 시스템 (Bid Proposal Builder)

## 프로젝트 개요

공공사업 입찰 시 제출하는 **정량제안서(정량서류)**를 효율적으로 작성하는 내부용 웹 시스템.

### 해결하는 문제
- 발주 기관마다 다른 양식(HWP)에 수작업으로 데이터를 채워넣는 반복 작업
- 참여 인력 정보를 매번 이전 문서에서 복사/수정하는 비효율
- 증빙서류 PDF를 수동으로 합치는 수작업

### 핵심 컨셉: "페이지 조합기"
1. 발주처 양식 HWP를 **pyhwp로 HTML 변환** (보조: Gemini AI)
2. 인력 DB에서 데이터를 끌어와 HTML 장표에 **자동 채움**
3. 증빙 PDF는 **원본 그대로** 첨부
4. 모든 장표를 **레이어 패널**에서 순서 조정 (드래그앤드롭)
5. **최종 하나의 PDF로 병합** 후 다운로드

### 사용자 규모
- 내부 직원 1~5명
- 사내 네트워크(IP)에서만 접근 가능
- 별도 로그인 없음

---

## 현재 진행 상황

| Phase | 상태 | 설명 |
|-------|------|------|
| Phase 0 | ✅ 완료 | 프로젝트 문서화 |
| Phase 1 | ✅ 완료 | 기반 인프라 + 인력관리 |
| Phase 1.5 | ✅ 완료 | 재직증명서 출력 기능 |
| Phase 2 | ✅ 완료 | AI 편집기 + HWP→HTML 변환 + 서식 선택기 + 편집기 연동 |
| Phase 3 | ✅ 완료 | 입찰 CRUD + 장표 조합기(BidWorkspace) + PDF 서비스 |
| Phase 4 | 미착수 | 마무리 (Docker 프로덕션, 설정, 백업) |

**최신 인수인계 문서**: `docs/handover-phase3.md` (전체 기능 구현 + 검증 완료, 세션7 반영)

---

## 기술 스택

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** + **lucide-react** (아이콘)
- **Monaco Editor** (@monaco-editor/react, HTML/CSS 코드 편집기)
- **@dnd-kit/core + @dnd-kit/sortable** (드래그앤드롭, BidWorkspace 장표 순서 조정)
- **React Router v6** (라우팅)
- **Axios** (API 통신)

### Backend
- **Python 3.11+** + **FastAPI** (비동기 웹 프레임워크)
- **SQLAlchemy 2.0** (ORM, DeclarativeBase 스타일)
- **Pydantic v2** (데이터 검증, pydantic-settings)

### AI
- **Google Gemini API** (gemini-2.5-flash, temperature 0.1~0.2)
  - PDF → HTML 변환
  - 자연어로 HTML 수정 요청 (diff 기반: 검색/치환 JSON)

### HWP 처리
- **pyhwp (python-hwp5)** (HWP5 → HTML 변환, hwp5html CLI)
  - `.hwp` 파일만 지원 (HWPX 미지원)
  - HTML + CSS 별도 생성 후 인라인 병합
  - 후처리: TableControl 구조 변환, .Normal text-align 제거, 폰트 정규화

### PDF 처리
- **Playwright** (Chromium headless, HTML→A4 PDF 변환, lazy init 브라우저 인스턴스)
- **PyPDF2** (PDF 합치기/분리/페이지 조작)
- **pdf2image** + **poppler** (PDF 페이지를 이미지 썸네일로 변환, 미구현)

### 데이터베이스
- **SQLite** (파일 기반, `data/db/bid_proposal.db`)
- 7개 테이블: personnel, certifications, project_history, bids, bid_pages, bid_personnel, page_library

### 배포
- **Docker Compose** (frontend nginx:80 + backend uvicorn:8000)
- 모든 데이터는 Docker 볼륨으로 호스트 PC에 저장

### 접근 제어
- **IP 화이트리스트** 미들웨어 (FastAPI)
- `config/allowed_ips.yaml`에서 허용 IP 관리
- `DEV_MODE=true`에서는 비활성화

---

## 프로젝트 구조 (실제 파일 기준)

```
bid-proposal-system/
├── CLAUDE.md                     # 이 파일 (프로젝트 가이드)
├── docker-compose.yml            # backend(8000) + frontend(80)
├── .env                          # GEMINI_API_KEY, DB 경로 등
├── .gitignore
│
├── docs/                         # 프로젝트 문서
│   ├── sop.md                    # 개발 SOP + 멀티에이전트 병렬 실행 가이드
│   ├── schema.md                 # DB 스키마 상세 (7개 테이블)
│   ├── api-spec.md               # API 엔드포인트 명세 (30+개)
│   ├── ui-spec.md                # 화면 흐름/와이어프레임 (8개 페이지)
│   └── handover-phase1.md        # Phase 1 인수인계 문서
│
├── frontend/                     # React 프론트엔드
│   ├── Dockerfile                # Node 빌드 → nginx 서빙
│   ├── nginx.conf                # SPA fallback + /api/ 프록시
│   ├── package.json              # react, axios, tailwindcss, lucide-react
│   ├── vite.config.ts            # Tailwind 플러그인 + API 프록시
│   └── src/
│       ├── App.tsx               # 라우터 (9개 경로)
│       ├── main.tsx              # 엔트리포인트
│       ├── index.css             # Tailwind 글로벌 스타일
│       ├── types/
│       │   └── index.ts          # TypeScript 타입 (Personnel, Bid 등)
│       ├── services/
│       │   └── api.ts            # Axios API 호출 (personnelApi, certificationApi 등)
│       ├── components/
│       │   ├── certificate/      # 재직증명서 출력 (모달, HTML템플릿, 로고/직인 base64)
│       │   ├── common/           # Pagination, SearchBar, Modal, ConfirmDialog
│       │   ├── editor/           # 장표 편집기 컴포넌트 (Phase 2)
│       │   │   ├── AiChatPanel.tsx      # AI 채팅 패널 (자연어 수정, PDF 업로드)
│       │   │   ├── CodeEditorPanel.tsx  # Monaco 코드 에디터 (HTML/CSS 탭)
│       │   │   └── PreviewPanel.tsx     # A4 실시간 미리보기 (iframe)
│       │   └── layout/           # Layout, Sidebar (접기/펴기), Header
│       └── pages/
│           ├── Dashboard.tsx     # 대시보드 (상태 카드 + 입찰 목록)
│           ├── PersonnelList.tsx # 인력 목록 (테이블, 검색, 필터, 페이지네이션)
│           ├── PersonnelEdit.tsx # 인력 등록/편집 (3탭: 기본정보/자격증/프로젝트이력) + 재직증명서 버튼
│           ├── PageEditor.tsx    # 장표 편집기 (3분할: AI채팅|코드|미리보기)
│           ├── Library.tsx       # 장표 보관함 (카드 그리드, 카테고리 필터)
│           ├── BidList.tsx       # 입찰 목록 (검색/필터/생성 모달)
│           ├── BidWorkspace.tsx  # 장표 조합기 (드래그앤드롭, 미리보기, 인력배정)
│           ├── HwpConverter.tsx  # HWP→HTML 변환 테스트 페이지
│           └── Settings.tsx      # 설정 (플레이스홀더)
│
├── backend/                      # Python FastAPI 백엔드
│   ├── Dockerfile                # Python 3.11 + fonts-noto-cjk + uvicorn
│   ├── requirements.txt          # fastapi, sqlalchemy, pydantic 등
│   └── app/
│       ├── main.py               # FastAPI 앱 (CORS, IP필터, 라우터, startup)
│       ├── config.py             # pydantic-settings 환경설정
│       ├── database.py           # SQLAlchemy 엔진/세션/get_db/create_tables + 간이 마이그레이션
│       ├── middleware/
│       │   └── ip_filter.py      # IP 화이트리스트 (YAML, 네트워크 대역 지원)
│       ├── models/
│       │   ├── personnel.py      # Personnel, Certification, ProjectHistory
│       │   └── bid.py            # Bid, BidPage, BidPersonnel, PageLibrary
│       ├── schemas/
│       │   ├── personnel.py      # Pydantic 스키마 (Create/Update/Summary/Detail/List)
│       │   └── bid.py            # 입찰/AI/장표라이브러리 스키마
│       ├── services/
│       │   ├── ai_service.py         # Gemini API 연동 (PDF→HTML, HTML diff 수정)
│       │   ├── libreoffice_service.py # HWP→HTML(pyhwp) + 서식 그룹핑/추출
│       │   └── pdf_service.py        # Playwright HTML→PDF + PyPDF2 병합
│       └── routers/
│           ├── personnel.py      # 인력 CRUD 13개 엔드포인트
│           ├── ai.py             # AI API (pdf-to-html, modify)
│           ├── bid.py            # 입찰 CRUD 11개 엔드포인트 (장표/인력 포함)
│           ├── library.py        # 장표 라이브러리 CRUD
│           └── hwp.py            # HWP 변환 API (to-html, convert, info)
│
├── data/                         # 데이터 저장소 (gitignore 대상)
│   ├── db/                       # SQLite DB 파일 (자동 생성)
│   ├── uploads/                  # 업로드 파일 (자격증, 공고문, 장표 PDF)
│   ├── thumbnails/               # PDF 썸네일 이미지
│   └── generated/                # 생성된 PDF 파일
│
└── config/
    └── allowed_ips.yaml          # IP 화이트리스트 설정
```

---

## 구현된 API 엔드포인트

### Phase 1: 인력 관리 (14개)

| Method | 경로 | 기능 |
|--------|------|------|
| GET | /api/personnel | 인력 목록 (검색, 부서 필터, 페이지네이션) |
| POST | /api/personnel | 인력 등록 |
| GET | /api/personnel/{id} | 인력 상세 (자격증, 이력 포함) |
| PUT | /api/personnel/{id} | 인력 수정 |
| DELETE | /api/personnel/{id} | 인력 삭제 |
| GET | /api/personnel/{id}/certifications | 자격증 목록 |
| POST | /api/personnel/{id}/certifications | 자격증 추가 (파일 업로드) |
| DELETE | /api/personnel/{id}/certifications/{cert_id} | 자격증 삭제 |
| GET | /api/personnel/{id}/certifications/{cert_id}/file | 자격증 파일 다운로드 |
| GET | /api/personnel/{id}/projects | 프로젝트 이력 목록 |
| POST | /api/personnel/{id}/projects | 프로젝트 이력 추가 |
| PUT | /api/personnel/{id}/projects/{project_id} | 프로젝트 이력 수정 |
| DELETE | /api/personnel/{id}/projects/{project_id} | 프로젝트 이력 삭제 |
| GET | /api/health | 헬스체크 |
| POST | /api/hwp/to-html | HWP→HTML 변환 + 서식 목록 (pyhwp) |
| POST | /api/hwp/extract-sections | 선택된 서식만 HTML 추출 |
| POST | /api/hwp/convert | HWP→PDF 변환 (LibreOffice, Windows 미동작) |
| POST | /api/hwp/info | HWP 파일 정보 (페이지 수) |
| POST | /api/ai/pdf-to-html | PDF→HTML AI 변환 (Gemini) |
| POST | /api/ai/modify | HTML 자연어 수정 (Gemini) |
| GET | /api/library | 장표 라이브러리 목록 |
| POST | /api/library | 장표 라이브러리 저장 |
| GET | /api/library/{id} | 장표 상세 조회 |
| DELETE | /api/library/{id} | 장표 삭제 |

### Phase 2: AI + 장표 라이브러리 (6개)

| Method | 경로 | 기능 |
|--------|------|------|
| POST | /api/ai/pdf-to-html | PDF → AI HTML/CSS 변환 (Gemini) |
| POST | /api/ai/modify | 자연어 요청으로 HTML/CSS 수정 |
| GET | /api/library | 장표 라이브러리 목록 (카테고리 필터) |
| POST | /api/library | 장표 라이브러리 저장 |
| GET | /api/library/{id} | 장표 상세 조회 (HTML/CSS 포함) |
| DELETE | /api/library/{id} | 장표 삭제 |

### Phase 3: 입찰 관리 + PDF (11개)

| Method | 경로 | 기능 |
|--------|------|------|
| GET | /api/bids/ | 입찰 목록 (검색/필터/페이지네이션) |
| POST | /api/bids/ | 입찰 생성 |
| GET | /api/bids/{id} | 입찰 상세 (pages, personnel 포함) |
| PUT | /api/bids/{id} | 입찰 수정 |
| DELETE | /api/bids/{id} | 입찰 삭제 (cascade + 파일 정리) |
| POST | /api/bids/{id}/pages/html | HTML 장표 추가 |
| POST | /api/bids/{id}/pages/pdf | PDF 파일 업로드 |
| PUT | /api/bids/{id}/pages/reorder | 장표 순서 변경 |
| PUT | /api/bids/{id}/pages/{page_id} | 장표 수정 |
| DELETE | /api/bids/{id}/pages/{page_id} | 장표 삭제 |
| POST | /api/bids/{id}/personnel | 인력 배정 |
| DELETE | /api/bids/{id}/personnel/{bp_id} | 인력 해제 |

---

## 코딩 컨벤션

### Python (Backend)
- FastAPI 라우터는 `/api/` 프리픽스 사용
- 함수명: snake_case
- 클래스명: PascalCase
- 비동기 함수: `async def` 사용
- 타입 힌트 필수
- Pydantic 모델로 요청/응답 검증
- 에러 처리: HTTPException 사용

### TypeScript (Frontend)
- 컴포넌트: 함수형 컴포넌트 + hooks (`export default function Component()`)
- 파일명: PascalCase (컴포넌트), camelCase (유틸)
- CSS: Tailwind 클래스 사용 (인라인 style 최소화)
- API 호출: services/api.ts에 중앙 관리
- 상태 관리: React useState/useReducer (필요시 Zustand)
- API 미연결 시 mock 데이터 fallback 패턴 사용

### 공통
- 한글 주석 사용 가능
- 커밋 메시지: 한글 허용 (예: "인력 CRUD API 추가")
- 환경변수: .env 파일에 관리 (GEMINI_API_KEY 등)

---

## 구현 순서

### Phase 0: 프로젝트 문서화 ✅
### Phase 1: 기반 인프라 + 인력관리 ✅
### Phase 1.5: 재직증명서 출력 ✅
- 인력 편집 페이지에서 [재직증명서] 버튼 → 설정 모달 → 새 창 HTML 렌더링 → Ctrl+P 인쇄
- 주민등록번호 DB 저장 (출력 시 뒷자리 마스킹)
- 증명서 번호 localStorage 자동증가 (수동 변경 가능)
- Pretendard 폰트(CDN), KOIS 로고 + 직인 이미지 base64 인라인
### Phase 2: AI 편집기 + HWP 변환 ✅
- Gemini API 연동 (gemini-2.5-flash) - PDF→HTML 변환, 자연어 HTML 수정 (diff 기반)
- 장표 편집기 (3분할: AI채팅 | Monaco코드에디터 | A4미리보기)
- AI 채팅 패널 (자연어 수정 요청 + PDF/HWP 업로드 변환)
- 장표 라이브러리 CRUD (저장/불러오기/삭제, 카테고리 필터) — 동작 확인 완료
- 독립 편집기 경로 (/editor) + 입찰 내 편집 경로 (/bids/:id/pages/:pageId/edit)
- **HWP→HTML 변환** (pyhwp 기반) - 표/양식 구조 유지, 폰트 정규화, 정렬 보정
- **서식 선택기** - `[ 서식 N ]` 패턴 기준 그룹핑, 체크박스 UI로 원하는 서식만 편집기로
- HWP→편집기 연동 (sessionStorage, StrictMode 대응)
- 참고: Gemini AI 수정은 GEMINI_API_KEY 설정 후 실사용 테스트 필요
### Phase 3: 장표 조합기 + PDF 출력 ✅
- 입찰 CRUD API 11개 엔드포인트 (`backend/app/routers/bid.py`)
- BidList 페이지 — 입찰 목록/검색/필터/생성 모달
- BidWorkspace 페이지 — 드래그앤드롭 장표 순서 조정 (@dnd-kit), iframe 미리보기
- 장표 추가 3가지: 라이브러리 불러오기, 새 장표(편집기), PDF 업로드
- 인력 배정/해제 (인력 검색, 중복 방지)
- PDF 서비스 (`backend/app/services/pdf_service.py`) — Playwright HTML→PDF + PyPDF2 병합
- 참고: `playwright install chromium` 실행 후 PDF 생성 실 테스트 필요
### Phase 4: 마무리 (Docker 프로덕션, 설정, 백업)

각 Phase의 상세 내용은 docs/sop.md 참조.
Phase별 인수인계는 docs/handover-phase*.md 참조.

---

## 실행 방법

### 로컬 개발 (백엔드 + 프론트엔드)
```bash
# 터미널 1: 백엔드
cd backend && uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트엔드
cd frontend && npm install && npm run dev
```
- 프론트엔드: http://localhost:5173
- 백엔드 Swagger: http://localhost:8000/api/docs

### Docker
```bash
docker-compose up --build
```
- 프론트엔드: http://localhost (포트 80)
- 백엔드: http://localhost:8000/api/docs

---

## 주요 결정사항 (변경 이력)

| 날짜 | 결정사항 | 이유 |
|------|---------|------|
| 2026-02-24 | 복잡한 템플릿 시스템 대신 "페이지 조합기" 방식 채택 | 단순하고 빠른 작업 흐름 |
| 2026-02-24 | HWP 대신 HTML→PDF 방식 | HWP 의존성 제거, 웹 기반으로 유연하게 |
| 2026-02-24 | Gemini API로 PDF→HTML 자동 변환 | 비개발자도 양식 생성 가능 |
| 2026-02-24 | SQLite 선택 | 1~5명 규모, 내부 PC 저장, 설치 간편 |
| 2026-02-24 | IP 제어만 (로그인 없음) | 소규모 내부 팀, 사용 편의성 우선 |
| 2026-02-24 | 증빙 PDF는 원본 그대로 병합 | 화질 손실 방지 |
| 2026-02-24 | shadcn/ui 대신 Tailwind + lucide-react 조합 | 설치 복잡도 감소, 직접 컴포넌트 구현 |
| 2026-02-24 | Alembic 마이그레이션 미사용 (Phase 1) | 초기 개발 단계, create_all로 충분 |
| 2026-02-24 | 멀티에이전트 병렬 개발 (worktree 격리) | 백엔드/프론트엔드 동시 개발 효율화 |
| 2026-02-25 | 재직증명서를 백엔드 PDF 생성 대신 프론트 HTML+브라우저 인쇄 방식 | 서버 의존성 없이 즉시 출력 가능 |
| 2026-02-25 | Pretendard 폰트 CDN 사용 | 한글 웹폰트 중 가장 범용적, 인쇄 품질 우수 |
| 2026-02-25 | 간이 마이그레이션(ALTER TABLE) 도입 | Alembic 없이 기존 DB 호환 유지 |
| 2026-02-25 | gemini-2.0-flash 모델 사용 (temperature 0.1~0.2) | 정확한 변환 우선, 비용 대비 성능 최적 |
| 2026-02-25 | 장표 편집기를 독립 경로(/editor)로 분리 | 입찰 없이도 장표 생성/편집 가능 |
| 2026-02-25 | Monaco Editor vs-dark 테마 | 코드 가독성, 개발자 친화적 |
| 2026-02-25 | Gemini PDF→HTML 대신 pyhwp HWP→HTML 채택 | Gemini 변환 품질 부족, pyhwp가 표/양식 구조 정확히 유지 |
| 2026-02-25 | pyhwp (python-hwp5) 라이브러리 사용 | HWP5 형식 직접 파싱, hwp5html CLI로 HTML+CSS 생성 |
| 2026-02-25 | LibreOffice HWP 변환 포기 (Windows) | LibreOffice 26.2 Windows 빌드에 HWP 필터 DLL 누락 |
| 2026-02-25 | HTML 후처리로 TableControl 구조 변환 | HTML 파서가 p 안의 table을 분리시키는 문제 해결 |
| 2026-02-25 | 서식 그룹핑: `[ 서식 N ]` 패턴 기준 | 개별 TableControl(25개)→서식 단위(14개)로 양식 깨짐 방지 |
| 2026-02-25 | Gemini AI 수정을 diff 방식으로 변경 | 대용량 HTML(170KB+)에서 전체 재생성 불가 → 검색/치환 JSON |
| 2026-02-25 | HWP→편집기 연동에 sessionStorage 사용 | 페이지 간 대용량 데이터 전달, StrictMode 대응 useRef 패턴 |
| 2026-02-25 | @dnd-kit 드래그앤드롭 라이브러리 사용 | React 친화적, 접근성 지원, 경량 |
| 2026-02-25 | Playwright lazy init 패턴 (pdf_service) | 서버 시작 시 부담 없이, 첫 요청 시 Chromium 초기화 |
| 2026-02-25 | 입찰 삭제 시 cascade + 물리 파일 정리 | DB + 파일 시스템 일관성 유지 |
| 2026-02-25 | API trailing slash 규칙 통일 (FastAPI) | list/create는 `/`, 개별 리소스는 `/{id}` |
| 2026-02-25 | 멀티에이전트 팀 병렬 개발 (Phase 3) | backend-dev + frontend-dev + reviewer 역할 분리 |
