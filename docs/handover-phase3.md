# Phase 3 인수인계 문서 (장표 조합기 + PDF 출력)

**작성일**: 2026-02-25~26 (세션 5~7)
**상태**: 전체 기능 구현 + 검증 완료 (PDF 생성/AI 수정/편집기 왕복/Dashboard/HWP 연동)

---

## 1. 이번 세션에서 완료한 작업

### 1.1 입찰 CRUD API (11개 엔드포인트)

| Method | 경로 | 기능 | 상태 |
|--------|------|------|------|
| GET | `/api/bids/` | 입찰 목록 (검색/필터/페이지네이션) | ✅ 테스트 완료 |
| POST | `/api/bids/` | 입찰 생성 | ✅ 테스트 완료 |
| GET | `/api/bids/{id}` | 입찰 상세 (pages+personnel 포함) | ✅ 테스트 완료 |
| PUT | `/api/bids/{id}` | 입찰 수정 | ✅ 코드 완성 |
| DELETE | `/api/bids/{id}` | 입찰 삭제 (cascade + 파일 정리) | ✅ 코드 완성 |
| POST | `/api/bids/{id}/pages/html` | HTML 장표 추가 | ✅ 테스트 완료 |
| POST | `/api/bids/{id}/pages/pdf` | PDF 파일 업로드 | ✅ 코드 완성 |
| PUT | `/api/bids/{id}/pages/reorder` | 장표 순서 변경 | ✅ 코드 완성 |
| PUT | `/api/bids/{id}/pages/{page_id}` | 장표 수정 | ✅ 코드 완성 |
| DELETE | `/api/bids/{id}/pages/{page_id}` | 장표 삭제 | ✅ 코드 완성 |
| POST | `/api/bids/{id}/personnel` | 인력 배정 | ✅ 코드 완성 |
| DELETE | `/api/bids/{id}/personnel/{bp_id}` | 인력 해제 | ✅ 코드 완성 |

### 1.2 PDF 서비스 (`pdf_service.py`)
- **HTML→PDF 변환**: Playwright Chromium headless → A4 사이즈 PDF
- **PDF 병합**: PyPDF2로 여러 PDF 파일을 하나로 합침
- **입찰 전체 PDF 생성**: 장표 순서대로 변환 + 업로드 PDF 원본 병합
- Chromium 브라우저 lazy init 패턴 (인스턴스 재사용)

### 1.3 BidList 페이지 (`/bids`)
- 입찰 카드 목록 (상태 뱃지, D-day, 발주처, 장표수/인력수)
- 검색 + 상태 필터(작성중/검토중/완료) + 페이지네이션
- 새 입찰 생성 모달
- API 실패 시 mock 데이터 fallback

### 1.4 BidWorkspace 페이지 (`/bids/:bidId/workspace`)
- **좌측 패널**: 장표 목록 (드래그앤드롭 순서 변경, @dnd-kit/sortable)
- **우측 패널**: 선택된 장표 iframe 미리보기
- **장표 추가**: 라이브러리에서 불러오기, 새 장표(편집기 이동), PDF 파일 업로드
- **인력 배정**: 인력 검색 + 배정/해제
- **PDF 생성**: 전체 장표 병합 → 다운로드

---

## 2. 수정/생성된 파일 목록

### Backend (신규)
| 파일 | 변경 내용 |
|------|----------|
| `backend/app/routers/bid.py` | **신규** — 입찰 CRUD 11개 엔드포인트 (~410줄) |
| `backend/app/services/pdf_service.py` | **신규** — Playwright HTML→PDF + PyPDF2 병합 (~232줄) |

### Backend (수정)
| 파일 | 변경 내용 |
|------|----------|
| `backend/app/schemas/bid.py` | BidPageCreate/Update/Response, BidPageReorderRequest, BidPersonnelCreate/Response 추가 |
| `backend/app/main.py` | bid 라우터 등록: `app.include_router(bid.router, prefix="/api/bids")` |
| `backend/requirements.txt` | `playwright` 추가 |

