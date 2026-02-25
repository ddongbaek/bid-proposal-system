# Phase 2 인수인계 문서 (HWP 변환 + 편집기 연동)

**작성일**: 2026-02-25 (세션 4 종료 시점)
**상태**: HWP→HTML 변환 + 서식 선택기 + 편집기 연동 + AI 수정 구현 완료

---

## 1. 이번 세션에서 완료한 작업

### 1.1 HWP→편집기 연동 (sessionStorage)
- `/hwp` 페이지에서 "편집기에서 열기" 클릭 → sessionStorage에 HTML 저장 → `/editor`로 navigate
- `/editor` (PageEditor.tsx)에서 sessionStorage 읽어 Monaco 에디터 + 미리보기에 로드
- **React StrictMode 대응**: `useRef`로 sessionStorage 데이터를 render 단계에서 캡처 (이중 실행에도 안전)

### 1.2 서식 단위 섹션 선택기 (핵심 개선)
- **이전 문제**: 개별 TableControl(25개)을 각각 섹션으로 나누어 양식이 깨짐
- **해결**: `[ 서식 N ]` 패턴을 기준으로 그룹핑 → 14개 섹션 (표지/목차 + 서식1~13)
- 각 서식에 부제목 자동 추출 (예: "서식 7 - 제안업체 일반현황 및 연혁")
- 체크박스 UI로 원하는 서식만 선택 → 편집기로 보내기

### 1.3 Gemini AI 수정 방식 변경 (diff 기반)
- **이전 문제**: 대용량 HTML(170KB+)을 Gemini에게 전체 재생성 요청 → 토큰 초과/잘림
- **해결**: 검색/치환(find-and-replace) JSON 방식으로 변경
  - AI가 `{"replacements": [{"old": "...", "new": "..."}], "description": "..."}` 반환
  - 원본 HTML에 순서대로 적용 → 안전하게 부분 수정

### 1.4 AiChatPanel HWP 업로드 지원
- 편집기 AI 채팅 패널에서 직접 HWP 파일 업로드 가능 (PDF 업로드와 별도)

### 1.5 장표 라이브러리 CRUD 확인
- GET/POST/DELETE 모두 정상 동작 확인
- FastAPI trailing slash 307 redirect 문제 수정 (api.ts에 trailing slash 추가)

---

## 2. 수정된 파일 목록 (이번 세션)

### Backend
| 파일 | 변경 내용 |
|------|----------|
| `backend/app/services/libreoffice_service.py` | `_find_form_boundaries()`, `parse_html_sections()`, `extract_html_sections()` — 서식 기준 그룹핑으로 전면 재작성 |
| `backend/app/services/ai_service.py` | `modify_html()` — diff 기반 수정 방식으로 변경, `_apply_replacements()` 추가 |
| `backend/app/routers/hwp.py` | `/to-html` 응답에 sections 포함, `POST /extract-sections` 엔드포인트 추가 |

### Frontend
| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/pages/HwpConverter.tsx` | 섹션 선택기 UI 추가 (체크박스 그리드, 전체선택, 선택 서식만 편집기로 열기) |
| `frontend/src/pages/PageEditor.tsx` | sessionStorage에서 HWP HTML 로드 (StrictMode 대응 useRef 패턴), HWP 직접 업로드 핸들러 |
| `frontend/src/components/editor/AiChatPanel.tsx` | HWP 업로드 UI 추가 (onHwpUpload prop) |
| `frontend/src/services/api.ts` | `hwpApi.extractSections()` 추가, library API trailing slash 수정 |

---

## 3. 핵심 구현 상세

### 3.1 서식 그룹핑 알고리즘 (`parse_html_sections`)

```
HTML에서 [ 서식 N ] 패턴이 포함된 <p> 태그를 찾아 경계로 사용:

표지/목차: body 시작 ~ 서식 1 시작
서식 1:    서식1 <p> 위치 ~ 서식2 <p> 위치
서식 2:    서식2 <p> 위치 ~ 서식3 <p> 위치
...
서식 13:   서식13 <p> 위치 ~ body 끝

→ 각 서식 범위에 포함된 제목 단락 + 모든 TableControl이 함께 추출됨
→ "서식 1" 안에 4개 테이블이 있으면 4개 모두 하나의 섹션으로 포함
```

- `_find_form_boundaries()`: `[ 서식 N ]` 패턴 파싱 + 부제목(다음 단락 텍스트) 추출
- `parse_html_sections()`: 경계 기반으로 섹션 목록 생성 (index=서식번호, 0=표지)
- `extract_html_sections()`: 선택된 섹션 HTML 추출 + head/style 유지 + 고아 태그 정리

### 3.2 PageEditor sessionStorage 로딩 (StrictMode 안전)

```typescript
// render 단계에서 ref로 캡처 (useEffect보다 먼저 실행)
const hwpDataRef = useRef<{ html: string; fileName: string } | null>(null);
if (!hwpDataRef.current) {
  const hwpHtml = sessionStorage.getItem('hwpHtmlContent');
  if (hwpHtml) {
    hwpDataRef.current = { html: hwpHtml, fileName: ... };
    sessionStorage.removeItem('hwpHtmlContent');  // 1회만 사용
  }
}

