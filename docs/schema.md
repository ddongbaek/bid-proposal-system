# 데이터베이스 스키마 명세

## 개요
- DB: SQLite (파일 기반)
- ORM: SQLAlchemy 2.0
- 마이그레이션: Alembic
- 파일 위치: `data/db/bid_proposal.db`

---

## ERD (Entity Relationship)

```
personnel (인력)
    ├─── 1:N ──→ certifications (자격증)
    ├─── 1:N ──→ project_history (프로젝트 이력)
    └─── N:M ──→ bid_personnel (입찰 배정) ──→ bids (입찰)

bids (입찰)
    └─── 1:N ──→ bid_pages (입찰 장표)

page_library (장표 라이브러리) - 독립 테이블
```

---

## 테이블 상세

### 1. personnel (인력 기본정보)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 인력 ID |
| name | TEXT | NOT NULL | 이름 |
| title | TEXT | NULL | 직급 (사원/대리/과장/차장/부장 등) |
| department | TEXT | NULL | 부서 |
| birth_date | DATE | NULL | 생년월일 |
| phone | TEXT | NULL | 연락처 |
| email | TEXT | NULL | 이메일 |
| education_level | TEXT | NULL | 학력 (학사/석사/박사) |
| education_school | TEXT | NULL | 출신 학교 |
| education_major | TEXT | NULL | 전공 |
| graduation_year | INTEGER | NULL | 졸업년도 |
| hire_date | DATE | NULL | 입사일 |
| years_of_experience | INTEGER | NULL | 총 경력 년수 |
| notes | TEXT | NULL | 비고/메모 |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |
| updated_at | TIMESTAMP | DEFAULT NOW | 수정일 |

**인덱스:**
- `idx_personnel_name` ON (name) - 이름 검색용
- `idx_personnel_department` ON (department) - 부서 필터링용

---

### 2. certifications (자격증)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 자격증 ID |
| personnel_id | INTEGER | FK, NOT NULL | → personnel.id |
| cert_name | TEXT | NOT NULL | 자격증명 (예: 정보관리기술사) |
| cert_number | TEXT | NULL | 자격번호 |
| cert_date | DATE | NULL | 취득일 |
| cert_issuer | TEXT | NULL | 발급기관 (예: 한국산업인력공단) |
| cert_file_path | TEXT | NULL | 스캔본 파일 경로 (data/uploads/ 하위) |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |

**외래키:** `personnel_id` → `personnel(id)` ON DELETE CASCADE
**인덱스:** `idx_cert_personnel` ON (personnel_id)

---

### 3. project_history (프로젝트 이력)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 이력 ID |
| personnel_id | INTEGER | FK, NOT NULL | → personnel.id |
| project_name | TEXT | NOT NULL | 프로젝트명 |
| client | TEXT | NULL | 발주처 |
| role | TEXT | NULL | 역할 (PM/PL/개발자/분석가 등) |
| start_date | DATE | NULL | 시작일 |
| end_date | DATE | NULL | 종료일 |
| budget | TEXT | NULL | 사업규모 (예: "5억원") |
| description | TEXT | NULL | 업무 내용 |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |

**외래키:** `personnel_id` → `personnel(id)` ON DELETE CASCADE
**인덱스:** `idx_project_personnel` ON (personnel_id)

---

### 4. page_library (장표 라이브러리)

자주 사용하는 장표 양식을 저장해두고 다른 입찰에서 복사해서 재사용하는 테이블.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 장표 ID |
| name | TEXT | NOT NULL | 장표 이름 (예: "참여인력 현황표") |
| category | TEXT | NULL | 분류 (인력현황/실적/수행계획/기타) |
| html_content | TEXT | NOT NULL | HTML 코드 |
| css_content | TEXT | NULL | CSS 코드 |
| description | TEXT | NULL | 설명 |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |
| updated_at | TIMESTAMP | DEFAULT NOW | 수정일 |

**인덱스:** `idx_library_category` ON (category)

---

### 5. bids (입찰 프로젝트)

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 입찰 ID |
| bid_name | TEXT | NOT NULL | 입찰명 (예: "OO부 정보시스템 구축") |
| client_name | TEXT | NULL | 발주처 (예: "OO시청") |
| bid_number | TEXT | NULL | 공고번호 |
| deadline | DATE | NULL | 마감일 |
| status | TEXT | DEFAULT 'draft' | 상태: draft/review/complete |
| notice_file_path | TEXT | NULL | 입찰공고 PDF 경로 |
| requirements_text | TEXT | NULL | 제출서류 목록 메모 |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |
| updated_at | TIMESTAMP | DEFAULT NOW | 수정일 |

