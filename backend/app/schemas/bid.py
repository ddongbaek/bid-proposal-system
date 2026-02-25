"""입찰 관련 Pydantic 스키마 (Phase 1 기본 정의, Phase 2에서 AI/Library 확장)"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


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
    """입찰 상세 조회 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    bid_name: str
    client_name: str | None = None
    bid_number: str | None = None
    deadline: date | None = None
    status: str = "draft"
    notice_file_path: str | None = None
    requirements_text: str | None = None
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
