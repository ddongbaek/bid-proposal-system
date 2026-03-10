"""입찰(Bid) CRUD API 라우터 — 입찰, 장표, 인력 배정 관리"""

import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.bid import Bid, BidPage, BidPersonnel, CompanyInfo
from app.models.personnel import Personnel
from app.schemas.bid import (
    BidCreate,
    BidDetail,
    BidListResponse,
    BidPageCreate,
    BidPageReorderRequest,
    BidPageResponse,
    BidPageUpdate,
    BidPersonnelCreate,
    BidPersonnelResponse,
    BidSummary,
    BidUpdate,
    FillRequest,
    FillResponse,
)
from app.services.fill_service import fill_bid_info, fill_company, fill_personnel, get_selected_project_ids

logger = logging.getLogger(__name__)

router = APIRouter()


# ──────────────────────────────────────────────
# 헬퍼 함수
# ──────────────────────────────────────────────


def _get_bid_or_404(db: Session, bid_id: int) -> Bid:
    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail="입찰을 찾을 수 없습니다.")
    return bid


def _bid_to_summary(bid: Bid) -> BidSummary:
    return BidSummary(
        id=bid.id,
        bid_name=bid.bid_name,
        client_name=bid.client_name,
        bid_number=bid.bid_number,
        deadline=bid.deadline,
        status=bid.status,
        page_count=len(bid.pages) if bid.pages else 0,
        personnel_count=len(bid.bid_personnel) if bid.bid_personnel else 0,
        created_at=bid.created_at,
    )


def _bid_personnel_to_response(bp: BidPersonnel) -> BidPersonnelResponse:
    return BidPersonnelResponse(
        id=bp.id,
        bid_id=bp.bid_id,
        personnel_id=bp.personnel_id,
        role_in_bid=bp.role_in_bid,
        sort_order=bp.sort_order,
        custom_data=bp.custom_data,
        selected_projects=bp.selected_projects,
        created_at=bp.created_at,
        personnel_name=bp.personnel.name if bp.personnel else None,
        personnel_title=bp.personnel.title if bp.personnel else None,
        personnel_department=bp.personnel.department if bp.personnel else None,
    )


def _bid_to_detail(bid: Bid) -> BidDetail:
    pages = [BidPageResponse.model_validate(p) for p in bid.pages] if bid.pages else []
    personnel = [_bid_personnel_to_response(bp) for bp in bid.bid_personnel] if bid.bid_personnel else []
    return BidDetail(
        id=bid.id,
        bid_name=bid.bid_name,
        client_name=bid.client_name,
        bid_number=bid.bid_number,
        deadline=bid.deadline,
        status=bid.status,
        notice_file_path=bid.notice_file_path,
        requirements_text=bid.requirements_text,
        pages=pages,
        personnel=personnel,
        created_at=bid.created_at,
        updated_at=bid.updated_at,
    )


# ──────────────────────────────────────────────
# 입찰 CRUD
# ──────────────────────────────────────────────


@router.get("/", response_model=BidListResponse)
async def list_bids(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="상태 필터 (draft/review/complete)"),
    search: Optional[str] = Query(None, description="입찰명 검색"),
    db: Session = Depends(get_db),
):
    """입찰 목록 조회 (페이지네이션, 상태 필터, 검색)"""
    query = db.query(Bid)

    if status:
        query = query.filter(Bid.status == status)
    if search:
        query = query.filter(Bid.bid_name.contains(search))

    total = query.count()
    items = query.order_by(Bid.created_at.desc()).offset((page - 1) * size).limit(size).all()

    summaries = [_bid_to_summary(bid) for bid in items]
    return BidListResponse(items=summaries, total=total, page=page, size=size)


@router.post("/", response_model=BidDetail, status_code=201)
async def create_bid(data: BidCreate, db: Session = Depends(get_db)):
    """입찰 생성"""
    bid = Bid(**data.model_dump())
    db.add(bid)
    db.commit()
    db.refresh(bid)
    logger.info("입찰 생성: id=%d, name=%s", bid.id, bid.bid_name)
    return _bid_to_detail(bid)


