# Phase 2 인수인계 문서

**작성일**: 2026-02-25
**상태**: Phase 2 코드 생성 완료, 실행 확인 대기

---

## 1. 현재 진행 상황

### 완료된 Phase
- [x] **Phase 0**: 프로젝트 문서화
- [x] **Phase 1**: 기반 인프라 + 인력관리
- [x] **Phase 1.5**: 재직증명서 출력 기능
- [x] **Phase 2**: AI 장표 생성 + 편집기

### 미완료 Phase
- [ ] Phase 3: 장표 조합기 + PDF 출력
- [ ] Phase 4: 마무리 (Docker 프로덕션, 설정, 백업)

---

## 2. Phase 2에서 생성/수정된 파일 목록

### Backend 신규 파일
```
backend/app/services/__init__.py       # 패키지 초기화
backend/app/services/ai_service.py     # Gemini API 연동 (PDF→HTML, HTML 수정)
backend/app/routers/ai.py              # AI API 라우터 (2개 엔드포인트)
backend/app/routers/library.py         # 장표 라이브러리 CRUD 라우터 (4개 엔드포인트)
```

### Backend 수정 파일
```
backend/requirements.txt               # google-generativeai>=0.8.0 추가
backend/app/main.py                    # ai, library 라우터 등록
backend/app/schemas/bid.py             # AI/Library 스키마 추가
```

### Frontend 신규 파일
```
frontend/src/components/editor/AiChatPanel.tsx      # AI 채팅 패널
frontend/src/components/editor/CodeEditorPanel.tsx   # Monaco 코드 에디터
frontend/src/components/editor/PreviewPanel.tsx      # A4 미리보기
frontend/src/pages/PageEditor.tsx                    # 장표 편집기 (3분할)
frontend/src/pages/Library.tsx                       # 장표 보관함
```

### Frontend 수정 파일
```
frontend/package.json                  # @monaco-editor/react 추가
frontend/src/App.tsx                   # /editor, /library 라우트 추가
frontend/src/types/index.ts            # AI/Library 타입 추가
frontend/src/services/api.ts           # aiApi, libraryApi 추가
frontend/src/components/layout/Header.tsx  # 편집기 페이지 제목 추가
```

---

## 3. 구현된 기능 상세

### 3.1 백엔드 API 엔드포인트 (6개 신규)

| # | Method | 경로 | 기능 |
|---|--------|------|------|
| 1 | POST | /api/ai/pdf-to-html | PDF 업로드 → Gemini AI HTML/CSS 변환 |
| 2 | POST | /api/ai/modify | 자연어 요청으로 HTML/CSS 수정 |
| 3 | GET | /api/library | 장표 라이브러리 목록 (카테고리 필터) |
| 4 | POST | /api/library | 장표 라이브러리에 저장 |
| 5 | GET | /api/library/{id} | 장표 상세 조회 (HTML/CSS 포함) |
| 6 | DELETE | /api/library/{id} | 장표 삭제 |

### 3.2 AI 서비스 (ai_service.py)

- **Gemini 모델**: gemini-2.0-flash
- **PDF→HTML 변환**: PDF 바이트를 inline_data로 Gemini에 전달, temperature 0.1
- **HTML 수정**: 현재 코드 + 자연어 요청 → 수정된 코드 반환, temperature 0.2
- **응답 파싱**: ```html/```css 코드 블록 추출, `<style>` 태그 분리
- **변수 감지**: {{변수명}} 패턴을 자동 추출
- **에러 처리**: API 키 미설정 503, 변환 실패 500

