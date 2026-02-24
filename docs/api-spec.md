# API 엔드포인트 명세

## 기본 정보
- Base URL: `http://{server_ip}:8000/api`
- 인증: IP 화이트리스트 (별도 토큰 없음)
- Content-Type: application/json (파일 업로드 시 multipart/form-data)
- 에러 응답: `{"detail": "에러 메시지"}`

---

## 1. 인력 관리 (`/api/personnel`)

### 1.1 인력 목록 조회
```
GET /api/personnel
Query: ?search=김&department=기술팀&page=1&size=20
Response 200:
{
  "items": [
    {
      "id": 1,
      "name": "김OO",
      "title": "부장",
      "department": "기술팀",
      "years_of_experience": 15,
      "certification_count": 3,
      "project_count": 8
    }
  ],
  "total": 25,
  "page": 1,
  "size": 20
}
```

### 1.2 인력 상세 조회
```
GET /api/personnel/{id}
Response 200:
{
  "id": 1,
  "name": "김OO",
  "title": "부장",
  "department": "기술팀",
  "birth_date": "1985-03-15",
  "phone": "010-1234-5678",
  "email": "kim@company.com",
  "education_level": "석사",
  "education_school": "OO대학교",
  "education_major": "컴퓨터공학",
  "graduation_year": 2010,
  "hire_date": "2012-03-01",
  "years_of_experience": 15,
  "notes": "",
  "certifications": [...],
  "project_history": [...],
  "created_at": "2026-02-24T10:00:00",
  "updated_at": "2026-02-24T10:00:00"
}
```

### 1.3 인력 등록
```
POST /api/personnel
Body:
{
  "name": "김OO",
  "title": "부장",
  "department": "기술팀",
  "birth_date": "1985-03-15",
  "phone": "010-1234-5678",
  "email": "kim@company.com",
  "education_level": "석사",
  "education_school": "OO대학교",
  "education_major": "컴퓨터공학",
  "graduation_year": 2010,
  "hire_date": "2012-03-01",
  "years_of_experience": 15,
  "notes": ""
}
Response 201: { "id": 1, ...전체 데이터 }
```

### 1.4 인력 수정
```
PUT /api/personnel/{id}
Body: (1.3과 동일 구조, 변경 필드만)
Response 200: { ...수정된 전체 데이터 }
```

### 1.5 인력 삭제
```
DELETE /api/personnel/{id}
Response 204: (No Content)
```

---

## 2. 자격증 (`/api/personnel/{id}/certifications`)

### 2.1 자격증 목록
```
GET /api/personnel/{personnel_id}/certifications
Response 200:
[
  {
    "id": 1,
    "cert_name": "정보관리기술사",
    "cert_number": "12345",
    "cert_date": "2018-05-20",
    "cert_issuer": "한국산업인력공단",
    "cert_file_path": "/uploads/certifications/1/1_기술사.pdf",
    "has_file": true
  }
]
```

### 2.2 자격증 추가
```
POST /api/personnel/{personnel_id}/certifications
Content-Type: multipart/form-data
Fields:
  - cert_name: string (필수)
  - cert_number: string
  - cert_date: date
  - cert_issuer: string
  - file: File (PDF, 선택)
Response 201: { "id": 1, ...전체 데이터 }
```

### 2.3 자격증 삭제
```
DELETE /api/personnel/{personnel_id}/certifications/{cert_id}
Response 204: (No Content) + 첨부 파일도 삭제
```

### 2.4 자격증 파일 다운로드
```
GET /api/personnel/{personnel_id}/certifications/{cert_id}/file
Response 200: (PDF 파일 스트림)
```

---

## 3. 프로젝트 이력 (`/api/personnel/{id}/projects`)

### 3.1 이력 목록
```
GET /api/personnel/{personnel_id}/projects
Response 200:
[
  {
    "id": 1,
    "project_name": "OO시 정보화사업",
    "client": "OO시",
    "role": "PM",
    "start_date": "2023-03-01",
    "end_date": "2023-12-31",
    "budget": "5억원",
    "description": "시스템 설계 및 프로젝트 총괄"
  }
]
```

### 3.2 이력 추가
```
POST /api/personnel/{personnel_id}/projects
Body:
{
  "project_name": "OO시 정보화사업",
  "client": "OO시",
  "role": "PM",
  "start_date": "2023-03-01",
  "end_date": "2023-12-31",
  "budget": "5억원",
  "description": "시스템 설계 및 프로젝트 총괄"
}
Response 201: { "id": 1, ...전체 데이터 }
```

### 3.3 이력 수정
```
PUT /api/personnel/{personnel_id}/projects/{project_id}
Body: (3.2와 동일, 변경 필드만)
Response 200: { ...수정된 전체 데이터 }
```

### 3.4 이력 삭제
```
DELETE /api/personnel/{personnel_id}/projects/{project_id}
Response 204
```

---

## 4. 입찰 프로젝트 (`/api/bids`)

