# Phase 1 인수인계 문서

**작성일**: 2026-02-24
**상태**: Phase 1 코드 생성 완료, 실행 확인 대기

---

## 1. 현재 진행 상황

### 완료된 Phase
- [x] **Phase 0**: 프로젝트 문서화 (CLAUDE.md, sop.md, schema.md, api-spec.md, ui-spec.md)
- [x] **Phase 1**: 기반 인프라 + 인력관리 (코드 생성 + 검수 완료)

### 미완료 Phase
- [ ] Phase 2: AI 장표 생성 + 편집기
- [ ] Phase 3: 장표 조합기 + PDF 출력
- [ ] Phase 4: 마무리 (Docker 프로덕션, 설정, 백업)

---

## 2. Phase 1에서 생성된 파일 목록

### 프로젝트 루트
```
.gitignore                    # Python/Node/데이터 제외 규칙
.env                          # 환경변수 (GEMINI_API_KEY, DB 경로 등)
docker-compose.yml            # backend(8000) + frontend(80) 서비스
config/allowed_ips.yaml       # IP 화이트리스트 (127.0.0.1, 192.168.0.0/24, 10.0.0.0/8)
data/                         # DB, 업로드, 썸네일, 생성파일 디렉토리 (빈 상태)
```

### backend/ (Python FastAPI)
```
backend/
├── Dockerfile                # Python 3.11 + uvicorn
├── requirements.txt          # fastapi, sqlalchemy, pydantic 등
└── app/
    ├── __init__.py
    ├── main.py               # FastAPI 앱 (CORS, 라우터 등록, startup)
    ├── config.py              # pydantic-settings 환경설정
    ├── database.py            # SQLAlchemy 엔진/세션/get_db
    ├── middleware/
    │   └── ip_filter.py       # IP 화이트리스트 미들웨어
    ├── models/
    │   ├── personnel.py       # Personnel, Certification, ProjectHistory
    │   └── bid.py             # Bid, BidPage, BidPersonnel, PageLibrary
    ├── schemas/
    │   ├── personnel.py       # 인력 Pydantic 스키마 (요청/응답)
    │   └── bid.py             # 입찰 기본 스키마
    └── routers/
        └── personnel.py       # 인력 CRUD 13개 엔드포인트
```

### frontend/ (React + TypeScript + Vite)
```
frontend/
├── Dockerfile                # Node 빌드 → nginx 서빙
├── nginx.conf                # SPA fallback + /api/ 프록시
├── package.json              # react, react-router-dom, axios, tailwindcss, lucide-react
├── vite.config.ts            # Tailwind 플러그인 + API 프록시
├── tsconfig.json
└── src/
    ├── main.tsx              # 엔트리포인트
    ├── App.tsx               # 라우터 (7개 경로)
    ├── index.css             # Tailwind 글로벌 스타일
    ├── types/index.ts        # TypeScript 타입 정의
    ├── services/api.ts       # Axios API 호출 레이어
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.tsx    # 전체 레이아웃 (Sidebar + Header + Outlet)
    │   │   ├── Sidebar.tsx   # 사이드바 (접기/펴기, 5개 메뉴)
    │   │   └── Header.tsx    # 상단 헤더 (동적 페이지 제목)
    │   └── common/
    │       ├── Pagination.tsx
    │       ├── SearchBar.tsx
    │       ├── Modal.tsx
    │       └── ConfirmDialog.tsx
    └── pages/
        ├── Dashboard.tsx     # 대시보드 (상태 카드 + 진행중 입찰 목록)
        ├── PersonnelList.tsx # 인력 목록 (테이블, 검색, 필터, 페이지네이션)
        ├── PersonnelEdit.tsx # 인력 등록/편집 (3탭: 기본정보/자격증/프로젝트이력)
        ├── BidList.tsx       # 입찰 목록 (플레이스홀더)
        └── Settings.tsx      # 설정 (플레이스홀더)
```

---

## 3. 구현된 기능 상세

### 3.1 백엔드 API 엔드포인트 (13개)

