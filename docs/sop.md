# 개발 SOP (Standard Operating Procedure)

## 개발 에이전트 팀 구성

### 팀 구성
| 에이전트 | 역할 | 담당 영역 |
|---------|------|----------|
| **team-lead** | 총괄/조율 | 작업 분배, 진행 관리, 사용자 소통 |
| **backend-dev** | 백엔드 개발 | FastAPI, DB 모델, API, 서비스 로직 |
| **frontend-dev** | 프론트엔드 개발 | React, UI 컴포넌트, 페이지, 스타일링 |
| **reviewer** | 검수/테스트 | 코드 리뷰, API 테스트, UI 테스트, 문제 보고 |

### 작업 흐름
```
team-lead가 Phase별 작업을 분배
    ↓
backend-dev + frontend-dev 동시 작업 (병렬)
    ↓
완성된 부분을 reviewer가 즉시 테스트
    ↓
문제 발견 시 해당 에이전트에 수정 요청
    ↓
수정 완료 → reviewer 재검증
    ↓
Phase 완료 → 다음 Phase로
```

### 에이전트 간 의존성 관리
- backend-dev가 API를 먼저 만들면 → frontend-dev가 해당 API에 연결
- 동시에 작업할 수 없는 경우(API 미완성 등) → mock 데이터로 프론트 먼저 진행
- reviewer는 완성된 부분부터 순차적으로 테스트

---

## 멀티에이전트 병렬 실행 가이드

### 실행 방식: Claude Code Task Tool

team-lead(메인 에이전트)가 `Task` tool을 사용해 서브에이전트를 spawn한다.
**하나의 메시지에서 여러 Task tool을 동시 호출하면 병렬 실행**된다.

### 에이전트 spawn 설정

| 에이전트 | subagent_type | isolation | mode |
|---------|---------------|-----------|------|
| backend-dev | `Bash` | `worktree` | `bypassPermissions` |
| frontend-dev | `Bash` | `worktree` | `bypassPermissions` |
| reviewer | `general-purpose` | (없음) | `default` |

- **worktree 격리**: backend-dev와 frontend-dev는 각각 독립 git worktree에서 작업하여 파일 충돌 방지
- **bypassPermissions**: 파일 생성/수정이 많으므로 매번 승인 없이 진행
- reviewer는 코드를 읽기만 하므로 격리 불필요

### 프롬프트 구조

각 에이전트에 전달하는 프롬프트는 반드시 아래 구조를 포함해야 한다:

```
1. 역할 선언
   "너는 backend-dev 에이전트이다."

2. 컨텍스트 문서 경로 (반드시 읽고 시작)
   - CLAUDE.md
   - docs/schema.md (백엔드) 또는 docs/ui-spec.md (프론트엔드)
   - docs/api-spec.md (공통)

3. 이번 작업의 구체적 할 일 목록
   - 생성할 파일 목록과 경로
   - 구현할 기능 상세
   - 참조할 스키마/API 명세의 구체적 섹션

4. 제약 조건
   - 수정 가능한 디렉토리 범위 (backend/ 또는 frontend/)
   - 코딩 컨벤션 (CLAUDE.md 참조)
   - 다른 에이전트 영역 파일 수정 금지

5. 완료 기준
   - 모든 파일 생성 완료
   - 서버/빌드 에러 없이 실행 가능한 상태
```

### 병렬 실행 예시 (Phase 1)

team-lead가 **하나의 응답**에서 아래 두 Task를 동시 호출:

```
Task 1: backend-dev
─────────────────────────────────
name: "backend-dev"
subagent_type: "Bash"
isolation: "worktree"
mode: "bypassPermissions"
prompt: |
  너는 backend-dev 에이전트이다.

  먼저 아래 문서를 읽어라:
  - CLAUDE.md (프로젝트 개요, 코딩 컨벤션)
  - docs/schema.md (DB 스키마)
  - docs/api-spec.md (API 명세)

  [Phase 1 백엔드 작업]
  1. backend/ 폴더 구조 생성
  2. requirements.txt 작성
  3. FastAPI main.py 셋업
  4. database.py (SQLite + SQLAlchemy)
  5. models/ (personnel, certifications, project_history)
  6. schemas/ (Pydantic 요청/응답)
  7. routers/personnel.py (CRUD API)
  8. middleware/ip_filter.py
  9. config.py

  제약: backend/ 디렉토리만 수정.
  완료 기준: uvicorn으로 서버 시작 가능한 상태.
```

