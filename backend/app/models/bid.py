"""입찰 관련 SQLAlchemy 모델 (Bid, BidPage, BidPersonnel, PageLibrary)"""

from datetime import date, datetime

from sqlalchemy import (
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Bid(Base):
    """입찰 프로젝트 테이블"""

    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bid_name: Mapped[str] = mapped_column(String, nullable=False)
    client_name: Mapped[str | None] = mapped_column(String, nullable=True)
    bid_number: Mapped[str | None] = mapped_column(String, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft", server_default="draft")
    notice_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    requirements_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    pages: Mapped[list["BidPage"]] = relationship(
        "BidPage",
        back_populates="bid",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="BidPage.sort_order",
    )
    bid_personnel: Mapped[list["BidPersonnel"]] = relationship(
        "BidPersonnel",
        back_populates="bid",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_bids_status", "status"),
        Index("idx_bids_deadline", "deadline"),
    )


class BidPage(Base):
    """입찰 장표 테이블"""

    __tablename__ = "bid_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bid_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bids.id", ondelete="CASCADE"),
        nullable=False,
    )
    page_type: Mapped[str] = mapped_column(String, nullable=False)  # 'html' or 'pdf'
    page_name: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    html_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    css_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    pdf_page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pdf_page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_pdf_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    bid: Mapped["Bid"] = relationship("Bid", back_populates="pages")

    __table_args__ = (
        Index("idx_pages_bid_order", "bid_id", "sort_order"),
    )


class BidPersonnel(Base):
    """입찰 배정 인력 테이블"""

    __tablename__ = "bid_personnel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bid_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bids.id", ondelete="CASCADE"),
        nullable=False,
    )
    personnel_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("personnel.id"),  # CASCADE 아님 - 인력 삭제 시 배정 유지
        nullable=False,
    )
    role_in_bid: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    custom_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    selected_projects: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )

    # Relationships
    bid: Mapped["Bid"] = relationship("Bid", back_populates="bid_personnel")
    personnel: Mapped["Personnel"] = relationship("Personnel", lazy="selectin")

    __table_args__ = (
        Index("idx_bid_personnel_bid", "bid_id"),
        UniqueConstraint("bid_id", "personnel_id", name="idx_bid_personnel_unique"),
    )


class PageLibrary(Base):
    """장표 라이브러리 테이블"""

    __tablename__ = "page_library"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    css_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        Index("idx_library_category", "category"),
    )


class CompanyInfo(Base):
    """회사 기본정보 (단일 행)"""

    __tablename__ = "company_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_name: Mapped[str | None] = mapped_column(String, nullable=True)  # 회사명/상호
    business_number: Mapped[str | None] = mapped_column(String, nullable=True)  # 사업자등록번호
    corporate_number: Mapped[str | None] = mapped_column(String, nullable=True)  # 법인등록번호
    representative: Mapped[str | None] = mapped_column(String, nullable=True)  # 대표자
    representative_birth: Mapped[str | None] = mapped_column(String, nullable=True)  # 대표자 생년월일
    address: Mapped[str | None] = mapped_column(String, nullable=True)  # 주소
    zip_code: Mapped[str | None] = mapped_column(String, nullable=True)  # 우편번호
    phone: Mapped[str | None] = mapped_column(String, nullable=True)  # 전화번호
    fax: Mapped[str | None] = mapped_column(String, nullable=True)  # 팩스
    email: Mapped[str | None] = mapped_column(String, nullable=True)  # 이메일
    website: Mapped[str | None] = mapped_column(String, nullable=True)  # 홈페이지
    business_type: Mapped[str | None] = mapped_column(String, nullable=True)  # 업종
    business_category: Mapped[str | None] = mapped_column(String, nullable=True)  # 업태
    establishment_date: Mapped[str | None] = mapped_column(String, nullable=True)  # 설립일
    capital: Mapped[str | None] = mapped_column(String, nullable=True)  # 자본금
    employee_count: Mapped[str | None] = mapped_column(String, nullable=True)  # 상시근로자수
    seal_image: Mapped[str | None] = mapped_column(String, nullable=True)  # 인감도장 이미지 경로
    certified_copy_image: Mapped[str | None] = mapped_column(String, nullable=True)  # 원본대조필 이미지 경로
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), onupdate=func.now()
    )
