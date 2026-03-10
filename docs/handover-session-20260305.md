# 인수인계 문서 — 2026-03-05 세션 (편집기 개편 + 회사정보/인감 자동채움)

**작성일**: 2026-03-05 (세션 2차~3차)
**상태**: 전 Phase 구현 완료 후 실사용 개선 단계. 미커밋 상태.

---

## 1. 이번 세션에서 완료한 작업

### 1.1 빈 TableControl 자동 제거 (pyhwp 아티팩트)
- **문제**: HWP→HTML 변환 시 원본에 없는 빈 박스(`.TableControl`)가 표시됨
- **원인**: pyhwp가 빈 테이블 요소를 생성하며 `&nbsp;`(`\u00a0`)로 채움
- **해결 (3곳 동시 적용)**:
  - `libreoffice_service.py`: `_remove_empty_table_controls()` 후처리
  - `BidWorkspace.tsx` + `PreviewPanel.tsx`: DOMContentLoaded JS에서 빈 `.TableControl` 제거
  - `pdf_service.py`: Playwright `page.evaluate()`로 PDF 생성 전 제거
- **핵심 로직**: `textContent.replace(/[\u00a0\s]/g, "")` — nbsp 포함 공백 모두 제거 후 빈 것 삭제

### 1.2 AI 채팅 패널 제거 → HTML 다운로드/업로드 방식
- **사유**: Gemini AI가 대용량 HTML 구조 수정을 제대로 못 함 (엉뚱한 요소 삭제)
- **변경**:
  - `PageEditor.tsx`: 3분할(AI채팅|코드|미리보기) → **2분할(코드|미리보기)**
  - 상단 툴바에 **HTML 다운로드** + **HTML 업로드** 버튼 추가
  - `AiChatPanel.tsx`는 미사용 상태 (파일 유지, import 제거)
- **새 워크플로우**: HTML 다운로드 → 외부 편집기(VS Code 등)로 수정 → 업로드 → 미리보기 확인 → 저장

### 1.3 HWP 변환 시 자동 placeholder 삽입
- **위치**: `libreoffice_service.py` → `_auto_insert_placeholders()`
- **로직**:
  1. 모든 `<tr>` 행 스캔
  2. 셀 텍스트가 알려진 라벨과 매칭 ("상호", "성명", "전화번호" 등)
  3. 옆 빈 셀에 `{{placeholder}}` 자동 삽입
  4. 문맥 감지: 같은 행 **왼쪽 셀** 텍스트로 문맥 판단 (예: "대표자" 행의 "성명" → `{{representative}}`)
  5. 빈 왼쪽 셀만 있는 계속 행 → 이전 1행 참조 (rowspan 대응)
- **지원 placeholder 매핑** (`_FORM_LABELS` 딕셔너리):

  | 카테고리 | 라벨 → placeholder |
  |----------|-------------------|
  | 회사 | 상호→company_name, 사업자등록번호→business_number, 법인등록번호→corporate_number, 소재지/주소→address, 전화→phone, 팩스→fax |
  | 대표자 | 대표자+성명→representative, 대표자+생년월일→representative_birth |
  | PM | PM+성명→pm_name, PM+전화→pm_phone, PM+이메일→pm_email |
  | 제출자 | 제출자+성명→name, 제출자+전화→submitter_phone, 제출자+이메일→submitter_email |
  | 입찰 | 공고번호→bid_number, 공고일자→bid_date, 공고명→bid_name |

### 1.4 fill_service.py PM/제출자 역할별 별칭 추가
- `pm_name` → 인력DB의 `name`, `pm_phone` → `phone`, `pm_email` → `email`
- `submitter_phone` → `phone`, `submitter_email` → `email`
- 인력 자동 채움 시 기존 `{{name}}` 외에 역할별 placeholder도 치환

### 1.5 회사정보 저장 버그 수정 (BidWorkspace)
- **문제**: "회사정보" 버튼으로 `{{placeholder}}`를 채운 후 "저장" 버튼이 동작하지 않음
- **원인**: `handleSaveFilled`가 `fillPersonnelId` 필수로 요구 — 회사정보만 채울 때는 null
- **해결**: `fillPersonnelId`가 없으면 `bidApi.updatePage()`로 직접 HTML 저장

```typescript
const handleSaveFilled = async () => {
  if (!selectedPage || !filledHtml || !numericBidId) return;
  if (fillPersonnelId) {
    await bidApi.fillPersonnel(numericBidId, selectedPage.id, fillPersonnelId, true);
  } else {
    await bidApi.updatePage(numericBidId, selectedPage.id, { html_content: filledHtml });
  }
};
```