```
Task 2: frontend-dev
─────────────────────────────────
name: "frontend-dev"
subagent_type: "Bash"
isolation: "worktree"
mode: "bypassPermissions"
prompt: |
  너는 frontend-dev 에이전트이다.

  먼저 아래 문서를 읽어라:
  - CLAUDE.md (프로젝트 개요, 코딩 컨벤션)
  - docs/ui-spec.md (화면 명세)
  - docs/api-spec.md (API 명세)

  [Phase 1 프론트엔드 작업]
  1. Vite + React + TypeScript 프로젝트 초기화
  2. Tailwind CSS + shadcn/ui 설치 및 설정
  3. 레이아웃 (Sidebar, Header)
  4. React Router 라우팅
  5. services/api.ts (API 호출 레이어)
  6. PersonnelList 페이지
  7. PersonnelEdit 페이지 (3탭: 기본정보/자격증/프로젝트이력)
  8. types/index.ts (TypeScript 타입)

  제약: frontend/ 디렉토리만 수정.
  API 미완성 상태이므로 mock 데이터로 UI 먼저 구현.
  완료 기준: npm run dev로 개발서버 시작 가능한 상태.
```

### 병합 절차

worktree 에이전트가 완료되면 각각 독립 브랜치에 변경사항이 생긴다.

```
1. 각 에이전트 완료 후 결과 확인
   - 반환된 worktree 경로와 브랜치명 확인
   - 생성된 파일 목록 확인

2. 충돌 여부 판단
   - backend/와 frontend/는 디렉토리가 분리되어 충돌 없음
   - 공통 파일(docker-compose.yml, .env 등)은 team-lead가 직접 작성

3. 메인 브랜치에 병합
   - git merge 또는 cherry-pick으로 각 브랜치 병합
   - 충돌 발생 시 team-lead가 수동 해결

4. 병합 후 통합 확인
   - 백엔드 서버 기동 확인
   - 프론트엔드 빌드 확인
   - API 연동 점검 (필요 시 reviewer 에이전트 spawn)
```

### reviewer 실행 타이밍

reviewer는 병합 완료 후 **순차적으로** spawn한다 (병렬 아님):

```
Task 3: reviewer (병합 후 실행)
─────────────────────────────────
name: "reviewer"
subagent_type: "general-purpose"
prompt: |
  너는 reviewer 에이전트이다.

  아래 문서를 기준으로 검수하라:
  - docs/api-spec.md (API 명세 대비 실제 구현)
  - docs/ui-spec.md (화면 명세 대비 실제 구현)
  - docs/sop.md의 "검수 기준" 섹션

  [검수 항목]
  1. backend/ 코드: 모든 API 엔드포인트 존재 여부, 스키마 일치
  2. frontend/ 코드: 모든 페이지/컴포넌트 존재 여부, 라우팅 일치
  3. 코딩 컨벤션 준수 여부
  4. 명백한 버그나 누락 사항

  결과를 항목별로 ✅/❌ 로 보고하라.
```

### Phase별 병렬화 전략

| Phase | 병렬 가능 | 순차 필요 | 비고 |
|-------|----------|----------|------|
| Phase 1 | backend-dev + frontend-dev | reviewer (병합 후) | 프론트는 mock 데이터로 진행 |
| Phase 2 | backend-dev (AI API) + frontend-dev (편집기 UI) | reviewer (병합 후) | 프론트는 mock AI 응답으로 진행 |
| Phase 3 | backend-dev (PDF 서비스) + frontend-dev (조합기 UI) | reviewer (병합 후) | 프론트는 mock 썸네일로 진행 |
| Phase 4 | 병렬화 불가 | Docker + 설정 + 통합테스트 | team-lead 단독 또는 순차 |

### 주의사항

1. **git 초기화 필수**: worktree 격리를 쓰려면 프로젝트가 git 저장소여야 한다.
   Phase 1 시작 전 `git init` + 초기 커밋 필요.

2. **공통 파일은 team-lead가 작성**: docker-compose.yml, .env, config/ 등
   에이전트 간 같은 파일을 수정하면 충돌 발생.

3. **프롬프트에 문서 경로 명시**: 에이전트는 별도 세션이므로 컨텍스트가 없다.
   반드시 읽어야 할 문서 경로를 프롬프트에 포함해야 한다.

4. **작업 범위 제한**: 각 에이전트는 자기 디렉토리(backend/ 또는 frontend/)만 수정.
   루트 파일 수정이 필요하면 team-lead에게 보고.

