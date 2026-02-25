"""인력 관련 Pydantic 스키마 (요청/응답 검증)"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


# ──────────────────────────────────────────────
# 자격증 (Certification) 스키마
# ──────────────────────────────────────────────


class CertificationCreate(BaseModel):
    """자격증 추가 요청 (multipart/form-data이므로 라우터에서 Form으로 받음)"""

    cert_name: str
    cert_number: str | None = None
    cert_date: date | None = None
    cert_issuer: str | None = None


class CertificationResponse(BaseModel):
    """자격증 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    cert_name: str
    cert_number: str | None = None
    cert_date: date | None = None
    cert_issuer: str | None = None
    cert_file_path: str | None = None
    has_file: bool = False
    created_at: datetime | None = None


# ──────────────────────────────────────────────
# 프로젝트 이력 (ProjectHistory) 스키마
# ──────────────────────────────────────────────


class ProjectHistoryCreate(BaseModel):
    """프로젝트 이력 추가 요청"""

    project_name: str
    client: str | None = None
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: str | None = None
    description: str | None = None


class ProjectHistoryUpdate(BaseModel):
    """프로젝트 이력 수정 요청 (부분 업데이트)"""

    project_name: str | None = None
    client: str | None = None
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: str | None = None
    description: str | None = None


class ProjectHistoryResponse(BaseModel):
    """프로젝트 이력 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_name: str
    client: str | None = None
    role: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: str | None = None
    description: str | None = None
    created_at: datetime | None = None


# ──────────────────────────────────────────────
# 인력 (Personnel) 스키마
# ──────────────────────────────────────────────


class PersonnelCreate(BaseModel):
    """인력 등록 요청"""

    name: str
    title: str | None = None
    department: str | None = None
    birth_date: date | None = None
    resident_number: str | None = None
    phone: str | None = None
    email: str | None = None
    education_level: str | None = None
    education_school: str | None = None
    education_major: str | None = None
    graduation_year: int | None = None
    hire_date: date | None = None
    years_of_experience: int | None = None
    notes: str | None = None


class PersonnelUpdate(BaseModel):
    """인력 수정 요청 (부분 업데이트)"""

    name: str | None = None
    title: str | None = None
    department: str | None = None
    birth_date: date | None = None
    resident_number: str | None = None
    phone: str | None = None
    email: str | None = None
    education_level: str | None = None
    education_school: str | None = None
    education_major: str | None = None
    graduation_year: int | None = None
    hire_date: date | None = None
    years_of_experience: int | None = None
    notes: str | None = None


class PersonnelSummary(BaseModel):
    """인력 목록 조회 응답 (요약)"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str | None = None
    department: str | None = None
    years_of_experience: int | None = None
    certification_count: int = 0
    project_count: int = 0


class PersonnelDetail(BaseModel):
    """인력 상세 조회 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str | None = None
    department: str | None = None
    birth_date: date | None = None
    resident_number: str | None = None
    phone: str | None = None
    email: str | None = None
    education_level: str | None = None
    education_school: str | None = None
    education_major: str | None = None
    graduation_year: int | None = None
    hire_date: date | None = None
    years_of_experience: int | None = None
    notes: str | None = None
    certifications: list[CertificationResponse] = []
    project_history: list[ProjectHistoryResponse] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PersonnelListResponse(BaseModel):
    """인력 목록 페이지네이션 응답"""

    items: list[PersonnelSummary]
    total: int
    page: int
    size: int
