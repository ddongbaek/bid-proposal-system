"""입찰 관련 Pydantic 스키마 (Phase 1 기본 정의, Phase 2 AI/Library, Phase 3 장표/인력)"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# ─── 입찰 장표 (BidPage) 스키마 ───


class BidPageCreate(BaseModel):
    """HTML 장표 추가 요청"""

    page_name: str | None = None
    html_content: str
    css_content: str | None = None


class BidPageUpdate(BaseModel):
    """장표 수정 요청"""

    page_name: str | None = None
    html_content: str | None = None
    css_content: str | None = None
    pdf_page_start: int | None = None
    pdf_page_end: int | None = None


class BidPageResponse(BaseModel):
    """장표 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_id: int
    page_type: str
    page_name: str | None = None
    sort_order: int
    html_content: str | None = None
    css_content: str | None = None
    pdf_file_path: str | None = None
    pdf_page_start: int | None = None
    pdf_page_end: int | None = None
    thumbnail_path: str | None = None
    generated_pdf_path: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BidPageReorderRequest(BaseModel):
    """장표 순서 일괄 변경 요청 — page_ids 배열 순서가 곧 sort_order"""

    page_ids: list[int]


# ─── 입찰 배정 인력 (BidPersonnel) 스키마 ───


class BidPersonnelCreate(BaseModel):
    """인력 배정 요청"""

    personnel_id: int
    role_in_bid: str | None = None
    sort_order: int | None = None
    custom_data: str | None = None  # JSON 문자열
    selected_projects: str | None = None  # JSON 문자열


class BidPersonnelResponse(BaseModel):
    """인력 배정 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_id: int
    personnel_id: int
    role_in_bid: str | None = None
    sort_order: int | None = None
    custom_data: str | None = None
    selected_projects: str | None = None
    created_at: datetime | None = None
    # 인력 기본 정보 (조인)
    personnel_name: str | None = None
    personnel_title: str | None = None
    personnel_department: str | None = None


# ─── 입찰 스키마 ───


class BidCreate(BaseModel):
    """입찰 생성 요청"""

    bid_name: str
    client_name: str | None = None
    bid_number: str | None = None
    deadline: date | None = None
    requirements_text: str | None = None


class BidUpdate(BaseModel):
    """입찰 수정 요청"""

    bid_name: str | None = None
    client_name: str | None = None
    bid_number: str | None = None
    deadline: date | None = None
    status: str | None = None
    requirements_text: str | None = None


class BidSummary(BaseModel):
    """입찰 목록 조회 응답 (요약)"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_name: str
    client_name: str | None = None
    bid_number: str | None = None
    deadline: date | None = None
    status: str = "draft"
    page_count: int = 0
    personnel_count: int = 0
    created_at: datetime | None = None


class BidDetail(BaseModel):
    """입찰 상세 조회 응답 (pages, personnel 포함)"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_name: str
    client_name: str | None = None
    bid_number: str | None = None
    deadline: date | None = None
    status: str = "draft"
    notice_file_path: str | None = None
    requirements_text: str | None = None
    pages: list[BidPageResponse] = []
    personnel: list[BidPersonnelResponse] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BidListResponse(BaseModel):
    """입찰 목록 페이지네이션 응답"""

    items: list[BidSummary]
    total: int
    page: int
    size: int


# ─── 장표 라이브러리 스키마 ───


class PageLibraryCreate(BaseModel):
    """장표 라이브러리 생성 요청"""

    name: str
    category: str | None = None
    html_content: str
    css_content: str | None = None
    description: str | None = None


class PageLibrarySummary(BaseModel):
    """장표 라이브러리 목록 조회 응답 (html_content 제외)"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None = None
    description: str | None = None
    created_at: datetime | None = None


class PageLibraryResponse(BaseModel):
    """장표 라이브러리 상세 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str | None = None
    html_content: str
    css_content: str | None = None
    description: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ─── 인력 자동 채움 스키마 ───


class FillRequest(BaseModel):
    """인력 자동 채움 요청"""

    personnel_id: int
    save: bool = False  # true이면 채움 결과를 DB에 저장


class FillResponse(BaseModel):
    """인력 자동 채움 응답"""

    html_content: str
    filled_count: int  # 치환된 변수 수
    remaining: list[str]  # 치환되지 않은 변수 목록


# ─── 회사 정보 스키마 ───


class CompanyInfoUpdate(BaseModel):
    """회사 정보 수정 요청 (전체 또는 부분 업데이트)"""

    company_name: str | None = None
    business_number: str | None = None
    corporate_number: str | None = None
    representative: str | None = None
    representative_birth: str | None = None
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    website: str | None = None
    business_type: str | None = None
    business_category: str | None = None
    establishment_date: str | None = None
    capital: str | None = None
    employee_count: str | None = None


class CompanyInfoResponse(BaseModel):
    """회사 정보 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str | None = None
    business_number: str | None = None
    corporate_number: str | None = None
    representative: str | None = None
    representative_birth: str | None = None
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    website: str | None = None
    business_type: str | None = None
    business_category: str | None = None
    establishment_date: str | None = None
    capital: str | None = None
    employee_count: str | None = None
    updated_at: datetime | None = None


# ─── AI 서비스 스키마 ───


class AiPdfToHtmlResponse(BaseModel):
    """AI PDF→HTML 변환 응답"""

    html_content: str
    css_content: str | None = None
    detected_variables: list[str] = []
    message: str = ""


class AiModifyRequest(BaseModel):
    """AI HTML 수정 요청"""

    html_content: str
    css_content: str | None = None
    request: str


class AiModifyResponse(BaseModel):
    """AI HTML 수정 응답"""

    html_content: str
    css_content: str | None = None
    changes_description: str = ""
