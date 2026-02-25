"""PDF 생성/병합/다운로드 API 라우터"""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.bid import Bid, BidPage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate/{page_id}")
async def generate_page_pdf(page_id: int, db: Session = Depends(get_db)):
    """개별 장표 PDF 생성 (HTML→PDF 변환)"""
    from app.services.pdf_service import html_to_pdf

    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")

    if page.page_type == "pdf":
        if not page.pdf_file_path or not os.path.exists(page.pdf_file_path):
            raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")
        pdf_bytes = Path(page.pdf_file_path).read_bytes()
    elif page.page_type == "html":
        if not page.html_content:
            raise HTTPException(status_code=400, detail="HTML 내용이 없습니다.")
        pdf_bytes = await html_to_pdf(page.html_content, page.css_content)
    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 page_type: {page.page_type}")

    # 생성된 PDF 경로 저장
    output_dir = Path(settings.GENERATED_DIR) / str(page.bid_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"page_{page_id}.pdf"
    output_path.write_bytes(pdf_bytes)
    page.generated_pdf_path = str(output_path)
    db.commit()

    logger.info("개별 PDF 생성: page_id=%d, size=%d", page_id, len(pdf_bytes))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="page_{page_id}.pdf"',
        },
    )


@router.post("/merge/{bid_id}")
async def merge_bid_pdf(bid_id: int, db: Session = Depends(get_db)):
    """입찰 전체 PDF 병합 (모든 장표를 순서대로 변환/병합)"""
    from app.services.pdf_service import generate_bid_pdf

    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail="입찰을 찾을 수 없습니다.")

    try:
        pdf_bytes = await generate_bid_pdf(bid_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 생성된 PDF를 파일로 저장
    output_dir = Path(settings.GENERATED_DIR) / str(bid_id)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "final_merged.pdf"
    output_path.write_bytes(pdf_bytes)
    logger.info("PDF 병합: bid_id=%d, size=%d", bid_id, len(pdf_bytes))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="bid_{bid_id}_merged.pdf"',
        },
    )


@router.get("/download/{bid_id}")
async def download_bid_pdf(bid_id: int, db: Session = Depends(get_db)):
    """입찰 최종 PDF 다운로드 (이미 생성된 파일 또는 즉시 생성)"""
    from app.services.pdf_service import generate_bid_pdf

    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail="입찰을 찾을 수 없습니다.")

    # 이미 생성된 파일이 있으면 반환
    output_path = Path(settings.GENERATED_DIR) / str(bid_id) / "final_merged.pdf"
    if output_path.exists():
        pdf_bytes = output_path.read_bytes()
    else:
        # 없으면 즉시 생성
        try:
            pdf_bytes = await generate_bid_pdf(bid_id, db)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(pdf_bytes)

    logger.info("PDF 다운로드: bid_id=%d, size=%d", bid_id, len(pdf_bytes))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="bid_{bid_id}_proposal.pdf"',
        },
    )