| # | Method | 경로 | 기능 |
|---|--------|------|------|
| 1 | GET | /api/personnel | 인력 목록 (검색, 부서 필터, 페이지네이션) |
| 2 | POST | /api/personnel | 인력 등록 |
| 3 | GET | /api/personnel/{id} | 인력 상세 (자격증, 이력 포함) |
| 4 | PUT | /api/personnel/{id} | 인력 수정 |
| 5 | DELETE | /api/personnel/{id} | 인력 삭제 (CASCADE) |
| 6 | GET | /api/personnel/{id}/certifications | 자격증 목록 |
| 7 | POST | /api/personnel/{id}/certifications | 자격증 추가 (파일 업로드) |
| 8 | DELETE | /api/personnel/{id}/certifications/{cert_id} | 자격증 삭제 |
| 9 | GET | /api/personnel/{id}/certifications/{cert_id}/file | 자격증 파일 다운로드 |
| 10 | GET | /api/personnel/{id}/projects | 프로젝트 이력 목록 |
| 11 | POST | /api/personnel/{id}/projects | 프로젝트 이력 추가 |
| 12 | PUT | /api/personnel/{id}/projects/{project_id} | 프로젝트 이력 수정 |
| 13 | DELETE | /api/personnel/{id}/projects/{project_id} | 프로젝트 이력 삭제 |

추가: `GET /api/health` (헬스체크)

### 3.2 DB 모델 (7개 테이블)

| 테이블 | 용도 | Phase |
|--------|------|-------|
| personnel | 인력 기본정보 | Phase 1 (사용중) |
| certifications | 자격증 | Phase 1 (사용중) |
| project_history | 프로젝트 이력 | Phase 1 (사용중) |
| bids | 입찰 프로젝트 | Phase 3에서 사용 |
| bid_pages | 입찰 장표 | Phase 3에서 사용 |
| bid_personnel | 입찰 배정 인력 | Phase 3에서 사용 |
| page_library | 장표 라이브러리 | Phase 2에서 사용 |

### 3.3 프론트엔드 페이지

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | Dashboard | mock 데이터로 동작 |
| `/personnel` | PersonnelList | API 연동 + mock fallback |
| `/personnel/new` | PersonnelEdit (등록) | API 연동 + mock fallback |
| `/personnel/:id/edit` | PersonnelEdit (편집) | API 연동 + mock fallback |
| `/bids` | BidList | 플레이스홀더 |
| `/library` | 장표 보관함 | 플레이스홀더 |
| `/settings` | Settings | 플레이스홀더 |

---

## 4. 검수 결과 (reviewer 보고서)

### 통과 (21/22 항목)
- 백엔드 모델: schema.md와 100% 일치
- 백엔드 라우터: 13개 엔드포인트 모두 구현
- 프론트엔드: 모든 페이지, 라우팅, 컴포넌트 존재
- Docker: 정상 구성
- 코딩 컨벤션: 준수

### 발견 → 수정 완료된 문제 (5건)

| # | 문제 | 수정 내용 |
|---|------|----------|
| 1 | 자격증 파일 업로드 파라미터명 불일치 (백엔드 `cert_file` vs 프론트 `file`) | 백엔드를 `file`로 통일 |
| 2 | `/library` 라우트 미등록 (Sidebar에 링크는 있으나 라우트 없음) | App.tsx에 플레이스홀더 추가 |
| 3 | docker-compose.yml의 DATABASE_URL 슬래시 부족 | `sqlite:////data/db/...` (4개)로 수정 |
| 4 | 프론트엔드 타입에서 nullable 필드가 `string`으로 정의 | `string | null`로 수정 |
| 5 | `years_of_experience` null일 때 "null년" 표시 | `?? '-'` 처리 추가 |

---

## 5. 실행 확인 방법

### 5.1 백엔드 단독 실행

```bash
# 프로젝트 루트에서
cd backend

# 의존성 설치 (최초 1회)
pip install -r requirements.txt

# 서버 시작
uvicorn app.main:app --reload --port 8000

# 확인
# 브라우저에서 http://localhost:8000/api/docs 접속 → Swagger UI
# GET /api/health → {"status": "ok"} 확인
```

### 5.2 프론트엔드 단독 실행

```bash
# 프로젝트 루트에서
cd frontend

# 의존성 설치 (최초 1회)
npm install

# 개발서버 시작
npm run dev

# 확인
# 브라우저에서 http://localhost:5173 접속
# 사이드바 메뉴 클릭 → 페이지 이동 확인
# 인력관리 → 목록 (mock 데이터 5명 표시)
# 인력 추가 → 3탭 폼 표시
```

