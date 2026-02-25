"""장표 라이브러리 CRUD API 라우터"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.bid import PageLibrary
from app.schemas.bid import PageLibraryCreate, PageLibraryResponse, PageLibrarySummary

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=list[PageLibrarySummary])
async def list_library(
    category: Optional[str] = Query(None, description="카테고리 필터"),
    db: Session = Depends(get_db),
):
    """장표 라이브러리 목록 조회.

    - category 파라미터로 특정 카테고리만 필터링 가능
    - html_content는 제외하여 목록 조회 성능 최적화
    """
    query = db.query(PageLibrary)

    if category:
        query = query.filter(PageLibrary.category == category)

    items = query.order_by(PageLibrary.created_at.desc()).all()

    return [PageLibrarySummary.model_validate(item) for item in items]


@router.post("/", response_model=PageLibraryResponse, status_code=201)
async def create_library_item(
    data: PageLibraryCreate,
    db: Session = Depends(get_db),
):
    """장표를 라이브러리에 저장.

    - HTML/CSS 코드를 이름, 카테고리와 함께 저장
    - 다른 입찰에서 재사용할 수 있도록 보관
    """
    if not data.html_content.strip():
        raise HTTPException(
            status_code=400, detail="HTML 내용이 비어있습니다."
        )

    item = PageLibrary(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info("장표 라이브러리 저장: id=%d, name=%s", item.id, item.name)

    return item


@router.get("/{item_id}", response_model=PageLibraryResponse)
async def get_library_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """장표 라이브러리에서 특정 장표 조회 (HTML/CSS 포함)."""
    item = db.query(PageLibrary).filter(PageLibrary.id == item_id).first()

    if not item:
        raise HTTPException(
            status_code=404, detail="장표를 찾을 수 없습니다."
        )

    return item


@router.delete("/{item_id}", status_code=204)
async def delete_library_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    """장표 라이브러리에서 항목 삭제."""
    item = db.query(PageLibrary).filter(PageLibrary.id == item_id).first()

    if not item:
        raise HTTPException(
            status_code=404, detail="장표를 찾을 수 없습니다."
        )

    db.delete(item)
    db.commit()

    logger.info("장표 라이브러리 삭제: id=%d", item_id)

    return None
