# 정량제안서 작성 시스템 (Bid Proposal Builder)

## 프로젝트 개요

공공사업 입찰 시 제출하는 **정량제안서(정량서류)**를 효율적으로 작성하는 내부용 웹 시스템.

### 해결하는 문제
- 발주 기관마다 다른 양식(HWP)에 수작업으로 데이터를 채워넣는 반복 작업
- 참여 인력 정보를 매번 이전 문서에서 복사/수정하는 비효율
- 증빙서류 PDF를 수동으로 합치는 수작업

### 핵심 컨셉: "페이지 조합기"
1. 발주처 양식 PDF를 **AI(Gemini)가 HTML로 자동 변환**
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
| Phase 1 | ✅ 코드 완료 (실행 확인 대기) | 기반 인프라 + 인력관리 |
| Phase 2 | 미착수 | AI 장표 생성 + 편집기 |
| Phase 3 | 미착수 | 장표 조합기 + PDF 출력 |
| Phase 4 | 미착수 | 마무리 (Docker 프로덕션, 설정, 백업) |

**최신 인수인계 문서**: `docs/handover-phase1.md`

---

## 기술 스택

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** + **lucide-react** (아이콘)
- **Monaco Editor** (HTML 코드 편집기, Phase 2 예정)
- **@dnd-kit/core** (드래그앤드롭, Phase 3 예정)
- **React Router v6** (라우팅)
- **Axios** (API 통신)

### Backend
- **Python 3.11+** + **FastAPI** (비동기 웹 프레임워크)
- **SQLAlchemy 2.0** (ORM, DeclarativeBase 스타일)
- **Pydantic v2** (데이터 검증, pydantic-settings)

### AI (Phase 2 예정)
- **Google Gemini API** (gemini-2.0-flash 또는 pro)
  - PDF → HTML 변환
  - 자연어로 HTML 수정 요청

### PDF 처리 (Phase 3 예정)
- **Playwright** (Chromium 기반 HTML→PDF 변환, 한글 완벽 지원)
- **PyPDF2** (PDF 합치기/분리/페이지 조작)
- **pdf2image** + **poppler** (PDF 페이지를 이미지 썸네일로 변환)

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
│       ├── App.tsx               # 라우터 (7개 경로)
│       ├── main.tsx              # 엔트리포인트
│       ├── index.css             # Tailwind 글로벌 스타일
│       ├── types/
│       │   └── index.ts          # TypeScript 타입 (Personnel, Bid 등)
│       ├── services/
│       │   └── api.ts            # Axios API 호출 (personnelApi, certificationApi 등)
│       ├── components/
│       │   ├── common/           # Pagination, SearchBar, Modal, ConfirmDialog
│       │   └── layout/           # Layout, Sidebar (접기/펴기), Header
│       └── pages/
│           ├── Dashboard.tsx     # 대시보드 (상태 카드 + 입찰 목록)
│           ├── PersonnelList.tsx # 인력 목록 (테이블, 검색, 필터, 페이지네이션)
│           ├── PersonnelEdit.tsx # 인력 등록/편집 (3탭: 기본정보/자격증/프로젝트이력)
│           ├── BidList.tsx       # 입찰 목록 (플레이스홀더)
│           └── Settings.tsx      # 설정 (플레이스홀더)
│
├── backend/                      # Python FastAPI 백엔드
│   ├── Dockerfile                # Python 3.11 + fonts-noto-cjk + uvicorn
│   ├── requirements.txt          # fastapi, sqlalchemy, pydantic 등
│   └── app/
│       ├── main.py               # FastAPI 앱 (CORS, IP필터, 라우터, startup)
│       ├── config.py             # pydantic-settings 환경설정
│       ├── database.py           # SQLAlchemy 엔진/세션/get_db/create_tables
│       ├── middleware/
│       │   └── ip_filter.py      # IP 화이트리스트 (YAML, 네트워크 대역 지원)
│       ├── models/
│       │   ├── personnel.py      # Personnel, Certification, ProjectHistory
│       │   └── bid.py            # Bid, BidPage, BidPersonnel, PageLibrary
│       ├── schemas/
│       │   ├── personnel.py      # Pydantic 스키마 (Create/Update/Summary/Detail/List)
│       │   └── bid.py            # 입찰 기본 스키마 (Phase 3 확장 예정)
│       └── routers/
│           └── personnel.py      # 인력 CRUD 13개 엔드포인트
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

## 구현된 API 엔드포인트 (Phase 1)

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
### Phase 1: 기반 인프라 + 인력관리 ✅ (실행 확인 대기)
### Phase 2: AI 장표 생성 + 편집기
### Phase 3: 장표 조합기 + PDF 출력
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
