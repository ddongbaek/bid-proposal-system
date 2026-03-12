"""HWP 파일 처리 API 라우터 - HWP→PDF 변환, HWP→HTML 변환, 페이지 추출, PDF 오버레이"""

import io
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PyPDF2 import PdfReader, PdfWriter
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.bid import Bid, BidPage, CompanyInfo
from app.services.libreoffice_service import (
    convert_hwp_to_html,
    convert_hwp_to_pdf,
    extract_html_sections,
    extract_pages,
    get_pdf_page_count,
    parse_html_sections,
)
from app.services.pdf_service import _html_to_pdf_sync
from app.services.hwp_fill_service import fill_hwp_to_pdf, direct_hwp_to_pdf
from app.services.pdf_overlay_service import (
    analyze_pdf_fields,
    apply_overlay,
    auto_fill_fields,
    pdf_page_to_image,
)
from app.services.ai_service import pdf_to_html

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".hwp", ".hwpx", ".doc", ".docx"}


@router.post("/convert")
def convert_hwp(
    file: UploadFile = File(...),
    start_page: Optional[int] = Form(None),
    end_page: Optional[int] = Form(None),
):
    """HWP 파일을 PDF로 변환.

    - file: HWP/HWPX 파일 (필수)
    - start_page: 시작 페이지 (선택, 1부터 시작)
    - end_page: 끝 페이지 (선택, 포함)
    - 범위 미지정 시 전체 문서 변환
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    # 확장자 검사
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})",
        )

    # 파일 읽기
    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기가 제한을 초과합니다. (최대 {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB)",
        )

    logger.info("HWP→PDF 변환 요청: %s (%d bytes), 페이지: %s~%s",
                file.filename, len(content), start_page or "처음", end_page or "끝")

    # LibreOffice로 PDF 변환
    pdf_bytes = convert_hwp_to_pdf(content, file.filename)

    # 페이지 범위 추출 (지정된 경우)
    if start_page or end_page:
        total = get_pdf_page_count(pdf_bytes)
        pdf_bytes = extract_pages(pdf_bytes, start_page, end_page)
        extracted = get_pdf_page_count(pdf_bytes)
        logger.info("페이지 추출: 전체 %d → %d페이지 (%s~%s)",
                    total, extracted, start_page or 1, end_page or total)

    # PDF 바이트 반환
    output_name = file.filename.rsplit(".", 1)[0] + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{output_name}"',
            "X-Total-Pages": str(get_pdf_page_count(pdf_bytes)),
        },
    )


@router.post("/to-html")
def convert_to_html(
    file: UploadFile = File(...),
):
    """HWP 파일을 HTML로 변환 (양식 구조 유지).

    pyhwp를 이용해 표/양식 구조를 유지한 채 HTML로 변환.
    변환된 HTML은 편집기에서 수정 가능.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})",
        )

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기가 제한을 초과합니다. (최대 {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB)",
        )

    logger.info("HWP→HTML 변환 요청: %s (%d bytes)", file.filename, len(content))

    try:
        html_content = convert_hwp_to_html(content, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("HWP→HTML 변환 중 예외 발생: %s", file.filename)
        raise HTTPException(
            status_code=500,
            detail=f"HWP 변환 중 오류: {type(e).__name__}: {str(e)[:300]}",
        )

    # 섹션(서식/테이블) 목록 추출
    sections = parse_html_sections(html_content)
    section_list = [
        {"index": s["index"], "label": s["label"]}
        for s in sections
    ]

    return {
        "filename": file.filename,
        "html_content": html_content,
        "sections": section_list,
        "message": f"HTML 변환 완료 ({len(section_list)}개 서식 감지)",
    }


@router.post("/extract-sections")
def extract_sections_from_html(
    file: UploadFile = File(...),
    sections: str = Form(...),
):
    """HWP 변환 후 지정된 섹션만 추출.

    - file: HWP 파일
    - sections: 추출할 섹션 인덱스 (쉼표 구분, 예: "2,7,8")
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})",
        )

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # 섹션 인덱스 파싱
    try:
        indices = [int(s.strip()) for s in sections.split(",") if s.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="섹션 번호는 숫자(쉼표 구분)로 입력하세요.")

    if not indices:
        raise HTTPException(status_code=400, detail="추출할 섹션을 선택하세요.")

    logger.info("HWP 섹션 추출 요청: %s, 섹션: %s", file.filename, indices)

    html_content = convert_hwp_to_html(content, file.filename)
    extracted = extract_html_sections(html_content, indices)

    return {
        "filename": file.filename,
        "html_content": extracted,
        "selected_sections": indices,
        "message": f"{len(indices)}개 섹션 추출 완료",
    }


@router.post("/info")
def hwp_info(
    file: UploadFile = File(...),
):
    """HWP 파일을 PDF로 변환 후 페이지 수 등 정보를 반환.

    미리보기/페이지 범위 선택에 활용.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})",
        )

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # PDF로 변환하여 페이지 수 확인
    pdf_bytes = convert_hwp_to_pdf(content, file.filename)
    total_pages = get_pdf_page_count(pdf_bytes)

    return {
        "filename": file.filename,
        "total_pages": total_pages,
        "message": f"{total_pages}페이지 문서입니다.",
    }


