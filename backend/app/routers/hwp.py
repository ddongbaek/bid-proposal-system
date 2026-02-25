"""HWP 파일 처리 API 라우터 - HWP→PDF 변환, HWP→HTML 변환, 페이지 추출"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.config import settings
from app.services.libreoffice_service import (
    convert_hwp_to_html,
    convert_hwp_to_pdf,
    extract_pages,
    get_pdf_page_count,
)

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".hwp", ".hwpx", ".doc", ".docx"}


@router.post("/convert")
async def convert_hwp(
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
    content = await file.read()
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
async def convert_to_html(
    file: UploadFile = File(...),
):
    """HWP 파일을 HTML로 변환 (양식 구조 유지).

    LibreOffice를 이용해 표/양식 구조를 유지한 채 HTML로 변환.
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

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"파일 크기가 제한을 초과합니다. (최대 {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB)",
        )

    logger.info("HWP→HTML 변환 요청: %s (%d bytes)", file.filename, len(content))

    html_content = convert_hwp_to_html(content, file.filename)

    return {
        "filename": file.filename,
        "html_content": html_content,
        "message": "HTML 변환 완료",
    }


@router.post("/info")
async def hwp_info(
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

    content = await file.read()
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