5. **에이전트 결과 검증**: 에이전트가 "완료"라고 해도 team-lead가 반드시 확인.
   빌드 에러, 누락 파일, 컨벤션 위반 등 점검.

---

## Phase별 상세 작업 순서

### Phase 0: 프로젝트 문서화
**목적**: 컨텍스트 보존, 새 세션에서 이어작업 가능하도록
**산출물**: CLAUDE.md, sop.md, schema.md, api-spec.md, ui-spec.md
**담당**: team-lead 단독

### Phase 1: 기반 인프라 + 인력관리
**목적**: 프로젝트 뼈대 + 첫 번째 기능 모듈 완성

#### backend-dev 작업 (순서대로)
1. 프로젝트 초기화
   - `backend/` 폴더 생성
   - `requirements.txt` 작성
   - FastAPI main.py 기본 셋업
2. IP 미들웨어 구현 (`middleware/ip_filter.py`)
3. DB 설정 (`database.py`, 모델 파일들)
4. 인력 CRUD API
   - POST/GET/PUT/DELETE `/api/personnel`
   - POST/GET/DELETE `/api/personnel/{id}/certifications`
   - POST/GET/DELETE `/api/personnel/{id}/projects`
5. 파일 업로드 API (자격증 스캔본)

#### frontend-dev 작업 (순서대로)
1. 프로젝트 초기화
   - `frontend/` 폴더 생성
   - Vite + React + TypeScript 셋업
   - Tailwind CSS + shadcn/ui 설치
2. 레이아웃 컴포넌트 (Sidebar, Header)
3. 라우터 설정 (React Router)
4. API 서비스 레이어 (`services/api.ts`)
5. 인력 목록 페이지 (PersonnelList)
6. 인력 등록/편집 페이지 (PersonnelEdit)
   - 기본정보 탭
   - 자격증 탭 (파일 업로드 포함)
   - 프로젝트 이력 탭

#### reviewer 작업
- 인력 API 엔드포인트 테스트 (Swagger UI)
- 인력 관리 UI 테스트 (등록/조회/수정/삭제)
- 파일 업로드 테스트
- 한글 데이터 정상 저장/조회 확인

#### Docker 작업 (backend-dev 또는 team-lead)
- docker-compose.yml 작성
- frontend Dockerfile (Vite dev → nginx prod)
- backend Dockerfile (Python + uvicorn)
- 볼륨 마운트 설정 (data/ 디렉토리)

### Phase 2: AI 장표 생성 + 편집기
**목적**: Gemini AI로 PDF→HTML 변환, 코드/AI 편집기

#### backend-dev 작업
1. Gemini API 서비스 (`services/ai_service.py`)
   - PDF 이미지 → Gemini 전달 → HTML/CSS 수신
   - 자연어 수정 요청 처리
2. AI API 라우터 (`routers/ai.py`)
   - POST `/api/ai/pdf-to-html` (PDF 업로드 → HTML 반환)
   - POST `/api/ai/modify` (HTML + 수정요청 → 수정된 HTML)
3. 인력 데이터 → HTML 장표 자동 생성 서비스 (`services/page_service.py`)
4. 장표 라이브러리 CRUD API (`routers/library.py`)

#### frontend-dev 작업
1. 장표 편집 페이지 (PageEditor)
   - Monaco 코드 편집기 (HTML/CSS 탭)
   - AI 채팅 패널 (자연어 수정 요청)
   - A4 실시간 미리보기 (iframe 렌더링)
   - 3분할 레이아웃 (AI | 코드 | 미리보기)
2. PDF 업로드 → AI HTML 생성 UI
3. 장표 라이브러리 UI (저장/불러오기)

#### reviewer 작업
- Gemini API 연동 테스트 (PDF→HTML 품질 확인)
- AI 수정 요청 테스트
- 코드 편집기 동작 확인
- 미리보기 실시간 반영 확인

### Phase 3: 장표 조합기 + PDF 출력
**목적**: 핵심 기능 - 장표 순서 조정 + 최종 PDF 생성

#### backend-dev 작업
1. 입찰 CRUD API (`routers/bids.py`)
2. 장표 CRUD API (`routers/pages.py`)
   - 순서 변경 API (sort_order 업데이트)
3. PDF 업로드 + 썸네일 생성 (pdf2image)
4. Playwright HTML→PDF 변환 서비스
5. PyPDF2 PDF 병합 서비스
6. 최종 PDF 생성 + 다운로드 API