@router.post("/to-pages")
def hwp_to_pages(
    file: UploadFile = File(...),
    bid_id: int = Form(...),
    db: Session = Depends(get_db),
):
    """HWP 파일을 서식별로 분리하여 입찰 장표로 추가.

    파이프라인:
      1) HWP → HTML (pyhwp)
      2) [ 서식 N ] 패턴 기준으로 서식별 HTML 분리
      3) 각 서식을 개별 BidPage(page_type="html")로 생성
      → 자동 채움({{placeholder}}) 가능!

    서식 패턴이 없으면 fallback으로 PDF 페이지 분리 사용.

    - file: HWP 파일 (필수)
    - bid_id: 입찰 ID (필수)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. ({', '.join(ALLOWED_EXTENSIONS)})",
        )

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기가 제한을 초과합니다. (최대 {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB)",
        )

    # 입찰 존재 확인
    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail=f"입찰 ID {bid_id}를 찾을 수 없습니다.")

    base_name = file.filename.rsplit(".", 1)[0]
    logger.info("HWP→서식 분리 요청: %s, bid_id=%d", file.filename, bid_id)

    # 1) HWP → HTML (pyhwp)
    try:
        html_content = convert_hwp_to_html(content, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("HWP→HTML 변환 실패: %s", file.filename)
        raise HTTPException(
            status_code=500,
            detail=f"HWP→HTML 변환 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    # 2) [ 서식 N ] 패턴으로 서식별 분리 시도
    sections = parse_html_sections(html_content)

    # 현재 sort_order 최댓값
    max_order = (
        db.query(func.max(BidPage.sort_order))
        .filter(BidPage.bid_id == bid_id)
        .scalar()
    )
    next_order = (max_order or 0) + 1
    created_pages = []

    if sections:
        # === 서식별 HTML 분리 (자동 채움 가능) ===
        logger.info("서식 %d개 감지, HTML 서식별 분리", len(sections))

        # head 부분 추출 (스타일 유지) + 정렬 보정 CSS 주입
        head_end = html_content.find("</head>")
        head_part = html_content[:head_end + len("</head>")] if head_end != -1 else ""

        # A4 레이아웃은 _FONT_NORMALIZE_CSS에서 이미 포함됨 (convert_hwp_to_html)

        for sec in sections:
            section_html = html_content[sec["start"]:sec["end"]].strip()
            # 앞쪽 고아 닫는 태그 제거
            import re
            section_html = re.sub(
                r"^(\s*</(?:td|tr|table|div|span|p)>\s*)+",
                "",
                section_html,
                flags=re.IGNORECASE,
            ).strip()

            if not section_html:
                continue

            # 완전한 HTML 문서로 감싸기 (CSS 포함)
            if head_part:
                full_html = f"{head_part}\n<body>\n{section_html}\n</body>\n</html>"
            else:
                full_html = f"<html><body>\n{section_html}\n</body></html>"

            page = BidPage(
                bid_id=bid_id,
                page_type="html",
                page_name=sec["label"],
                html_content=full_html,
                sort_order=next_order,
            )
            db.add(page)
            db.flush()

            created_pages.append({
                "id": page.id,
                "page_name": page.page_name,
                "page_number": sec["index"],
                "sort_order": next_order,
            })
            next_order += 1

        db.commit()
        logger.info("HWP→서식 분리 완료: bid_id=%d, %d개 서식", bid_id, len(created_pages))

        return {
            "pages": created_pages,
            "total_pages": len(created_pages),
            "message": f"{file.filename} → {len(created_pages)}개 서식으로 분리 완료 (HTML, 자동채움 가능)",
        }

    # === Fallback: 서식 패턴 없으면 PDF 페이지 분리 ===
    logger.info("서식 패턴 미감지 → PDF 페이지 분리 fallback")

    try:
        pdf_bytes = _html_to_pdf_sync(html_content)
    except Exception as e:
        logger.exception("HTML→PDF 변환 실패: %s", file.filename)
        raise HTTPException(
            status_code=500,
            detail=f"HTML→PDF 변환 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)

    if total_pages == 0:
        raise HTTPException(status_code=500, detail="변환된 PDF에 페이지가 없습니다.")

    upload_dir = Path(settings.UPLOAD_DIR) / "pages" / str(bid_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for page_idx in range(total_pages):
        writer = PdfWriter()
        writer.add_page(reader.pages[page_idx])
        output = io.BytesIO()
        writer.write(output)
        page_pdf_bytes = output.getvalue()

        page_num = page_idx + 1
        file_name = f"{next_order}_{base_name}_p{page_num}.pdf"
        file_path = upload_dir / file_name
        with open(file_path, "wb") as f:
            f.write(page_pdf_bytes)

        page = BidPage(
            bid_id=bid_id,
            page_type="pdf",
            page_name=f"{base_name} - {page_num}쪽",
            sort_order=next_order,
            pdf_file_path=str(file_path),
        )
        db.add(page)
        db.flush()

        created_pages.append({
            "id": page.id,
            "page_name": page.page_name,
            "page_number": page_num,
            "sort_order": next_order,
        })
        next_order += 1

    db.commit()
    logger.info("HWP→PDF 페이지 분리 완료: bid_id=%d, %d페이지", bid_id, len(created_pages))

    return {
        "pages": created_pages,
        "total_pages": total_pages,
        "message": f"{file.filename} → {total_pages}개 페이지로 분리 완료 (PDF, 서식 패턴 없음)",
    }


@router.post("/fill-to-pages")
async def fill_hwp_to_pages(
    file: UploadFile = File(...),
    bid_id: int = Form(...),
    personnel_id: Optional[int] = Form(None),
    mode: str = Form("fill"),
    db: Session = Depends(get_db),
):
    """HWP 파일을 PDF로 변환하여 워크스페이스 장표로 추가.

    mode:
      - "fill": {{placeholder}} 치환 후 PDF 변환 (기본값)
      - "direct": 치환 없이 그대로 PDF 변환 (직접 작성한 파일용)

    - file: HWP/HWPX 파일 (필수)
    - bid_id: 입찰 ID (필수)
    - personnel_id: 인력 ID (선택, mode=fill일 때만 사용)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in {".hwp", ".hwpx"}:
        raise HTTPException(status_code=400, detail="HWP/HWPX 파일만 지원합니다.")

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # 입찰 확인
    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail=f"입찰 ID {bid_id}를 찾을 수 없습니다.")

    logger.info("HWP→장표 추가: %s, bid_id=%d, personnel_id=%s, mode=%s",
                file.filename, bid_id, personnel_id, mode)

    if mode == "direct":
        # 바로 변환 (치환 없음)
        try:
            result = await direct_hwp_to_pdf(hwp_bytes=content, filename=file.filename)
            result["filled_count"] = 0
            result["replacements"] = {}
        except Exception as e:
            logger.exception("HWP→PDF 직접변환 실패: %s", file.filename)
            raise HTTPException(
                status_code=500,
                detail=f"HWP→PDF 변환 실패: {type(e).__name__}: {str(e)[:300]}",
            )
    else:
        # 치환 + PDF 변환
        from app.models.bid import CompanyInfo as CompanyInfoModel
        company_info = db.query(CompanyInfoModel).first()

        personnel = None
        bid_personnel = None
        if personnel_id:
            from app.models.personnel import Personnel as PersonnelModel
            personnel = db.query(PersonnelModel).filter(PersonnelModel.id == personnel_id).first()
            if not personnel:
                raise HTTPException(status_code=404, detail=f"인력 ID {personnel_id}를 찾을 수 없습니다.")
            from app.models.bid import BidPersonnel as BidPersonnelModel
            bid_personnel = (
                db.query(BidPersonnelModel)
                .filter(
                    BidPersonnelModel.bid_id == bid_id,
                    BidPersonnelModel.personnel_id == personnel_id,
                )
                .first()
            )

        try:
            result = await fill_hwp_to_pdf(
                hwp_bytes=content,
                filename=file.filename,
                personnel=personnel,
                bid_personnel=bid_personnel,
                company_info=company_info,
                bid_name=bid.bid_name,
                bid_number=bid.bid_number,
                client_name=bid.client_name,
            )
        except Exception as e:
            logger.exception("HWP→PDF 변환 실패: %s", file.filename)
            raise HTTPException(
                status_code=500,
                detail=f"HWP→PDF 변환 실패: {type(e).__name__}: {str(e)[:300]}",
            )

    # PDF 페이지별로 bid_pages에 추가
    base_name = Path(file.filename).stem
    max_order = (
        db.query(func.max(BidPage.sort_order))
        .filter(BidPage.bid_id == bid_id)
        .scalar()
    )
    next_order = (max_order or 0) + 1

    upload_dir = Path(settings.UPLOAD_DIR) / "pages" / str(bid_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    created_pages = []
    for idx, page_pdf in enumerate(result["page_pdfs"]):
        page_num = idx + 1
        file_name = f"{next_order}_{base_name}_p{page_num}.pdf"
        file_path = upload_dir / file_name

        with open(file_path, "wb") as f:
            f.write(page_pdf)

        page = BidPage(
            bid_id=bid_id,
            page_type="pdf",
            page_name=f"{base_name} - {page_num}쪽",
            sort_order=next_order,
            pdf_file_path=str(file_path),
        )
        db.add(page)
        db.flush()

        created_pages.append({
            "id": page.id,
            "page_name": page.page_name,
            "page_number": page_num,
            "sort_order": next_order,
        })
        next_order += 1

    db.commit()

    # 치환 내역 요약 (프론트 표시용)
    replacements_summary = {
        k: v for k, v in result["replacements"].items()
    }

    logger.info(
        "HWP→장표 추가 완료: bid_id=%d, %d페이지, %d건 치환",
        bid_id, len(created_pages), result["filled_count"],
    )

    return {
        "pages": created_pages,
        "total_pages": len(created_pages),
        "filled_count": result["filled_count"],
        "replacements": replacements_summary,
        "message": f"{file.filename} → {len(created_pages)}페이지 장표 추가 완료 ({result['filled_count']}건 치환)",
    }


# ──────────────────────────────────────────────
# HWP → AI HTML 변환 엔드포인트
# ──────────────────────────────────────────────


@router.post("/hwp-to-html-pages")
async def hwp_to_html_pages(
    file: UploadFile = File(...),
    bid_id: int = Form(...),
    db: Session = Depends(get_db),
):
    """HWP → COM PDF → Gemini AI → HTML 장표로 변환.

    파이프라인:
      1) HWP → COM으로 PDF 변환 (서식 100% 유지)
      2) PDF를 페이지별로 분리
      3) 각 페이지를 Gemini AI로 HTML 변환 ({{placeholder}} 자동 삽입)
      4) HTML BidPage로 저장 → PageEditor에서 편집 + fill_service 자동채움 가능

    - file: HWP/HWPX 파일 (필수)
    - bid_id: 입찰 ID (필수)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in {".hwp", ".hwpx"}:
        raise HTTPException(status_code=400, detail="HWP/HWPX 파일만 지원합니다.")

    content = file.file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise HTTPException(status_code=404, detail=f"입찰 ID {bid_id}를 찾을 수 없습니다.")

    base_name = Path(file.filename).stem
    logger.info("HWP→AI HTML 변환: %s, bid_id=%d", file.filename, bid_id)

    # 1) HWP → COM PDF 변환
    try:
        result = await direct_hwp_to_pdf(hwp_bytes=content, filename=file.filename)
    except Exception as e:
        logger.exception("HWP→PDF 변환 실패: %s", file.filename)
        raise HTTPException(
            status_code=500,
            detail=f"HWP→PDF 변환 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    # 2) PDF 페이지별 분리
    page_pdfs = result["page_pdfs"]
    total_pages = len(page_pdfs)
    if total_pages == 0:
        raise HTTPException(status_code=500, detail="변환된 PDF에 페이지가 없습니다.")

    logger.info("PDF %d페이지 → Gemini AI HTML 변환 시작", total_pages)

    # 현재 sort_order 최댓값
    max_order = (
        db.query(func.max(BidPage.sort_order))
        .filter(BidPage.bid_id == bid_id)
        .scalar()
    )
    next_order = (max_order or 0) + 1
    created_pages = []
    failed_pages = []

    # 3) 각 페이지를 Gemini AI로 HTML 변환
    for idx, page_pdf_bytes in enumerate(page_pdfs):
        page_num = idx + 1
        try:
            ai_result = await pdf_to_html(
                page_pdf_bytes,
                instructions="이 문서는 한국 공공입찰 제안서 양식입니다. 빈칸에 {{영문_변수명}}을 넣어주세요.",
            )
            html_content = ai_result["html_content"]
            detected_vars = ai_result.get("detected_variables", [])

            if not html_content or len(html_content) < 50:
                raise ValueError("AI가 충분한 HTML을 생성하지 못했습니다.")

            # 4) HTML BidPage로 저장
            page = BidPage(
                bid_id=bid_id,
                page_type="html",
                page_name=f"{base_name} - {page_num}쪽",
                html_content=html_content,
                sort_order=next_order,
            )
            db.add(page)
            db.flush()

            created_pages.append({
                "id": page.id,
                "page_name": page.page_name,
                "page_number": page_num,
                "sort_order": next_order,
                "detected_variables": detected_vars,
            })
            next_order += 1

            logger.info(
                "AI HTML 변환 완료: p%d, %d개 변수, HTML %d bytes",
                page_num, len(detected_vars), len(html_content),
            )

        except Exception as e:
            logger.error("AI HTML 변환 실패 (p%d): %s", page_num, str(e))
            failed_pages.append({"page_number": page_num, "error": str(e)[:200]})

            # 실패한 페이지는 PDF로 fallback 저장
            upload_dir = Path(settings.UPLOAD_DIR) / "pages" / str(bid_id)
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_name = f"{next_order}_{base_name}_p{page_num}.pdf"
            file_path = upload_dir / file_name
            with open(file_path, "wb") as f:
                f.write(page_pdf_bytes)

            page = BidPage(
                bid_id=bid_id,
                page_type="pdf",
                page_name=f"{base_name} - {page_num}쪽 (PDF)",
                sort_order=next_order,
                pdf_file_path=str(file_path),
            )
            db.add(page)
            db.flush()

            created_pages.append({
                "id": page.id,
                "page_name": page.page_name,
                "page_number": page_num,
                "sort_order": next_order,
                "detected_variables": [],
                "fallback_pdf": True,
            })
            next_order += 1

    db.commit()

    html_count = sum(1 for p in created_pages if not p.get("fallback_pdf"))
    pdf_fallback_count = len(failed_pages)

    msg_parts = [f"{file.filename} → {total_pages}페이지"]
    if html_count > 0:
        msg_parts.append(f"{html_count}개 HTML 변환 완료 (편집+자동채움 가능)")
    if pdf_fallback_count > 0:
        msg_parts.append(f"{pdf_fallback_count}개 PDF fallback")

    logger.info("HWP→AI HTML 완료: bid_id=%d, HTML=%d, PDF=%d", bid_id, html_count, pdf_fallback_count)

    return {
        "pages": created_pages,
        "total_pages": total_pages,
        "html_count": html_count,
        "pdf_fallback_count": pdf_fallback_count,
        "failed_pages": failed_pages,
        "message": " · ".join(msg_parts),
    }


@router.post("/convert-page-to-html/{page_id}")
async def convert_page_to_html(
    page_id: int,
    db: Session = Depends(get_db),
):
    """기존 PDF 장표 1개를 Gemini AI로 HTML 변환.

    PDF 장표를 HTML로 변환하여 PageEditor에서 편집 + 자동채움 가능하게 만듦.
    원본 PDF는 보존 (original_pdf_path).
    """
    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"장표 ID {page_id}를 찾을 수 없습니다.")

    if page.page_type != "pdf":
        raise HTTPException(status_code=400, detail="PDF 장표만 HTML로 변환할 수 있습니다.")

    pdf_path = page.pdf_file_path
    if not pdf_path or not Path(pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")

    logger.info("PDF→AI HTML 변환: page_id=%d, %s", page_id, pdf_path)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    try:
        ai_result = await pdf_to_html(
            pdf_bytes,
            instructions="이 문서는 한국 공공입찰 제안서 양식입니다. 빈칸에 {{영문_변수명}}을 넣어주세요.",
        )
        html_content = ai_result["html_content"]
        detected_vars = ai_result.get("detected_variables", [])

        if not html_content or len(html_content) < 50:
            raise ValueError("AI가 충분한 HTML을 생성하지 못했습니다.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI HTML 변환 실패 (page_id=%d): %s", page_id, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"AI HTML 변환 실패: {type(e).__name__}: {str(e)[:200]}",
        )

    # PDF → HTML로 타입 변경 (원본 PDF 보존)
    if not page.original_pdf_path:
        page.original_pdf_path = page.pdf_file_path
    page.page_type = "html"
    page.html_content = html_content
    # page_name에서 "(PDF)" 제거
    if page.page_name and page.page_name.endswith(" (PDF)"):
        page.page_name = page.page_name[:-6]
    db.commit()

    logger.info(
        "PDF→HTML 변환 완료: page_id=%d, %d개 변수, HTML %d bytes",
        page_id, len(detected_vars), len(html_content),
    )

    return {
        "page_id": page_id,
        "page_type": "html",
        "detected_variables": detected_vars,
        "message": f"HTML 변환 완료 ({len(detected_vars)}개 변수 감지, 편집+자동채움 가능)",
    }


# ──────────────────────────────────────────────
# PDF 오버레이 엔드포인트
# ──────────────────────────────────────────────


@router.post("/analyze-page/{page_id}")
def analyze_page_fields(
    page_id: int,
    db: Session = Depends(get_db),
):
    """기존 PDF 장표를 분석하여 오버레이 편집 가능한 필드를 감지.

    이미 워크스페이스에 추가된 PDF 장표를 클릭하면 호출됨.
    원본 PDF를 보존하고, 감지된 필드 좌표 + 자동채움 값을 반환.
    """
    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"장표 ID {page_id}를 찾을 수 없습니다.")

    pdf_path = page.pdf_file_path
    if not pdf_path or not Path(pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")

    # 이미 오버레이 필드가 있으면 그대로 반환
    if page.overlay_fields:
        fields = json.loads(page.overlay_fields)
        import fitz
        doc = fitz.open(pdf_path)
        pages_info = [
            {"page": i, "width": round(doc[i].rect.width, 1), "height": round(doc[i].rect.height, 1)}
            for i in range(len(doc))
        ]
        doc.close()
        return {
            "page_id": page_id,
            "fields": fields,
            "pages_info": pages_info,
            "total_pages": len(pages_info),
            "filled_count": sum(1 for f in fields if f.get("value")),
            "total_fields": len(fields),
        }

    logger.info("PDF 장표 분석: page_id=%d", page_id)

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    # PDF 분석 (테이블 감지)
    try:
        analysis = analyze_pdf_fields(pdf_bytes)
    except Exception as e:
        logger.exception("PDF 분석 실패: page_id=%d", page_id)
        raise HTTPException(
            status_code=500,
            detail=f"PDF 분석 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    # 자동 채움 (DB 데이터 매핑)
    all_fields = []
    for p in analysis["pages"]:
        all_fields.extend(p["fields"])

    company_info = db.query(CompanyInfo).first()
    bid = db.query(Bid).filter(Bid.id == page.bid_id).first()
    auto_fill_fields(all_fields, company_info=company_info, bid=bid)

    # 원본 PDF 경로 보존 + 필드 저장
    if not page.original_pdf_path:
        page.original_pdf_path = page.pdf_file_path
    page.overlay_fields = json.dumps(all_fields, ensure_ascii=False)
    db.commit()

    filled_count = sum(1 for f in all_fields if f.get("value"))
    total_fields = len(all_fields)

    logger.info(
        "PDF 분석 완료: page_id=%d, %d/%d 필드 채움",
        page_id, filled_count, total_fields,
    )

    return {
        "page_id": page_id,
        "fields": all_fields,
        "total_pages": analysis["total_pages"],
        "filled_count": filled_count,
        "total_fields": total_fields,
        "pages_info": [
            {"page": p["page"], "width": p["width"], "height": p["height"]}
            for p in analysis["pages"]
        ],
    }


@router.post("/apply-overlay/{page_id}")
def apply_overlay_to_page(
    page_id: int,
    fields: list[dict] = Body(...),
    db: Session = Depends(get_db),
):
    """오버레이 필드 값을 원본 PDF에 적용하여 최종 PDF 생성.

    프론트에서 편집한 필드 값을 받아서 원본 PDF에 텍스트를 스탬프.
    """
    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"장표 ID {page_id}를 찾을 수 없습니다.")

    original_path = page.original_pdf_path or page.pdf_file_path
    if not original_path or not Path(original_path).exists():
        raise HTTPException(status_code=404, detail="원본 PDF 파일을 찾을 수 없습니다.")

    with open(original_path, "rb") as f:
        original_pdf = f.read()

    # 오버레이 적용
    try:
        final_pdf = apply_overlay(original_pdf, fields)
    except Exception as e:
        logger.exception("오버레이 적용 실패: page_id=%d", page_id)
        raise HTTPException(
            status_code=500,
            detail=f"오버레이 적용 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    # 최종 PDF 저장 (원본과 다른 경로)
    upload_dir = Path(original_path).parent
    final_file = Path(original_path).stem.replace("_original", "") + "_filled.pdf"
    final_path = upload_dir / final_file
    with open(final_path, "wb") as f:
        f.write(final_pdf)

    # DB 업데이트
    page.pdf_file_path = str(final_path)
    page.overlay_fields = json.dumps(fields, ensure_ascii=False)
    db.commit()

    logger.info("오버레이 적용 완료: page_id=%d, %s", page_id, final_path)

    return {
        "page_id": page_id,
        "message": f"오버레이 적용 완료 ({sum(1 for f in fields if f.get('value'))}개 필드)",
    }


@router.get("/page-image/{page_id}/{page_num}")
def get_page_image(
    page_id: int,
    page_num: int,
    db: Session = Depends(get_db),
):
    """장표의 원본 PDF를 이미지로 반환 (오버레이 편집기 배경용).

    page_num: 0-based 페이지 번호
    """
    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"장표 ID {page_id}를 찾을 수 없습니다.")

    # 원본 PDF 사용 (오버레이 전)
    pdf_path = page.original_pdf_path or page.pdf_file_path
    if not pdf_path or not Path(pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF 파일을 찾을 수 없습니다.")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    try:
        img_bytes = pdf_page_to_image(pdf_bytes, page_num, dpi=150)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("이미지 변환 실패: page_id=%d, page_num=%d", page_id, page_num)
        raise HTTPException(
            status_code=500,
            detail=f"이미지 변환 실패: {type(e).__name__}: {str(e)[:300]}",
        )

    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/overlay-fields/{page_id}")
def get_overlay_fields(
    page_id: int,
    db: Session = Depends(get_db),
):
    """장표의 오버레이 필드 정보 조회 (재편집용)."""
    page = db.query(BidPage).filter(BidPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail=f"장표 ID {page_id}를 찾을 수 없습니다.")

    fields = []
    if page.overlay_fields:
        fields = json.loads(page.overlay_fields)

    # 원본 PDF 페이지 정보
    pdf_path = page.original_pdf_path or page.pdf_file_path
    pages_info = []
    if pdf_path and Path(pdf_path).exists():
        import fitz
        doc = fitz.open(pdf_path)
        for i in range(len(doc)):
            p = doc[i]
            pages_info.append({
                "page": i,
                "width": round(p.rect.width, 1),
                "height": round(p.rect.height, 1),
            })
        doc.close()

    return {
        "page_id": page_id,
        "fields": fields,
        "pages_info": pages_info,
        "total_pages": len(pages_info),
    }
