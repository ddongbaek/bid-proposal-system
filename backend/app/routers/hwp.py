"""HWP 파일 처리 API 라우터 - HWP→PDF 변환, HWP→HTML 변환, 페이지 추출, 페이지 분리"""

import io
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PyPDF2 import PdfReader, PdfWriter
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.bid import Bid, BidPage
from app.services.libreoffice_service import (
    convert_hwp_to_html,
    convert_hwp_to_pdf,
    extract_html_sections,
    extract_pages,
    get_pdf_page_count,
    parse_html_sections,
)
from app.services.pdf_service import _html_to_pdf_sync

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