// useEffect에서 ref 읽기 (StrictMode 이중 실행에도 동일 데이터)
useEffect(() => {
  const hwpData = hwpDataRef.current;
  if (hwpData) { setHtmlContent(hwpData.html); ... }
}, []);
```

**중요**: `hwpDataRef.current = null` 하면 안 됨 (StrictMode 두 번째 effect에서 데이터 소실)

### 3.3 AI 수정 diff 방식 (`ai_service.py`)

```
사용자 요청: "3번째 열 너비를 넓혀줘"
→ Gemini에 원본 HTML + 수정 요청 전송
→ Gemini 응답: {"replacements": [{"old": "width:30%", "new": "width:50%"}], "description": "3열 너비 확대"}
→ _apply_replacements()로 원본 HTML에 적용
→ 실패 시 정규식 유연 매칭(공백 차이 허용) + fallback(전체 HTML 반환/원본 유지)
```

---

## 4. API 엔드포인트 (현재 전체)

| Method | 경로 | 기능 | 상태 |
|--------|------|------|------|
| POST | `/api/hwp/to-html` | HWP→HTML 변환 (pyhwp) + 서식 목록 | ✅ 동작 |
| POST | `/api/hwp/extract-sections` | 선택된 서식만 추출 | ✅ 동작 |
| POST | `/api/hwp/convert` | HWP→PDF (LibreOffice) | ⚠️ Windows HWP 필터 부재 |
| POST | `/api/hwp/info` | HWP 페이지 수 | ⚠️ LibreOffice 의존 |
| POST | `/api/ai/pdf-to-html` | PDF→HTML (Gemini) | ✅ 코드 완성, API키 필요 |
| POST | `/api/ai/modify` | 자연어 HTML 수정 (diff) | ✅ 코드 완성, API키 필요 |
| GET/POST/DELETE | `/api/library/` | 장표 라이브러리 CRUD | ✅ 동작 |

---

## 5. 알려진 이슈 / 주의사항

### 서버 캐시 문제
- **Vite**: 코드 변경 후 반영 안 되면 `rm -rf node_modules/.vite` + Vite 재시작 필요
- **uvicorn**: `__pycache__` 문제 시 `find . -name "__pycache__" -exec rm -rf {} +` + 재시작

### 서식 그룹핑 한계
- `[ 서식 N ]` 패턴이 없는 HWP 파일은 섹션 목록이 빈 배열 → 전체 HTML을 그대로 사용
- "서식 8의 참여인력 현황표에 기재된" 같은 참조 문구는 필터링됨

### Gemini AI
- `.env`에 `GEMINI_API_KEY` 설정 필요
- 모델: `gemini-2.5-flash` (ai_service.py)
- 대용량 HTML 수정 시 diff 방식이므로 `max_output_tokens: 8192`로 충분

---

## 6. 후속 작업 상태

### Phase 2 남은 확인 작업
1. [x] HWP→편집기 연동 (sessionStorage) — **구현 완료, 사용자 확인 완료**
2. [x] 서식 선택기 (그룹핑) — **구현 완료, 사용자 확인 완료**
3. [x] 장표 라이브러리 CRUD — **동작 확인 완료**
4. [ ] **Gemini AI 수정 실제 테스트** — `.env`에 `GEMINI_API_KEY` 설정 후 편집기에서 실사용 확인

### Phase 3 — ✅ 완료 (세션 5에서 구현)
- → `docs/handover-phase3.md` 참조

---

## 7. 전체 워크플로우 (현재 구현된 것)

```
[HWP 파일] → /hwp 페이지 업로드
           → pyhwp로 HTML 변환
           → 서식 목록 표시 (체크박스)
           → 전체 또는 선택 서식 → /editor 페이지로 이동
           → Monaco 코드 에디터에서 직접 편집
           → AI 채팅으로 자연어 수정 요청 (Gemini)
           → 장표 라이브러리에 저장
           → (Phase 3) 입찰에 장표 추가 → PDF 출력
```

---

## 8. 실행 방법

```bash
# 백엔드
cd backend && pip install pyhwp && uvicorn app.main:app --reload --port 8000

# 프론트엔드
cd frontend && npm install && npm run dev

# 테스트
# 1. http://localhost:5173/hwp → HWP 파일 업로드 → 서식 선택 → 편집기로 열기
# 2. http://localhost:5173/editor → 직접 편집 또는 AI 수정
# 3. http://localhost:5173/library → 저장된 장표 확인
```
