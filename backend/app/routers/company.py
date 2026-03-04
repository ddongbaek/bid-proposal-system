"""회사 기본정보 API 라우터 — 단일 행 CRUD (GET/PUT)"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bid import CompanyInfo
from app.schemas.bid import CompanyInfoResponse, CompanyInfoUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_or_create_company_info(db: Session) -> CompanyInfo:
    """회사 정보 조회. 없으면 빈 행 생성 (항상 단일 행)."""
    info = db.query(CompanyInfo).first()
    if not info:
        info = CompanyInfo()
        db.add(info)
        db.commit()
        db.refresh(info)
        logger.info("회사 정보 기본 행 생성: id=%d", info.id)
    return info


@router.get("/", response_model=CompanyInfoResponse)
async def get_company_info(db: Session = Depends(get_db)):
    """회사 기본정보 조회 (없으면 빈 행 자동 생성)"""
    info = _get_or_create_company_info(db)
    return CompanyInfoResponse.model_validate(info)


@router.put("/", response_model=CompanyInfoResponse)
async def update_company_info(
    data: CompanyInfoUpdate, db: Session = Depends(get_db)
):
    """회사 기본정보 수정 (upsert — 없으면 생성 후 업데이트)"""
    info = _get_or_create_company_info(db)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(info, key, value)

    db.commit()
    db.refresh(info)
    logger.info("회사 정보 수정: id=%d, 변경 필드=%s", info.id, list(update_data.keys()))
    return CompanyInfoResponse.model_validate(info)