#### frontend-dev 작업
1. 입찰 대시보드/목록 페이지
2. 입찰 작업 화면 (BidWorkspace) - 핵심!
   - 좌측: 장표 레이어 패널
     - HTML 장표 카드 (썸네일)
     - PDF 페이지 카드 (이미지 썸네일)
     - 드래그앤드롭 순서 변경
     - 추가/삭제 버튼
   - 우측: 선택 장표 미리보기/편집
3. 인력 배정 UI (인력 DB에서 선택 → 장표에 데이터 채움)
4. 최종 PDF 미리보기 + 다운로드 버튼

#### reviewer 작업
- 드래그앤드롭 순서 변경 동작 확인
- HTML→PDF 변환 품질 (한글, 표, 레이아웃)
- PDF 병합 순서 정확성
- 최종 PDF 파일 무결성

### Phase 4: 마무리
**목적**: 프로덕션 배포 준비

1. Docker 프로덕션 빌드 설정
   - frontend: Vite build → nginx 서빙
   - backend: uvicorn 프로덕션 모드
2. 한글 폰트 포함 (Noto Sans KR → Docker 이미지)
3. 설정 페이지 (IP 화이트리스트 관리, API 키 설정)
4. 데이터 백업/복원 기능
   - SQLite 파일 + uploads 폴더 통째로 백업
5. 최종 통합 테스트

---

## 검수 기준

### API 검수
- [ ] 모든 CRUD 엔드포인트 정상 동작
- [ ] 한글 데이터 저장/조회 정상
- [ ] 파일 업로드/다운로드 정상
- [ ] 에러 시 적절한 HTTP 상태코드 반환
- [ ] FastAPI Swagger UI에서 테스트 가능

### UI 검수
- [ ] 모든 페이지 정상 렌더링
- [ ] 반응형 레이아웃 (기본 데스크탑)
- [ ] 드래그앤드롭 정상 동작
- [ ] 폼 유효성 검사 동작
- [ ] API 연동 정상

### PDF 검수
- [ ] HTML→PDF 변환: 한글 정상 출력
- [ ] HTML→PDF 변환: 표/레이아웃 유지
- [ ] PDF 병합: 순서 정확
- [ ] PDF 병합: 페이지 누락 없음
- [ ] 최종 PDF 파일 정상 열림

### AI 검수
- [ ] Gemini API 연결 정상
- [ ] PDF→HTML 변환 품질 (양식과 유사도)
- [ ] 자연어 수정 요청 반영
- [ ] 에러 처리 (API 실패 시 사용자 메시지)

### 보안 검수
- [ ] 허용 IP에서만 접근 가능
- [ ] 차단 IP에서 403 응답
- [ ] 파일 업로드 크기 제한
- [ ] 경로 탐색 공격 방어

---

## 컨텍스트 보존 규칙

### 새 세션 시작 시 반드시 읽어야 하는 파일
1. `CLAUDE.md` - 프로젝트 전체 이해
2. `docs/sop.md` - 현재 진행 상황, 다음 해야 할 작업
3. 작업 대상 Phase의 관련 파일 (schema.md, api-spec.md, ui-spec.md)

### 진행 상황 기록
- 각 Phase 완료 시 이 문서의 체크리스트 업데이트
- 주요 결정 변경 시 CLAUDE.md의 "주요 결정사항" 테이블 업데이트
- 에러/이슈 발생 시 이 문서 하단에 기록

---

## 진행 상황

### Phase 0: 문서화
- [x] CLAUDE.md 작성
- [x] sop.md 작성
- [x] schema.md 작성
- [x] api-spec.md 작성
- [x] ui-spec.md 작성

### Phase 1: 기반 + 인력관리
- [ ] 프로젝트 초기화
- [ ] Docker Compose
- [ ] FastAPI 기본 셋업
- [ ] DB 모델
- [ ] 인력 CRUD API
- [ ] 인력 관리 프론트엔드

### Phase 2: AI 장표 생성 + 편집기
- [ ] Gemini API 연동
- [ ] 장표 편집 페이지
- [ ] 장표 라이브러리

### Phase 3: 장표 조합기 + PDF
- [ ] 입찰 관리 CRUD
- [ ] 장표 조합기 UI
- [ ] PDF 생성/병합

### Phase 4: 마무리
- [ ] Docker 프로덕션
- [ ] 한글 폰트
- [ ] 설정/백업