### Frontend (신규)
| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/pages/BidWorkspace.tsx` | **신규** — 장표 조합기 전체 구현 (~624줄) |

### Frontend (수정)
| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/pages/BidList.tsx` | 플레이스홀더 → 완전한 구현 (검색/필터/생성/카드목록) |
| `frontend/src/App.tsx` | `/bids/:bidId/workspace` 라우트 + BidWorkspace import 추가 |
| `frontend/src/types/index.ts` | Bid, BidPage, BidPersonnel 등 타입 추가 + 백엔드와 일치 수정 |
| `frontend/src/services/api.ts` | bidApi(CRUD+장표+인력), pdfApi(생성/병합/다운로드) + trailing slash 수정 |
| `frontend/package.json` | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 설치 |

---

## 3. 핵심 구현 상세

### 3.1 BidWorkspace 드래그앤드롭 (`@dnd-kit`)

```typescript
// 장표 카드 드래그 순서 변경
const handleDragEnd = async (event: DragEndEvent) => {
  const reordered = arrayMove(bid.pages, oldIndex, newIndex)
    .map((p, i) => ({ ...p, sort_order: i + 1 }));
  setBid({ ...bid, pages: reordered }); // 낙관적 업데이트
  try {
    await bidApi.reorderPages(bidId, reordered.map(p => p.id));
  } catch {
    loadBid(); // 실패 시 서버에서 원복
  }
};
```

- `PointerSensor` + `activationConstraint: { distance: 8 }` — 클릭과 드래그 구분
- `useSortable` 훅으로 각 카드에 드래그 핸들 + transform 스타일 적용

### 3.2 PDF 서비스 아키텍처

```
입찰의 장표들 (sort_order 순서)
├── HTML 장표 1 → Playwright → PDF bytes
├── HTML 장표 2 → Playwright → PDF bytes
├── PDF 원본 3   → 그대로 사용
├── HTML 장표 4 → Playwright → PDF bytes
└── PyPDF2로 모든 PDF를 순서대로 병합 → 최종 PDF 다운로드
```

- Playwright 브라우저: lazy init + 글로벌 인스턴스 재사용
- 각 HTML 장표의 CSS도 `<style>` 태그로 포함하여 변환
- A4 사이즈, margin 없음 (HTML 내부에서 처리)

### 3.3 백엔드 bid 라우터 구조

```python
# 헬퍼 함수
_get_bid_or_404(db, bid_id)      → Bid ORM 객체
_bid_to_summary(bid)              → BidSummary (목록용)
_bid_to_detail(bid)               → BidDetail (pages+personnel 포함)
_bid_personnel_to_response(bp)    → 인력 정보 + 조인된 이름/직급

# 라우팅
router.get("/")                   → list_bids (검색, 상태 필터, 페이지네이션)
router.post("/")                  → create_bid
router.get("/{bid_id}")           → get_bid (detail)
router.put("/{bid_id}")           → update_bid
router.delete("/{bid_id}")        → delete_bid + 파일 정리
router.post("/{bid_id}/pages/html")    → add_page_html
router.post("/{bid_id}/pages/pdf")     → add_page_pdf (파일 업로드)
router.put("/{bid_id}/pages/reorder")  → reorder_pages
router.put("/{bid_id}/pages/{id}")     → update_page
router.delete("/{bid_id}/pages/{id}")  → delete_page + 파일 정리
router.post("/{bid_id}/personnel")     → add_personnel (중복 방지)
router.delete("/{bid_id}/personnel/{id}") → remove_personnel
```

---

## 4. API 엔드포인트 (전체 현황)

| 카테고리 | 개수 | 상태 |
|----------|------|------|
| 인력 관리 (/api/personnel) | 13개 | ✅ 동작 |
| HWP 변환 (/api/hwp) | 4개 | ✅ 동작 (convert 제외) |
| AI 서비스 (/api/ai) | 2개 | ✅ 동작 (Gemini 검증 완료) |
| 장표 라이브러리 (/api/library) | 4개 | ✅ 동작 |
| 입찰 관리 (/api/bids) | 11개 | ✅ 동작 |
| PDF 생성 (/api/pdf) | 3개 | ✅ 동작 (generate/merge/download) |
| 헬스체크 (/api/health) | 1개 | ✅ 동작 |
| **합계** | **39개** | |

---

## 5. 알려진 이슈 / 주의사항

### API trailing slash (중요!)
- FastAPI bid 라우터의 list/create가 `@router.get("/")`로 정의됨
- 프론트에서 `/bids`로 호출하면 **307 Temporary Redirect** → `/bids/`
- `api.ts`에서 `bidApi.list`와 `bidApi.create`는 `/bids/` (trailing slash)로 호출해야 함

