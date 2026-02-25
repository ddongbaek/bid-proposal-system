# Phase 2 인수인계 문서 (HWP 변환 보완)

**작성일**: 2026-02-25
**상태**: HWP→HTML 변환 구현 완료, 미세 조정은 편집기 단계에서 진행

---

## 1. 배경 및 방향 전환

### 문제 발견
- Phase 2 초기에 구현한 **Gemini AI PDF→HTML 변환** 품질이 실사용에 부족
- 발주처 양식은 HWP 파일로 제공되므로, **HWP→HTML 직접 변환**이 핵심

### 시도한 접근 (시간순)
| # | 접근 | 결과 |
|---|------|------|
| 1 | Gemini API PDF→HTML | HTML 생성되나 양식 구조 정확도 낮음 |
| 2 | LibreOffice HWP→PDF→HTML | Windows 빌드에 **HWP 필터 DLL 누락** → HWP 변환 불가 |
| 3 | **pyhwp (python-hwp5)** | ✅ 표/양식 구조 유지한 HTML 생성 성공 |

### 최종 결정
- **HWP→HTML 변환**: pyhwp 라이브러리 (`hwp5html` CLI) 사용
- **Gemini AI**: 유지 (PDF→HTML, 자연어 HTML 수정 — 보조 용도)
- **LibreOffice**: HWP 변환에는 사용 불가, 다른 포맷(DOC/DOCX 등) PDF 변환용으로 유지

---

## 2. 생성/수정된 파일

### Backend 신규
| 파일 | 용도 |
|------|------|
| `backend/app/services/libreoffice_service.py` | HWP→HTML 변환 + PDF 처리 통합 서비스 |
| `backend/app/routers/hwp.py` | HWP API 라우터 (3개 엔드포인트) |

### Backend 수정
| 파일 | 변경 |
|------|------|
| `backend/requirements.txt` | `pyhwp>=0.1b15` 추가 |
| `backend/app/main.py` | `hwp` 라우터 등록 (`/api/hwp`) |

### Frontend 신규
| 파일 | 용도 |
|------|------|
| `frontend/src/pages/HwpConverter.tsx` | HWP→HTML 변환 테스트 페이지 |

### Frontend 수정
| 파일 | 변경 |
|------|------|
| `frontend/src/services/api.ts` | `hwpApi.convert()`, `hwpApi.toHtml()` 추가 |
| `frontend/src/App.tsx` | `/hwp` 라우트 추가 |
| `frontend/src/components/layout/Sidebar.tsx` | "HWP변환" 메뉴 추가 (FileOutput 아이콘) |

---

## 3. 구현된 API 엔드포인트

| Method | 경로 | 기능 | 비고 |
|--------|------|------|------|
| POST | `/api/hwp/convert` | HWP→PDF 변환 (LibreOffice) | Windows에서 HWP 필터 부재로 동작 안함 |
| POST | `/api/hwp/to-html` | **HWP→HTML 변환 (pyhwp)** | ✅ 핵심 기능 |
| POST | `/api/hwp/info` | HWP 파일 정보 (페이지 수) | LibreOffice 의존 |

---

## 4. 핵심 기술 상세

### 4.1 pyhwp (python-hwp5)
- **라이브러리**: `pyhwp>=0.1b15` (PyPI)
- **CLI 도구**: `hwp5html`
- **지원 형식**: `.hwp` (HWP5) 만 지원. **HWPX 미지원**
- **변환 과정**:
  1. `hwp5html --html --output output.html input.hwp` → HTML 생성
  2. `hwp5html --css input.hwp` → CSS를 stdout으로 출력 (별도 캡처)
  3. CSS를 HTML `<link>` 태그 위치에 `<style>` 블록으로 인라인 병합

### 4.2 HTML 후처리 (`_inject_normalize_css`)

pyhwp 원본 HTML은 브라우저에서 레이아웃 문제가 있어서 후처리 수행:

#### (1) TableControl 구조 수정 (`_fix_table_control_structure`)
- **문제**: pyhwp가 `<p><span class="TableControl"><table>...</table></span></p>` 구조 생성
- **원인**: HTML 파서가 `<p>` 안에 `<table>`(블록 요소)을 허용하지 않아 테이블이 p 밖으로 이탈
- **해결**: `<p>+<span>` 래퍼를 제거하고 `<div class="TableControl" style="width: fit-content; margin: 0 auto;">` 로 변환
- **정렬**: CSS에서 `text-align: center`인 `parashape-*` 클래스를 파싱하여 중앙정렬 여부 결정
- **중첩 처리**: 테이블 depth 카운팅으로 중첩 테이블 정확히 매칭 + 재귀 호출