**인덱스:**
- `idx_bids_status` ON (status) - 상태별 필터링
- `idx_bids_deadline` ON (deadline) - 마감일순 정렬

---

### 6. bid_pages (입찰 장표)

입찰에 포함된 모든 장표 (HTML 생성 장표 + 업로드 PDF).
sort_order로 최종 PDF 병합 순서를 결정.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 장표 ID |
| bid_id | INTEGER | FK, NOT NULL | → bids.id |
| page_type | TEXT | NOT NULL | 'html' 또는 'pdf' |
| page_name | TEXT | NULL | 표시명 (예: "참여인력 현황표") |
| sort_order | INTEGER | NOT NULL | 순서 (1부터 시작) |
| html_content | TEXT | NULL | HTML 코드 (page_type='html'일 때) |
| css_content | TEXT | NULL | CSS 코드 (page_type='html'일 때) |
| pdf_file_path | TEXT | NULL | 업로드 PDF 경로 (page_type='pdf'일 때) |
| pdf_page_start | INTEGER | NULL | PDF 시작 페이지 (NULL이면 전체) |
| pdf_page_end | INTEGER | NULL | PDF 끝 페이지 |
| thumbnail_path | TEXT | NULL | 썸네일 이미지 경로 |
| generated_pdf_path | TEXT | NULL | HTML→PDF 변환 결과 경로 |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |
| updated_at | TIMESTAMP | DEFAULT NOW | 수정일 |

**외래키:** `bid_id` → `bids(id)` ON DELETE CASCADE
**인덱스:**
- `idx_pages_bid_order` ON (bid_id, sort_order) - 순서대로 조회

---

### 7. bid_personnel (입찰 배정 인력)

입찰에 배정된 인력. 같은 인력이라도 입찰마다 다른 역할/선택 이력을 가질 수 있음.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| id | INTEGER | PK, AI | 배정 ID |
| bid_id | INTEGER | FK, NOT NULL | → bids.id |
| personnel_id | INTEGER | FK, NOT NULL | → personnel.id |
| role_in_bid | TEXT | NULL | 이 입찰에서의 역할 (PM/PL 등) |
| sort_order | INTEGER | NULL | 인력 순서 |
| custom_data | TEXT | NULL | JSON: 커스터마이징된 데이터 |
| selected_projects | TEXT | NULL | JSON: 선택된 프로젝트 이력 ID 배열 [1,3,5] |
| created_at | TIMESTAMP | DEFAULT NOW | 등록일 |

**외래키:**
- `bid_id` → `bids(id)` ON DELETE CASCADE
- `personnel_id` → `personnel(id)` (CASCADE 아님 - 인력 삭제 시 배정 유지)

**인덱스:**
- `idx_bid_personnel_bid` ON (bid_id)
- `idx_bid_personnel_unique` UNIQUE ON (bid_id, personnel_id) - 중복 배정 방지

---

## 파일 저장 경로 규칙

```
data/
├── db/
│   └── bid_proposal.db                    # SQLite DB 파일
├── uploads/
│   ├── certifications/
│   │   └── {personnel_id}/
│   │       └── {cert_id}_{filename}.pdf   # 자격증 스캔본
│   ├── notices/
│   │   └── {bid_id}/
│   │       └── notice.pdf                 # 입찰공고 PDF
│   └── pages/
│       └── {bid_id}/
│           └── {page_id}_{filename}.pdf   # 업로드 PDF 장표
├── thumbnails/
│   └── {bid_id}/
│       └── {page_id}_thumb.png            # 장표 썸네일
└── generated/
    └── {bid_id}/
        ├── page_{page_id}.pdf             # 개별 HTML→PDF 결과
        └── final_merged.pdf               # 최종 병합 PDF
```

---

## custom_data JSON 구조 (bid_personnel)

인력 정보를 입찰별로 커스터마이징할 때 사용:

```json
{
  "override_title": "특급기술자",      // 직급 오버라이드
  "override_role": "PM",              // 역할 오버라이드
  "additional_notes": "해당 분야 10년 경력", // 추가 메모
  "custom_fields": {                  // 자유 추가 필드
    "투입비율": "100%",
    "투입기간": "2026.03 ~ 2026.12"
  }
}
```

## selected_projects JSON 구조 (bid_personnel)

해당 입찰에서 보여줄 프로젝트 이력 ID 목록:

```json
[1, 3, 7]  // project_history.id 배열
```
