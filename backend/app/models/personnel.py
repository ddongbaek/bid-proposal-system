"""인력 관련 SQLAlchemy 모델 (Personnel, Certification, ProjectHistory)"""

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Personnel(Base):
    """인력 기본정보 테이블"""

    __tablename__ = "personnel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    department: Mapped[str | None] = mapped_column(String, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    resident_number: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    education_level: Mapped[str | None] = mapped_column(String, nullable=True)
    education_school: Mapped[str | None] = mapped_column(String, nullable=True)
    education_major: Mapped[str | None] = mapped_column(String, nullable=True)
    graduation_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    years_of_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    certifications: Mapped[list["Certification"]] = relationship(
        "Certification",
        back_populates="personnel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    project_history: Mapped[list["ProjectHistory"]] = relationship(
        "ProjectHistory",
        back_populates="personnel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_personnel_name", "name"),
        Index("idx_personnel_department", "department"),
    )


class Certification(Base):
    """자격증 테이블"""

    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("personnel.id", ondelete="CASCADE"),
        nullable=False,
    )
    cert_name: Mapped[str] = mapped_column(String, nullable=False)
    cert_number: Mapped[str | None] = mapped_column(String, nullable=True)
    cert_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cert_issuer: Mapped[str | None] = mapped_column(String, nullable=True)
    cert_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )

    # Relationship
    personnel: Mapped["Personnel"] = relationship(
        "Personnel", back_populates="certifications"
    )

    __table_args__ = (
        Index("idx_cert_personnel", "personnel_id"),
    )


class ProjectHistory(Base):
    """프로젝트 이력 테이블"""

    __tablename__ = "project_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    personnel_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("personnel.id", ondelete="CASCADE"),
        nullable=False,
    )
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    client: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(), server_default=func.now()
    )

    # Relationship
    personnel: Mapped["Personnel"] = relationship(
        "Personnel", back_populates="project_history"
    )

    __table_args__ = (
        Index("idx_project_personnel", "personnel_id"),
    )