### 4.1 입찰 목록
```
GET /api/bids
Query: ?status=draft&page=1&size=20
Response 200:
{
  "items": [
    {
      "id": 1,
      "bid_name": "OO부 정보시스템 구축",
      "client_name": "OO시청",
      "bid_number": "2026-001",
      "deadline": "2026-03-15",
      "status": "draft",
      "page_count": 6,
      "personnel_count": 3,
      "created_at": "2026-02-24T10:00:00"
    }
  ],
  "total": 5,
  "page": 1,
  "size": 20
}
```

### 4.2 입찰 상세 조회
```
GET /api/bids/{id}
Response 200:
{
  "id": 1,
  "bid_name": "OO부 정보시스템 구축",
  "client_name": "OO시청",
  "bid_number": "2026-001",
  "deadline": "2026-03-15",
  "status": "draft",
  "notice_file_path": "/uploads/notices/1/notice.pdf",
  "requirements_text": "1. 참여인력 현황표\n2. 유사실적 증명서\n...",
  "pages": [...],       // bid_pages 목록 (sort_order순)
  "personnel": [...],   // bid_personnel 목록
  "created_at": "2026-02-24T10:00:00",
  "updated_at": "2026-02-24T10:00:00"
}
```

### 4.3 입찰 생성
```
POST /api/bids
Content-Type: multipart/form-data
Fields:
  - bid_name: string (필수)
  - client_name: string
  - bid_number: string
  - deadline: date
  - requirements_text: string
  - notice_file: File (PDF, 선택)
Response 201: { "id": 1, ...전체 데이터 }
```

### 4.4 입찰 수정
```
PUT /api/bids/{id}
Body: { "bid_name": "...", "status": "review", ... }
Response 200: { ...수정된 전체 데이터 }
```

### 4.5 입찰 삭제
```
DELETE /api/bids/{id}
Response 204: (관련 장표, 파일 모두 삭제)
```

---

## 5. 입찰 장표 (`/api/bids/{bid_id}/pages`)

### 5.1 장표 목록 (순서대로)
```
GET /api/bids/{bid_id}/pages
Response 200:
[
  {
    "id": 1,
    "page_type": "html",
    "page_name": "참여인력 현황표",
    "sort_order": 1,
    "thumbnail_url": "/thumbnails/1/1_thumb.png",
    "has_generated_pdf": true
  },
  {
    "id": 2,
    "page_type": "pdf",
    "page_name": "사업자등록증.pdf",
    "sort_order": 2,
    "thumbnail_url": "/thumbnails/1/2_thumb.png",
    "pdf_page_start": null,
    "pdf_page_end": null
  }
]
```

### 5.2 HTML 장표 추가
```
POST /api/bids/{bid_id}/pages/html
Body:
{
  "page_name": "참여인력 현황표",
  "html_content": "<table>...</table>",
  "css_content": "table { width: 100%; }"
}
Response 201: { "id": 1, "sort_order": 자동부여, ... }
```

### 5.3 PDF 장표 업로드
```
POST /api/bids/{bid_id}/pages/pdf
Content-Type: multipart/form-data
Fields:
  - page_name: string
  - file: File (PDF, 필수)
  - page_start: integer (선택, 특정 페이지만)
  - page_end: integer (선택)
Response 201: { "id": 2, "sort_order": 자동부여, "thumbnail_url": "...", ... }
```

### 5.4 장표 상세 조회
```
GET /api/bids/{bid_id}/pages/{page_id}
Response 200:
{
  "id": 1,
  "page_type": "html",
  "page_name": "참여인력 현황표",
  "sort_order": 1,
  "html_content": "<table>...</table>",
  "css_content": "table { width: 100%; }",
  "thumbnail_url": "/thumbnails/1/1_thumb.png"
}
```

### 5.5 장표 수정 (HTML 내용)
```
PUT /api/bids/{bid_id}/pages/{page_id}
Body:
{
  "page_name": "수정된 이름",
  "html_content": "<table>...</table>",
  "css_content": "..."
}
Response 200: { ...수정된 데이터 }
```

### 5.6 장표 순서 변경
```
PUT /api/bids/{bid_id}/pages/reorder
Body:
{
  "page_ids": [3, 1, 2, 5, 4]  // 새로운 순서대로 ID 배열
}
Response 200: { "message": "순서가 변경되었습니다" }
```

### 5.7 장표 삭제
```
DELETE /api/bids/{bid_id}/pages/{page_id}
Response 204: (파일 포함 삭제, 나머지 순서 재정렬)
```

---

## 6. 입찰 인력 배정 (`/api/bids/{bid_id}/personnel`)

### 6.1 배정 인력 목록
```
GET /api/bids/{bid_id}/personnel
Response 200:
[
  {
    "id": 1,
    "personnel_id": 3,
    "personnel_name": "김OO",
    "personnel_title": "부장",
    "role_in_bid": "PM",
    "sort_order": 1,
    "selected_project_count": 3
  }
]
```

### 6.2 인력 배정
```
POST /api/bids/{bid_id}/personnel
Body:
{
  "personnel_id": 3,
  "role_in_bid": "PM",
  "selected_projects": [1, 3, 7],
  "custom_data": {
    "투입비율": "100%",
    "투입기간": "2026.03 ~ 2026.12"
  }
}
Response 201: { "id": 1, ... }
```