### 1.6 입찰 공고정보 자동 채움
- **문제**: 입찰 생성 시 입력한 공고번호/공고명이 장표에 반영되지 않음
- **해결 (프론트+백엔드 양쪽)**:
  - `BidWorkspace.tsx` `handleFillCompany`: bid 객체에서 `bid_number`, `bid_name`, `client_name` 추출하여 치환
  - `fill_service.py` `fill_bid_info()`: 서버사이드에서도 `{{bid_name}}`, `{{bid_number}}`, `{{client_name}}` 치환
  - `routers/bid.py`: 인력 채우기 API에서 `fill_bid_info()` 함께 호출

### 1.7 Settings 페이지 — 우편번호 + 이미지 업로드
- **우편번호**: `zip_code` 필드 추가 (DB + API + 프론트)
- **인감도장/원본대조필 이미지 업로드**:
  - Settings 페이지에 "인감/도장" 섹션 추가
  - `ImageUploadCard` 컴포넌트: 파일 선택 → 미리보기 → 업로드/변경/삭제
  - 백엔드: `POST/DELETE/GET /api/company/images/{image_type}` (3개 엔드포인트)
  - 파일 저장 경로: `data/uploads/company/{image_type}.{ext}`

### 1.8 인감도장 `(인)` 오버레이
- **기능**: 장표 HTML에서 `(인)` 또는 `(印)` 텍스트 위에 인감 PNG를 반투명 오버레이
- **구현 (프론트+백엔드 양쪽)**:
  - `BidWorkspace.tsx` `handleFillCompany`: 인감 이미지를 fetch → base64 Data URI 변환 → `(인)` 패턴을 `<span style="position:relative">` + `<img style="position:absolute">` 구조로 교체
  - `fill_service.py` `_overlay_seal_image()`: 서버사이드에서도 동일 로직 (인력 채우기 시)
  - base64 인라인이므로 Playwright PDF 생성에서도 정상 출력

---

## 2. 수정/생성된 파일 목록

### Backend

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/services/libreoffice_service.py` | `_remove_empty_table_controls()`, `_auto_insert_placeholders()`, `_FORM_LABELS` 매핑 |
| `backend/app/services/fill_service.py` | PM/제출자 별칭, `fill_bid_info()`, `_overlay_seal_image()`, `zip_code` 매핑 |
| `backend/app/services/pdf_service.py` | Playwright evaluate로 빈 TableControl 제거 |
| `backend/app/routers/bid.py` | fill 엔드포인트에서 `fill_bid_info()` 호출 추가 |
| `backend/app/routers/company.py` | 이미지 업로드/삭제/다운로드 3개 엔드포인트 추가 |
| `backend/app/models/bid.py` | CompanyInfo에 `zip_code`, `seal_image`, `certified_copy_image` 컬럼 |
| `backend/app/schemas/bid.py` | CompanyInfoUpdate/Response에 필드 추가 |
| `backend/app/database.py` | 간이 마이그레이션 3건 (zip_code, seal_image, certified_copy_image) |

### Frontend

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/pages/PageEditor.tsx` | AI 패널 제거, 2분할 레이아웃, HTML 다운로드/업로드 버튼 |
| `frontend/src/pages/BidWorkspace.tsx` | 회사정보 저장 수정, 공고정보 채움, 인감 오버레이, 빈박스 cleanup |
| `frontend/src/pages/Settings.tsx` | 우편번호 입력, ImageUploadCard 컴포넌트, 인감/원본대조필 업로드 UI |
| `frontend/src/components/editor/PreviewPanel.tsx` | 빈 TableControl cleanup script 추가 |
| `frontend/src/types/index.ts` | CompanyInfo에 `zip_code`, `seal_image`, `certified_copy_image` |
| `frontend/src/services/api.ts` | companyApi에 `uploadImage`, `deleteImage`, `imageUrl` 추가 |

---

## 3. 핵심 구현 상세

### 3.1 자동 placeholder 삽입 로직 (`_auto_insert_placeholders`)

```python
def _auto_insert_placeholders(html: str) -> str:
    """HWP→HTML 결과에서 라벨 옆 빈 셀에 {{placeholder}} 자동 삽입"""
    soup = BeautifulSoup(html, "html.parser")
    for tr in soup.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        for i, cell in enumerate(cells):
            label = cell.get_text(strip=True)
            if label in _FORM_LABELS:
                context, _, placeholder = _FORM_LABELS[label]
                # 문맥 감지: 같은 행의 왼쪽 셀 텍스트 확인
                left_text = _get_left_context(cells, i)
                matched = _match_context(left_text, context)
                if matched and _has_empty_right_cell(cells, i):
                    cells[i + 1].string = "{{" + placeholder + "}}"
```