#### (2) `.Normal` text-align 제거
- **문제**: `.Normal { text-align: justify }` 가 `p.parashape-* { text-align: center }` 보다 높은 우선순위로 적용되는 경우가 있음
- **해결**: 정규식으로 `.Normal` 클래스의 `text-align` 속성을 주석 처리

#### (3) 폰트 정규화 CSS 삽입
- Google Fonts CDN (나눔고딕, 나눔명조) import
- HWP 전용 폰트 → 로컬 폰트 `@font-face` fallback 선언 (함초롬바탕, 한컴바탕, HY헤드라인M 등)
- 전역 body 폰트 fallback 체인 (맑은 고딕 → Nanum Gothic → sans-serif)

#### (4) 테이블/레이아웃 보정 CSS
- `border-collapse: collapse`, `vertical-align: middle`
- `.Paper` 클래스 중앙정렬 + 인쇄 최적화

### 4.3 LibreOffice 환경변수 충돌
- VS Code의 Python 환경변수(`PYTHONHOME`, `PYTHONPATH` 등)가 LibreOffice 내장 Python 3.12와 충돌
- `_clean_env()` 함수로 subprocess 실행 시 해당 환경변수 제거
- "Could not find platform independent libraries" 경고는 비치명적 (WARNING)

---

## 5. 알려진 제한사항 / 남은 이슈

### 변환 품질
| 항목 | 상태 | 비고 |
|------|------|------|
| 표 구조 | ✅ 양호 | colspan, rowspan 유지 |
| 텍스트 정렬 (중앙/좌측) | ✅ 해결 | TableControl 구조 변환으로 해결 |
| 폰트 | ⚠️ 부분적 | 로컬 미설치 폰트는 fallback 적용 |
| 미세 여백/간격 | ⚠️ 미조정 | pyhwp 한계, 편집기에서 수동 보정 가능 |
| HWPX 지원 | ❌ 미지원 | pyhwp가 HWP5만 지원 |
| 이미지 | ❌ 미지원 | pyhwp의 hwp5html이 이미지 추출 미구현 |

### 미세 조정이 필요한 영역 (낮은 우선순위)
- 일부 셀 내 텍스트 정렬 미세 차이
- 폰트 사이즈/weight 차이 (원본 HWP 대비)
- 이런 부분은 Phase 2 편집기(Monaco)에서 수동 보정 예정

---

## 6. 프론트엔드 HWP 변환 테스트 페이지

### 경로: `/hwp` (HwpConverter.tsx)
- HWP 파일 드래그앤드롭 또는 클릭 업로드
- `.hwp` 파일만 허용 (50MB 제한)
- 업로드 즉시 `POST /api/hwp/to-html` 호출
- 결과: iframe 미리보기 + HTML 소스코드 토글 + 새 창 열기

---

## 7. 다음 세션에서 이어갈 작업

### Phase 2 나머지 (편집기 보완)
- [ ] Gemini AI 연동 테스트 (PDF→HTML, 자연어 수정) — 이전 세션에서 코드 생성됨, 실행 확인 필요
- [ ] Monaco 편집기에 HWP→HTML 변환 결과 로드 연동
- [ ] 장표 라이브러리 CRUD 실행 확인

### Phase 3 착수 (장표 조합기 + PDF 출력)
- 입찰 CRUD API
- BidWorkspace 드래그앤드롭
- Playwright HTML→PDF 변환
- PyPDF2 PDF 병합

---

## 8. 실행 방법

```bash
# 1. pyhwp 설치 (최초 1회)
pip install pyhwp

# 2. 백엔드 시작
cd backend && uvicorn app.main:app --reload --port 8000

# 3. 프론트엔드 시작
cd frontend && npm run dev

# 4. 테스트
# http://localhost:5173/hwp → HWP 파일 업로드
# http://localhost:8000/api/docs → Swagger UI에서 /api/hwp/to-html 테스트
```

---

## 9. 파일 참조 (libreoffice_service.py 구조)

```python
# 주요 함수
convert_hwp_to_pdf()       # LibreOffice HWP→PDF (Windows HWP 필터 부재로 동작 안함)
extract_pages()            # PDF 페이지 범위 추출 (PyPDF2)
get_pdf_page_count()       # PDF 페이지 수 반환
convert_hwp_to_html()      # ✅ pyhwp HWP→HTML 변환 (핵심)

# 내부 헬퍼
_clean_env()               # LibreOffice subprocess용 환경변수 정리
_find_soffice()            # LibreOffice 실행 파일 경로 탐색
_fix_table_control_structure()  # <p><span><table> → <div><table> 구조 변환
_inject_normalize_css()    # 폰트 정규화 + 레이아웃 보정 CSS 삽입
_FONT_NORMALIZE_CSS        # 폰트 매핑 + 레이아웃 보정 CSS 상수
```
