"""회사 기본정보 API 라우터 — 단일 행 CRUD (GET/PUT) + 이미지 업로드"""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
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


ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
IMAGE_FIELDS = {"seal_image", "certified_copy_image"}


@router.post("/images/{image_type}", response_model=CompanyInfoResponse)
async def upload_company_image(
    image_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """회사 이미지 업로드 (seal_image: 인감도장, certified_copy_image: 원본대조필)"""
    if image_type not in IMAGE_FIELDS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 이미지 유형: {image_type}")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="PNG, JPEG, GIF, WebP 이미지만 업로드 가능합니다.")

    # 저장 디렉터리
    upload_dir = Path(settings.DATA_DIR) / "uploads" / "company"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # 파일 저장
    ext = Path(file.filename or "image.png").suffix or ".png"
    filename = f"{image_type}{ext}"
    file_path = upload_dir / filename

    content = await file.read()
    file_path.write_bytes(content)

    # DB 업데이트
    info = _get_or_create_company_info(db)
    setattr(info, image_type, str(file_path))
    db.commit()
    db.refresh(info)

    logger.info("회사 이미지 업로드: %s → %s", image_type, file_path)
    return CompanyInfoResponse.model_validate(info)


@router.delete("/images/{image_type}", response_model=CompanyInfoResponse)
async def delete_company_image(
    image_type: str,
    db: Session = Depends(get_db),
):
    """회사 이미지 삭제"""
    if image_type not in IMAGE_FIELDS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 이미지 유형: {image_type}")

    info = _get_or_create_company_info(db)
    current_path = getattr(info, image_type, None)

    if current_path and os.path.exists(current_path):
        os.remove(current_path)

    setattr(info, image_type, None)
    db.commit()
    db.refresh(info)

    logger.info("회사 이미지 삭제: %s", image_type)
    return CompanyInfoResponse.model_validate(info)


@router.get("/images/{image_type}")
async def get_company_image(
    image_type: str,
    db: Session = Depends(get_db),
):
    """회사 이미지 다운로드"""
    if image_type not in IMAGE_FIELDS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 이미지 유형: {image_type}")

    info = _get_or_create_company_info(db)
    file_path = getattr(info, image_type, None)

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="이미지가 등록되지 않았습니다.")

    return FileResponse(file_path)