- 문맥 감지로 동일 라벨의 다른 의미 구분 (예: "성명"이 대표자/PM/제출자 각각 다른 placeholder)
- rowspan으로 병합된 셀 → 왼쪽 셀이 비었으면 이전 행 1개만 참조

### 3.2 인감 오버레이 CSS 구조

```html
<!-- (인) 텍스트가 아래 구조로 교체됨 -->
<span style="position:relative; display:inline-block;">
  (인)
  <img src="data:image/png;base64,..."
       style="position:absolute; top:50%; left:50%;
              transform:translate(-50%,-50%);
              width:60px; height:60px; opacity:0.85;
              pointer-events:none;" />
</span>
```

- base64 Data URI → 외부 파일 참조 없이 자체 완결 (iframe, PDF 모두 동작)
- `opacity:0.85` → 반투명하게 겹침
- `pointer-events:none` → 클릭 방해 없음

### 3.3 회사정보 + 공고정보 채움 흐름

```
[BidWorkspace] "회사정보" 버튼 클릭
  → handleFillCompany() (프론트사이드)
    ├── bid 객체에서 bid_number, bid_name, client_name 치환
    ├── companyInfo에서 company_name, address, phone 등 치환
    ├── 인감 이미지 → fetch → base64 → (인) 오버레이
    └── filledHtml 상태 설정 → iframe 미리보기

[BidWorkspace] "인력 채우기" 버튼 클릭
  → POST /api/bids/:id/pages/:pageId/fill (서버사이드)
    ├── fill_service.fill_company() — 회사정보 치환
    ├── fill_service.fill_bid_info() — 공고정보 치환
    ├── fill_service._overlay_seal_image() — 인감 오버레이
    └── fill_service.fill_personnel() — 인력정보 치환
```

### 3.4 Settings 이미지 업로드 API

```
POST   /api/company/images/{seal_image|certified_copy_image}  → 업로드 (multipart)
DELETE /api/company/images/{seal_image|certified_copy_image}  → 삭제
GET    /api/company/images/{seal_image|certified_copy_image}  → 다운로드 (FileResponse)
```

- 허용 타입: PNG, JPEG, GIF, WebP
- 저장 경로: `data/uploads/company/seal_image.png` 등
- DB에는 파일 경로(문자열) 저장

---

## 4. 알려진 이슈 / 주의사항

### placeholder 자동 삽입 한계
- `_FORM_LABELS`에 등록된 라벨만 인식 (새 양식에 처음 보는 라벨은 수동 추가 필요)
- 라벨과 값 셀이 같은 `<tr>` 안에 있어야 동작 (복잡한 병합 구조는 미지원)
- 문맥 감지는 왼쪽 셀만 확인 — 위쪽 셀의 rowspan은 이전 1행만 참조

### 인감 오버레이
- `(인)` 또는 `(印)` 텍스트가 있어야 동작 — 다른 패턴은 미지원
- 이미지 크기 고정 (60x60px) — 양식에 따라 크기 조절 필요할 수 있음
- Settings에서 인감 이미지를 먼저 등록해야 오버레이 적용

### 회사정보 저장 시 이미지 경로 제외
- `handleSave`에서 `seal_image`, `certified_copy_image` 경로 필드를 제외하고 전송
- 이 필드들은 이미지 업로드 API로만 변경 가능 (PUT 본문에 포함하면 경로 문자열이 덮어씀)

---

## 5. 미커밋 변경사항 (git status)

이전 세션(1차~3차)의 모든 변경사항이 미커밋 상태:

```
M  backend/app/services/fill_service.py
M  backend/app/services/libreoffice_service.py
M  backend/app/services/pdf_service.py
M  backend/app/routers/bid.py
M  backend/app/routers/company.py
M  backend/app/models/bid.py
M  backend/app/schemas/bid.py
M  backend/app/database.py
M  frontend/src/pages/PageEditor.tsx
M  frontend/src/pages/BidWorkspace.tsx
M  frontend/src/pages/Settings.tsx
M  frontend/src/components/editor/PreviewPanel.tsx
M  frontend/src/types/index.ts
M  frontend/src/services/api.ts
```

---

## 6. 남은 개선사항

- [ ] 자동 placeholder 매핑 확장 (더 많은 양식 라벨 패턴)
- [ ] HWP 자동 페이지 분리
- [ ] PDF 생성 진행률 표시
- [ ] 인감 이미지 크기 양식별 자동 조절
- [ ] AiChatPanel.tsx 파일 정리 (미사용, 삭제 가능)
- [ ] google.generativeai → google.genai 마이그레이션 (deprecation 경고)
