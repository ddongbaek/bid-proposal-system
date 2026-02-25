"""AI 서비스 API 라우터 - PDF→HTML 변환, HTML 자연어 수정"""

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.schemas.bid import AiModifyRequest, AiModifyResponse, AiPdfToHtmlResponse
from app.services.ai_service import modify_html, pdf_to_html

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/pdf-to-html", response_model=AiPdfToHtmlResponse)
async def api_pdf_to_html(
    file: UploadFile = File(...),
    instructions: Optional[str] = Form(None),
):
    """PDF 파일을 업로드하면 AI가 HTML/CSS로 변환.

    - PDF를 Gemini에 전달하여 HTML 양식으로 변환
    - 빈칸은 {{변수명}} 형태로 표시
    - instructions로 추가 지시사항 전달 가능
    """
    # 파일 유효성 검사
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 제공되지 않았습니다.")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400, detail="PDF 파일만 업로드할 수 있습니다."
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

    logger.info(
        "PDF→HTML 변환 요청: %s (%d bytes)", file.filename, len(content)
    )

    result = await pdf_to_html(content, instructions or "")

    return AiPdfToHtmlResponse(**result)


@router.post("/modify", response_model=AiModifyResponse)
async def api_modify_html(data: AiModifyRequest):
    """기존 HTML/CSS를 자연어 요청으로 수정.

    - 현재 HTML/CSS 코드와 수정 요청을 전달
    - AI가 요청에 맞게 수정된 HTML/CSS를 반환
    """
    if not data.html_content.strip():
        raise HTTPException(
            status_code=400, detail="HTML 내용이 비어있습니다."
        )

    if not data.request.strip():
        raise HTTPException(
            status_code=400, detail="수정 요청이 비어있습니다."
        )

    logger.info("HTML 수정 요청: %s", data.request[:100])

    result = await modify_html(data.html_content, data.css_content, data.request)

    return AiModifyResponse(**result)