@router.get("/{bid_id}", response_model=BidDetail)
async def get_bid(bid_id: int, db: Session = Depends(get_db)):
    """입찰 상세 조회 (pages, personnel 포함)"""
    bid = _get_bid_or_404(db, bid_id)
    return _bid_to_detail(bid)


@router.put("/{bid_id}", response_model=BidDetail)
async def update_bid(bid_id: int, data: BidUpdate, db: Session = Depends(get_db)):
    """입찰 수정"""
    bid = _get_bid_or_404(db, bid_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(bid, key, value)
    db.commit()
    db.refresh(bid)
    logger.info("입찰 수정: id=%d", bid.id)
    return _bid_to_detail(bid)


@router.delete("/{bid_id}", status_code=204)
async def delete_bid(bid_id: int, db: Session = Depends(get_db)):
    """입찰 삭제 (cascade로 pages, personnel도 삭제)"""
    bid = _get_bid_or_404(db, bid_id)

    # 관련 파일 정리 (업로드된 PDF, 생성된 PDF, 썸네일)
    for page in bid.pages:
        if page.pdf_file_path and os.path.exists(page.pdf_file_path):
            os.remove(page.pdf_file_path)
        if page.generated_pdf_path and os.path.exists(page.generated_pdf_path):
            os.remove(page.generated_pdf_path)
        if page.thumbnail_path and os.path.exists(page.thumbnail_path):
            os.remove(page.thumbnail_path)

    db.delete(bid)
    db.commit()
    logger.info("입찰 삭제: id=%d", bid_id)
    return None


# ──────────────────────────────────────────────
# 장표 (BidPage) CRUD
# ──────────────────────────────────────────────


@router.post("/{bid_id}/pages/html", response_model=BidPageResponse, status_code=201)
async def add_html_page(bid_id: int, data: BidPageCreate, db: Session = Depends(get_db)):
    """HTML 장표 추가"""
    _get_bid_or_404(db, bid_id)

    if not data.html_content:
        raise HTTPException(status_code=400, detail="HTML 내용이 필요합니다.")

    # sort_order: 기존 장표의 마지막 순서 + 1
    max_order = (
        db.query(func.max(BidPage.sort_order))
        .filter(BidPage.bid_id == bid_id)
        .scalar()
    )
    next_order = (max_order or 0) + 1

    page = BidPage(
        bid_id=bid_id,
        page_type="html",
        page_name=data.page_name,
        sort_order=next_order,
        html_content=data.html_content,
        css_content=data.css_content,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    logger.info("HTML 장표 추가: bid_id=%d, page_id=%d", bid_id, page.id)
    return page


@router.post("/{bid_id}/pages/pdf", response_model=BidPageResponse, status_code=201)
async def upload_pdf_page(
    bid_id: int,
    page_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """PDF 파일을 업로드하여 장표로 추가"""
    _get_bid_or_404(db, bid_id)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기가 제한을 초과합니다. (최대 {settings.MAX_UPLOAD_SIZE // (1024*1024)}MB)",
        )

    # 파일 저장
    upload_dir = Path(settings.UPLOAD_DIR) / "pages" / str(bid_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    # sort_order 계산
    max_order = (
        db.query(func.max(BidPage.sort_order))
        .filter(BidPage.bid_id == bid_id)
        .scalar()
    )
    next_order = (max_order or 0) + 1

    file_path = upload_dir / f"{next_order}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(content)

    page = BidPage(
        bid_id=bid_id,
        page_type="pdf",
        page_name=page_name or file.filename,
        sort_order=next_order,
        pdf_file_path=str(file_path),
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    logger.info("PDF 장표 업로드: bid_id=%d, page_id=%d, file=%s", bid_id, page.id, file.filename)
    return page


# reorder는 {page_id} 경로보다 먼저 등록해야 라우팅 충돌 방지
@router.put("/{bid_id}/pages/reorder", response_model=list[BidPageResponse])
async def reorder_pages(
    bid_id: int, data: BidPageReorderRequest, db: Session = Depends(get_db)
):
    """장표 순서 일괄 변경 — page_ids 배열 순서가 곧 sort_order (1부터)"""
    _get_bid_or_404(db, bid_id)

    for sort_order, page_id in enumerate(data.page_ids, start=1):
        page = (
            db.query(BidPage)
            .filter(BidPage.id == page_id, BidPage.bid_id == bid_id)
            .first()
        )
        if not page:
            raise HTTPException(
                status_code=404,
                detail=f"장표 id={page_id}를 찾을 수 없습니다.",
            )
        page.sort_order = sort_order

    db.commit()

    # 변경된 순서대로 반환
    pages = (
        db.query(BidPage)
        .filter(BidPage.bid_id == bid_id)
        .order_by(BidPage.sort_order)
        .all()
    )
    logger.info("장표 순서 변경: bid_id=%d, %d개", bid_id, len(data.page_ids))
    return [BidPageResponse.model_validate(p) for p in pages]


@router.get("/{bid_id}/pages/{page_id}", response_model=BidPageResponse)
async def get_page(bid_id: int, page_id: int, db: Session = Depends(get_db)):
    """개별 장표 조회"""
    _get_bid_or_404(db, bid_id)
    page = (
        db.query(BidPage)
        .filter(BidPage.bid_id == bid_id, BidPage.id == page_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")
    return BidPageResponse.model_validate(page)


@router.get("/{bid_id}/pages/{page_id}/pdf-preview")
async def preview_page_pdf(bid_id: int, page_id: int, db: Session = Depends(get_db)):
    """PDF 장표의 원본 파일을 반환 (브라우저 내장 뷰어로 미리보기)"""
    _get_bid_or_404(db, bid_id)
    page = (
        db.query(BidPage)
        .filter(BidPage.bid_id == bid_id, BidPage.id == page_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")
    if page.page_type != "pdf" or not page.pdf_file_path:
        raise HTTPException(status_code=400, detail="PDF 파일이 없는 장표입니다.")

    pdf_path = Path(page.pdf_file_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")

    return Response(
        content=pdf_path.read_bytes(),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.put("/{bid_id}/pages/{page_id}", response_model=BidPageResponse)
async def update_page(
    bid_id: int, page_id: int, data: BidPageUpdate, db: Session = Depends(get_db)
):
    """장표 수정 (이름, HTML/CSS 내용, PDF 범위)"""
    _get_bid_or_404(db, bid_id)
    page = (
        db.query(BidPage)
        .filter(BidPage.id == page_id, BidPage.bid_id == bid_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(page, key, value)
    db.commit()
    db.refresh(page)
    logger.info("장표 수정: bid_id=%d, page_id=%d", bid_id, page_id)
    return page


@router.delete("/{bid_id}/pages/{page_id}", status_code=204)
async def delete_page(bid_id: int, page_id: int, db: Session = Depends(get_db)):
    """장표 삭제"""
    _get_bid_or_404(db, bid_id)
    page = (
        db.query(BidPage)
        .filter(BidPage.id == page_id, BidPage.bid_id == bid_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")

    # 관련 파일 삭제
    if page.pdf_file_path and os.path.exists(page.pdf_file_path):
        os.remove(page.pdf_file_path)
    if page.generated_pdf_path and os.path.exists(page.generated_pdf_path):
        os.remove(page.generated_pdf_path)
    if page.thumbnail_path and os.path.exists(page.thumbnail_path):
        os.remove(page.thumbnail_path)

    db.delete(page)
    db.commit()
    logger.info("장표 삭제: bid_id=%d, page_id=%d", bid_id, page_id)
    return None


# ──────────────────────────────────────────────
# 인력 자동 채움 (Fill Personnel Data)
# ──────────────────────────────────────────────


@router.post("/{bid_id}/pages/{page_id}/fill", response_model=FillResponse)
async def fill_page_personnel(
    bid_id: int,
    page_id: int,
    data: FillRequest,
    db: Session = Depends(get_db),
):
    """장표에 인력 데이터 자동 채움 — HTML {{placeholder}} 를 인력 DB 데이터로 치환"""
    bid = _get_bid_or_404(db, bid_id)

    # 장표 조회
    page = (
        db.query(BidPage)
        .filter(BidPage.id == page_id, BidPage.bid_id == bid_id)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="장표를 찾을 수 없습니다.")

    if page.page_type != "html":
        raise HTTPException(status_code=400, detail="HTML 장표만 자동 채움이 가능합니다.")

    if not page.html_content:
        raise HTTPException(status_code=400, detail="장표에 HTML 내용이 없습니다.")

    # 인력 조회 (자격증, 프로젝트 이력 포함 — selectin lazy loading)
    person = db.query(Personnel).filter(Personnel.id == data.personnel_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="인력을 찾을 수 없습니다.")

    # 해당 입찰에 배정된 인력인지 확인 (배정 정보가 있으면 role_in_bid 등 활용)
    bp = (
        db.query(BidPersonnel)
        .filter(
            BidPersonnel.bid_id == bid_id,
            BidPersonnel.personnel_id == data.personnel_id,
        )
        .first()
    )

    # selected_projects 파싱
    selected_project_ids = get_selected_project_ids(bp)

    # 자동 채움 실행 (인력 데이터)
    result = fill_personnel(
        html_content=page.html_content,
        personnel=person,
        bid_personnel=bp,
        selected_project_ids=selected_project_ids,
    )

    # 회사 정보 자동 채움 (인력 채움 결과에 이어서 적용)
    company_info = db.query(CompanyInfo).first()
    if company_info:
        company_result = fill_company(
            html_content=result["html_content"],
            company_info=company_info,
        )
        result["html_content"] = company_result["html_content"]
        result["filled_count"] += company_result["filled_count"]
        result["remaining"] = company_result["remaining"]

    # 입찰 정보 자동 채움 (공고번호, 공고명, 발주처)
    bid_result = fill_bid_info(
        html_content=result["html_content"],
        bid_name=bid.bid_name,
        bid_number=bid.bid_number,
        client_name=bid.client_name,
    )
    result["html_content"] = bid_result["html_content"]
    result["filled_count"] += bid_result["filled_count"]
    result["remaining"] = bid_result["remaining"]

    # save=true 이면 채움 결과를 DB에 저장
    if data.save:
        page.html_content = result["html_content"]
        db.commit()
        db.refresh(page)
        logger.info(
            "자동 채움 결과 저장: bid_id=%d, page_id=%d, personnel_id=%d",
            bid_id,
            page_id,
            data.personnel_id,
        )

    return FillResponse(
        html_content=result["html_content"],
        filled_count=result["filled_count"],
        remaining=result["remaining"],
    )


# ──────────────────────────────────────────────
# 인력 배정 (BidPersonnel) CRUD
# ──────────────────────────────────────────────


@router.post("/{bid_id}/personnel", response_model=BidPersonnelResponse, status_code=201)
async def assign_personnel(
    bid_id: int, data: BidPersonnelCreate, db: Session = Depends(get_db)
):
    """입찰에 인력 배정"""
    _get_bid_or_404(db, bid_id)

    # 인력 존재 확인
    person = db.query(Personnel).filter(Personnel.id == data.personnel_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="인력을 찾을 수 없습니다.")

    # 중복 배정 확인
    existing = (
        db.query(BidPersonnel)
        .filter(
            BidPersonnel.bid_id == bid_id,
            BidPersonnel.personnel_id == data.personnel_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="이미 배정된 인력입니다.")

    bp = BidPersonnel(
        bid_id=bid_id,
        personnel_id=data.personnel_id,
        role_in_bid=data.role_in_bid,
        sort_order=data.sort_order,
        custom_data=data.custom_data,
        selected_projects=data.selected_projects,
    )
    db.add(bp)
    db.commit()
    db.refresh(bp)
    logger.info(
        "인력 배정: bid_id=%d, personnel_id=%d, role=%s",
        bid_id,
        data.personnel_id,
        data.role_in_bid,
    )
    return _bid_personnel_to_response(bp)


@router.delete("/{bid_id}/personnel/{bp_id}", status_code=204)
async def remove_personnel(bid_id: int, bp_id: int, db: Session = Depends(get_db)):
    """입찰에서 인력 배정 해제"""
    _get_bid_or_404(db, bid_id)
    bp = (
        db.query(BidPersonnel)
        .filter(BidPersonnel.id == bp_id, BidPersonnel.bid_id == bid_id)
        .first()
    )
    if not bp:
        raise HTTPException(status_code=404, detail="배정된 인력을 찾을 수 없습니다.")

    db.delete(bp)
    db.commit()
    logger.info("인력 배정 해제: bid_id=%d, bp_id=%d", bid_id, bp_id)
    return None