### 3.3 프론트엔드 페이지

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/editor` | PageEditor (독립 편집기) | 완전 구현 |
| `/editor?libraryId={id}` | PageEditor (라이브러리에서 로드) | 완전 구현 |
| `/bids/:bidId/pages/:pageId/edit` | PageEditor (입찰 내 편집) | 라우트만 등록 (Phase 3) |
| `/library` | Library (장표 보관함) | 완전 구현 |

### 3.4 장표 편집기 (PageEditor) 기능
- **3분할 레이아웃**: AI 채팅(좌 272px) | Monaco 에디터(중앙 flex) | 미리보기(우 384px)
- **Monaco Editor**: HTML/CSS 탭 전환, vs-dark 테마, 구문 강조
- **미리보기**: iframe srcdoc, A4 비율(794x1123px), 자동 스케일, 줌 컨트롤
- **AI 채팅**: 자연어 수정 요청 → 코드 자동 반영, PDF 업로드 변환
- **저장**: 라이브러리에 저장 (이름/카테고리/설명 입력 모달)
- **Debounce**: 코드 변경 300ms 후 미리보기 반영

### 3.5 장표 보관함 (Library) 기능
- 카드 그리드 레이아웃 (반응형 1~4열)
- 카테고리 필터 (pill 버튼)
- 각 카드: 미리보기 영역, 이름, 카테고리 배지, 편집/삭제 버튼
- API 미연결 시 mock 데이터 fallback (3개 예시)
- 삭제 시 ConfirmDialog

---

## 4. 실행 확인 방법

### 4.1 백엔드 + 프론트엔드 실행
```bash
# 터미널 1: 백엔드
cd backend && uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트엔드
cd frontend && npm run dev
```

### 4.2 확인 항목

#### 장표 보관함 (http://localhost:5173/library)
- [ ] 페이지 정상 렌더링 (카드 그리드)
- [ ] API 미연결 시 mock 데이터 표시
- [ ] [새 장표] 버튼 → /editor로 이동
- [ ] 카테고리 필터 동작

#### 장표 편집기 (http://localhost:5173/editor)
- [ ] 3분할 레이아웃 정상 렌더링
- [ ] Monaco 에디터에 코드 입력 가능
- [ ] HTML/CSS 탭 전환 동작
- [ ] 코드 입력 시 미리보기 실시간 반영
- [ ] 미리보기 줌 컨트롤 동작
- [ ] AI 채팅 입력창 동작 (API 미연결 시 에러 메시지)
- [ ] [라이브러리에 저장] 모달 동작

#### AI 기능 (Gemini API 키 필요)
- [ ] .env에 GEMINI_API_KEY 설정
- [ ] PDF 업로드 → AI HTML 변환
- [ ] 자연어 수정 요청 → 코드 자동 반영
- [ ] Swagger UI(/api/docs)에서 AI 엔드포인트 확인

#### 장표 라이브러리 API
- [ ] Swagger UI에서 POST /api/library 테스트
- [ ] GET /api/library 목록 조회
- [ ] GET /api/library/{id} 상세 조회
- [ ] DELETE /api/library/{id} 삭제

---

## 5. 알려진 제한사항

1. **Gemini API 키 필요**: AI 기능은 .env에 GEMINI_API_KEY 설정 필요. 미설정 시 AI 엔드포인트만 503 반환, 나머지는 정상.

2. **PDF→HTML 변환 품질**: Gemini 모델의 응답 품질에 의존. 복잡한 양식은 수동 조정 필요할 수 있음.

3. **입찰 내 편집 미완성**: `/bids/:bidId/pages/:pageId/edit` 경로는 라우트만 등록됨. Phase 3에서 bid_pages 연동 구현 예정.

4. **장표 미리보기 썸네일**: Library 카드에 실제 HTML 미리보기 대신 아이콘 표시. 향후 iframe 썸네일로 개선 가능.

---

## 6. 다음 단계 (Phase 3)

| 항목 | 백엔드 | 프론트엔드 |
|------|--------|-----------|
| 입찰 관리 | 입찰 CRUD API (bids 라우터) | 입찰 목록/생성 UI |
| 장표 조합 | 장표 CRUD + 순서 변경 API | BidWorkspace (드래그앤드롭 레이어 패널) |
| PDF 생성 | Playwright HTML→PDF + PyPDF2 병합 | 최종 PDF 미리보기/다운로드 |
| 인력 배정 | 배정 CRUD API | 인력 선택/배정 모달 |