### 6.3 배정 정보 수정
```
PUT /api/bids/{bid_id}/personnel/{assignment_id}
Body: { "role_in_bid": "PL", "selected_projects": [1, 5], ... }
Response 200: { ...수정된 데이터 }
```

### 6.4 배정 해제
```
DELETE /api/bids/{bid_id}/personnel/{assignment_id}
Response 204
```

---

## 7. AI 서비스 (`/api/ai`)

### 7.1 PDF → HTML 변환
```
POST /api/ai/pdf-to-html
Content-Type: multipart/form-data
Fields:
  - file: File (PDF, 필수)
  - instructions: string (선택, 추가 지시사항)
Response 200:
{
  "html_content": "<table>...</table>",
  "css_content": "table { ... }",
  "detected_variables": ["company_name", "project_title", "personnel_list"],
  "message": "변환 완료. 빈칸은 {{변수명}} 형태로 표시되었습니다."
}
```

### 7.2 HTML 자연어 수정
```
POST /api/ai/modify
Body:
{
  "html_content": "<table>현재 HTML...</table>",
  "css_content": "현재 CSS...",
  "request": "3번째 열 너비를 넓혀줘"
}
Response 200:
{
  "html_content": "<table>수정된 HTML...</table>",
  "css_content": "수정된 CSS...",
  "changes_description": "3번째 열(자격증) 너비를 20%에서 30%로 변경했습니다."
}
```

---

## 8. PDF 생성/병합 (`/api/pdf`)

### 8.1 개별 장표 PDF 생성 (HTML→PDF)
```
POST /api/pdf/generate/{page_id}
Response 200:
{
  "pdf_url": "/generated/1/page_1.pdf",
  "page_count": 1,
  "message": "PDF 생성 완료"
}
```

### 8.2 최종 PDF 병합
```
POST /api/pdf/merge/{bid_id}
Response 200:
{
  "pdf_url": "/generated/1/final_merged.pdf",
  "total_pages": 12,
  "message": "12페이지 PDF가 생성되었습니다."
}
```

### 8.3 PDF 다운로드
```
GET /api/pdf/download/{bid_id}
Response 200: (PDF 파일 스트림, Content-Disposition: attachment)
```

### 8.4 PDF 미리보기
```
GET /api/pdf/preview/{bid_id}
Response 200: (PDF 파일 스트림, Content-Disposition: inline)
```

---

## 9. 장표 라이브러리 (`/api/library`)

### 9.1 라이브러리 목록
```
GET /api/library
Query: ?category=인력현황
Response 200:
[
  {
    "id": 1,
    "name": "참여인력 현황표",
    "category": "인력현황",
    "description": "기본 인력현황표 양식",
    "created_at": "2026-02-24T10:00:00"
  }
]
```

### 9.2 장표를 라이브러리에 저장
```
POST /api/library
Body:
{
  "name": "참여인력 현황표",
  "category": "인력현황",
  "html_content": "<table>...</table>",
  "css_content": "...",
  "description": "OO시 양식 기반"
}
Response 201: { "id": 1, ... }
```

### 9.3 라이브러리에서 장표 불러오기
```
GET /api/library/{id}
Response 200:
{
  "id": 1,
  "name": "참여인력 현황표",
  "html_content": "<table>...</table>",
  "css_content": "...",
  ...
}
```

### 9.4 라이브러리 항목 삭제
```
DELETE /api/library/{id}
Response 204
```

---

## 10. 인력 데이터 → HTML 자동 생성 (`/api/pages/generate`)

### 10.1 인력 현황표 자동 생성
```
POST /api/pages/generate/personnel-table
Body:
{
  "bid_id": 1,
  "personnel_ids": [1, 2, 3],
  "template_html": "<table>...{{name}}...{{title}}...</table>",
  "template_css": "..."
}
Response 201:
{
  "page_id": 5,
  "page_name": "참여인력 현황표 (자동생성)",
  "message": "3명의 인력 정보가 채워진 장표가 생성되었습니다."
}
```

### 10.2 개인별 경력증명서 자동 생성
```
POST /api/pages/generate/career-cert
Body:
{
  "bid_id": 1,
  "personnel_id": 1,
  "selected_projects": [1, 3, 7],
  "template_html": "<div>...{{name}}...{{projects}}...</div>",
  "template_css": "..."
}
Response 201:
{
  "page_id": 6,
  "page_name": "김OO 경력증명서 (자동생성)",
  "message": "경력증명서가 생성되었습니다."
}
```

---

## 에러 코드

| 코드 | 상황 |
|------|------|
| 400 | 잘못된 요청 (필수 필드 누락, 잘못된 형식) |
| 403 | IP 차단 |
| 404 | 리소스를 찾을 수 없음 |
| 413 | 파일 크기 초과 (최대 50MB) |
| 422 | 유효성 검사 실패 |
| 500 | 서버 내부 오류 |
| 503 | Gemini API 연결 실패 |