### Playwright 설치
- `pip install playwright` 후 반드시 `playwright install chromium` 실행 필요
- Windows에서 Chromium 다운로드 시간 소요 (~100MB)
- headless 모드 사용 (GPU 불필요)

### 프론트/백엔드 타입 매핑
- `BidPageResponse`: 백엔드에 `has_generated_pdf` 필드 없음 → 프론트에서 제거함
- `BidPersonnelResponse`: `custom_data`와 `selected_projects`는 JSON **문자열** (Record/Array 아님)
- `BidPersonnelResponse`: `personnel_name`, `personnel_title`은 조인 결과 (nullable)

---

## 6. 전체 워크플로우 (현재 구현된 것)

```
[발주처 양식 HWP]
  → /hwp 페이지에서 업로드
  → pyhwp로 HTML 변환 + 서식 선택기
  → 선택한 서식을 /editor 편집기로 이동
  → Monaco 에디터에서 직접 편집 + AI 채팅으로 수정
  → 장표 라이브러리에 저장 (/library)

[입찰 작업]
  → /bids 에서 새 입찰 생성
  → /bids/:id/workspace 에서 장표 조합
    - 라이브러리에서 장표 불러오기
    - PDF 증빙서류 원본 업로드
    - 드래그앤드롭으로 순서 조정
    - 인력 배정
  → PDF 생성 버튼으로 최종 PDF 병합 다운로드
```

---

## 7. 세션 6~7에서 추가 완료한 작업

### 7.1 PDF 서비스 Windows 호환성 수정 (세션6)
- `pdf_service.py`를 `async_playwright` → `sync_playwright` + `asyncio.to_thread()` 전면 재작성
- Windows uvicorn의 `SelectorEventLoop`가 subprocess 미지원하는 문제 해결
- HTML→PDF 변환, PDF 병합, 다운로드 모두 E2E 확인 완료

### 7.2 Workspace ↔ Editor 왕복 저장 (세션6)
- `PageEditor.tsx`: `bidId`+`pageId` URL 파라미터 감지 → API에서 장표 로드
- 편집 후 녹색 "저장" 버튼 → `bidApi.updatePage()` → workspace로 자동 복귀

### 7.3 Gemini AI 수정 검증 (세션6)
- diff 기반 `{replacements: [{old, new}]}` 방식 정상 동작 확인
- 프론트엔드 AI 채팅 패널 E2E 테스트 통과

### 7.4 Dashboard 실 데이터 연동 (세션7)
- `Dashboard.tsx` 전면 재작성: `bidApi.list()` + `personnelApi.list()` 실데이터
- 상태별 카운트(작성중/검토중/완료) + 등록 인력 수 4개 카드
- 진행중 입찰 목록 (마감일 가까운 순, D-day 색상 경고)

### 7.5 HWP→입찰 직접 연동 (세션7)
- `HwpConverter.tsx`: "입찰에 추가" 녹색 버튼 + 입찰 선택 모달
- 전체 HTML 또는 선택 서식만 `bidApi.addPageHtml()`로 추가 → workspace 이동

### 7.6 PDF 생성 다운로드 수정 (세션7)
- `BidWorkspace.tsx`: `pdfApi.merge` (JSON 기대) → `fetch` + blob 다운로드로 수정
- 파일명: `{입찰명}_proposal.pdf`

---

## 8. 남은 작업 (Phase 4)

1. [ ] Docker Compose 프로덕션 빌드 (Playwright + 한글 폰트 포함)
2. [ ] 환경변수 정리 + SQLite 백업 스크립트
3. [ ] IP 화이트리스트 실 설정 + CORS 조정

---

## 8. 실행 방법

```bash
# 백엔드
cd backend
pip install -r requirements.txt
playwright install chromium    # PDF 생성용 (최초 1회)
uvicorn app.main:app --reload --port 8000

# 프론트엔드
cd frontend
npm install
npm run dev

# 테스트 흐름
# 1. http://localhost:5173/bids → 새 입찰 생성
# 2. → workspace 자동 이동
# 3. 라이브러리에서 장표 추가 또는 PDF 업로드
# 4. 드래그앤드롭으로 순서 조정
# 5. PDF 생성 버튼 클릭
```
