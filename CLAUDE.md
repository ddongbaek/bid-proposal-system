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

## 기술 스택

### Frontend
- **React 18** + TypeScript + Vite
- **Tailwind CSS** + **shadcn/ui** (UI 컴포넌트)
- **Monaco Editor** (HTML 코드 편집기, VS Code와 동일)
- **@dnd-kit/core** (드래그앤드롭)
- **React Router v6** (라우팅)
- **Axios** (API 통신)

### Backend
- **Python 3.11+** + **FastAPI** (비동기 웹 프레임워크)
- **SQLAlchemy 2.0** (ORM)
- **Pydantic v2** (데이터 검증)
- **Alembic** (DB 마이그레이션)

### AI
- **Google Gemini API** (gemini-2.0-flash 또는 pro)
  - PDF → HTML 변환
  - 자연어로 HTML 수정 요청

### PDF 처리
- **Playwright** (Chromium 기반 HTML→PDF 변환, 한글 완벽 지원)
- **PyPDF2** (PDF 합치기/분리/페이지 조작)
- **pdf2image** + **poppler** (PDF 페이지를 이미지 썸네일로 변환)

### 데이터베이스
- **SQLite** (파일 기반, 내부 PC에 저장)
- data/db/ 디렉토리에 단일 파일로 존재

### 배포
- **Docker Compose** (frontend nginx + backend uvicorn)
- 모든 데이터는 Docker 볼륨으로 호스트 PC에 저장

### 접근 제어
- **IP 화이트리스트** 미들웨어 (FastAPI)
- config/allowed_ips.yaml에서 허용 IP 관리

---

## 프로젝트 구조

```
bid-proposal-system/
├── CLAUDE.md                     # 이 파일 (프로젝트 가이드)
├── docker-compose.yml
├── .env                          # GEMINI_API_KEY, 기타 환경변수
│
├── docs/                         # 프로젝트 문서
│   ├── sop.md                    # 개발 SOP
│   ├── schema.md                 # DB 스키마 상세
│   ├── api-spec.md               # API 엔드포인트 명세
│   └── ui-spec.md                # 화면 흐름/와이어프레임
│
├── frontend/                     # React 프론트엔드
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── App.tsx               # 라우터 설정
│       ├── main.tsx              # 엔트리포인트
│       ├── components/
│       │   ├── common/           # 공통 UI (Button, Modal, Table 등)
│       │   ├── layout/           # 레이아웃 (Sidebar, Header)
│       │   ├── personnel/        # 인력 관리 컴포넌트
│       │   ├── bid/              # 입찰 관리 컴포넌트
│       │   ├── page-composer/    # 장표 조합기 (레이어 패널, 드래그)
│       │   ├── page-editor/      # 장표 편집기 (Monaco, AI채팅, 미리보기)
│       │   └── pdf/              # PDF 관련 (썸네일, 뷰어)
│       ├── pages/                # 페이지 컴포넌트
│       │   ├── Dashboard.tsx     # 대시보드
│       │   ├── PersonnelList.tsx # 인력 목록
│       │   ├── PersonnelEdit.tsx # 인력 등록/편집
│       │   ├── BidList.tsx       # 입찰 목록
│       │   ├── BidWorkspace.tsx  # 입찰 작업 화면 (핵심)
│       │   ├── PageEditor.tsx    # 장표 편집
│       │   └── Settings.tsx      # 설정
│       ├── services/
│       │   └── api.ts            # API 호출 함수
│       └── types/
│           └── index.ts          # TypeScript 타입 정의
│
├── backend/                      # Python FastAPI 백엔드
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py               # FastAPI 앱 설정
│       ├── config.py             # 환경 설정
│       ├── database.py           # DB 연결
│       ├── middleware/
│       │   └── ip_filter.py      # IP 화이트리스트
│       ├── models/               # SQLAlchemy 모델
│       │   ├── personnel.py
│       │   └── bid.py
│       ├── schemas/              # Pydantic 스키마 (요청/응답)
│       │   ├── personnel.py
│       │   └── bid.py
│       ├── routers/              # API 라우터
│       │   ├── personnel.py      # /api/personnel
│       │   ├── bids.py           # /api/bids
│       │   ├── pages.py          # /api/bids/{id}/pages
│       │   ├── ai.py             # /api/ai/pdf-to-html, /api/ai/modify
│       │   ├── pdf.py            # /api/pdf/generate, /api/pdf/merge
│       │   └── library.py        # /api/library
│       └── services/             # 비즈니스 로직
│           ├── pdf_service.py    # HTML→PDF, PDF 병합, PDF→이미지
│           ├── ai_service.py     # Gemini API 연동
│           └── page_service.py   # 장표 자동 생성
│
├── data/                         # Docker 볼륨 마운트 (데이터 저장소)
│   ├── db/                       # SQLite DB 파일
│   ├── uploads/                  # 업로드된 파일 (자격증, 증빙 PDF)
│   ├── thumbnails/               # PDF 페이지 썸네일 이미지
│   └── generated/                # 생성된 PDF 파일
│
└── config/
    └── allowed_ips.yaml          # IP 화이트리스트 설정
```

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
- 컴포넌트: 함수형 컴포넌트 + hooks
- 파일명: PascalCase (컴포넌트), camelCase (유틸)
- CSS: Tailwind 클래스 사용 (인라인 style 최소화)
- API 호출: services/api.ts에 중앙 관리
- 상태 관리: React useState/useReducer (필요시 Zustand)

### 공통
- 한글 주석 사용 가능
- 커밋 메시지: 한글 허용 (예: "인력 CRUD API 추가")
- 환경변수: .env 파일에 관리 (GEMINI_API_KEY 등)

---

## 구현 순서

### Phase 0: 프로젝트 문서화 ✅ (현재)
### Phase 1: 기반 인프라 + 인력관리
### Phase 2: AI 장표 생성 + 편집기
### Phase 3: 장표 조합기 + PDF 출력
### Phase 4: 마무리 (Docker 프로덕션, 설정, 백업)

각 Phase의 상세 내용은 docs/sop.md 참조.

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