### 5.3 백엔드 + 프론트엔드 연동 확인

```bash
# 터미널 1: 백엔드
cd backend && uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트엔드
cd frontend && npm run dev

# 확인 순서
# 1. http://localhost:5173/personnel → 목록 페이지
# 2. [인력 추가] 클릭 → 등록 폼
# 3. 이름 입력 후 [저장] → API 호출 → 목록에 반영
# 4. 인력 클릭 → 편집 페이지 (자격증 탭, 프로젝트 이력 탭)
# 5. http://localhost:8000/api/docs → Swagger UI에서 직접 API 테스트
```

### 5.4 Docker로 실행 (선택)

```bash
# 프로젝트 루트에서
docker-compose up --build

# 확인
# http://localhost (프론트엔드, 포트 80)
# http://localhost:8000/api/docs (백엔드 Swagger)
```

---

## 6. 확인 후 체크리스트

실행 확인 시 아래 항목을 체크해주세요:

### 백엔드
- [ ] `uvicorn app.main:app --reload` 정상 시작
- [ ] Swagger UI (`/api/docs`) 접속 가능
- [ ] 인력 등록 API (POST /api/personnel) 동작
- [ ] 인력 목록 API (GET /api/personnel) 동작
- [ ] 인력 상세 API (GET /api/personnel/{id}) 동작
- [ ] 자격증 추가 API (파일 업로드 포함) 동작
- [ ] 프로젝트 이력 CRUD 동작

### 프론트엔드
- [ ] `npm run dev` 정상 시작
- [ ] 사이드바 메뉴 이동 정상
- [ ] 인력 목록 페이지 표시 (mock 또는 API 데이터)
- [ ] 인력 등록 폼 3탭 전환 정상
- [ ] 자격증 추가 모달 동작
- [ ] 프로젝트 이력 추가/편집 모달 동작

### 연동
- [ ] 프론트엔드에서 인력 등록 → 백엔드 DB에 저장
- [ ] 등록한 인력이 목록에 표시
- [ ] 편집/삭제 정상 동작

---

## 7. 알려진 제한사항 / 참고사항

1. **Python 버전**: 현재 PC에 Python 3.14 설치됨. requirements.txt는 버전 제약을 유연하게 설정해둠 (`>=`). 이미 설치된 패키지로 동작 확인됨.

2. **mock 데이터**: 프론트엔드는 API 연결 실패 시 자동으로 mock 데이터를 표시. 백엔드 없이도 UI 확인 가능.

3. **IP 미들웨어**: `DEV_MODE=true` (기본값)에서는 IP 필터 비활성화. 프로덕션 배포 시 `false`로 변경 필요.

4. **DB 파일 위치**: 로컬 실행 시 `data/db/bid_proposal.db`에 자동 생성. Docker 실행 시 볼륨 마운트로 호스트에 저장.

5. **한글 폰트**: Dockerfile에 `fonts-noto-cjk` 포함. 로컬 실행 시에는 OS 폰트 사용.

---

## 8. 다음 단계 (Phase 2)

Phase 1 확인 완료 후 진행할 내용:

| 항목 | 백엔드 | 프론트엔드 |
|------|--------|-----------|
| AI 연동 | Gemini API 서비스 + 라우터 | PDF 업로드 → AI HTML 생성 UI |
| 장표 편집기 | 자연어 수정 API | Monaco 코드 편집기 + AI 채팅 패널 + 미리보기 (3분할) |
| 장표 라이브러리 | CRUD API | 저장/불러오기 UI |

---

## 9. 문서 참조

| 문서 | 경로 | 내용 |
|------|------|------|
| 프로젝트 가이드 | `CLAUDE.md` | 전체 개요, 기술스택, 코딩 컨벤션 |
| 개발 SOP | `docs/sop.md` | 작업 순서, 병렬 실행 가이드, 검수 기준 |
| DB 스키마 | `docs/schema.md` | 7개 테이블 상세, ERD, 파일 경로 규칙 |
| API 명세 | `docs/api-spec.md` | 30+ 엔드포인트 명세 |
| UI 명세 | `docs/ui-spec.md` | 8개 페이지 와이어프레임, 라우팅 |
| **이 문서** | `docs/handover-phase1.md` | Phase 1 인수인계 |
