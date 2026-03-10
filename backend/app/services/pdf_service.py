"""PDF 생성 및 병합 서비스

- HTML → PDF 변환 (Playwright Chromium, sync API + thread pool)
- 여러 PDF를 하나로 병합 (PyPDF2)
- 입찰 전체 PDF 생성 (장표 순서대로 변환/병합)

Note: Windows uvicorn의 이벤트 루프(SelectorEventLoop)가 subprocess 생성을 지원하지 않으므로
      Playwright sync_api를 asyncio.to_thread()로 별도 스레드에서 실행합니다.
"""

import asyncio
import io
import logging
import threading
from pathlib import Path

from PyPDF2 import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

# Playwright 브라우저 인스턴스 (sync, thread-local)
_lock = threading.Lock()
_browser = None
_playwright = None


def _get_browser_sync():
    """Playwright Chromium 브라우저를 lazy하게 초기화 (sync)"""
    global _browser, _playwright
    with _lock:
        if _browser is None or not _browser.is_connected():
            from playwright.sync_api import sync_playwright

            _playwright = sync_playwright().start()
            _browser = _playwright.chromium.launch(headless=True)
            logger.info("Playwright Chromium 브라우저 초기화 완료 (sync)")
    return _browser


def _html_to_pdf_sync(html_content: str, css_content: str | None = None) -> bytes:
    """HTML/CSS를 A4 PDF로 변환 (sync — 별도 스레드에서 호출)"""
    browser = _get_browser_sync()
    page = browser.new_page()

    try:
        full_html = _build_full_html(html_content, css_content)
        page.set_content(full_html, wait_until="networkidle")

        # 빈 TableControl 제거 (pyhwp 아티팩트 - nbsp 등 보이지 않는 문자 포함)
        page.evaluate(r"""() => {
            document.querySelectorAll('.TableControl').forEach(el => {
                if (!el.textContent.replace(/[\u00a0\s]/g, '')) el.remove();
            });
        }""")

        pdf_bytes = page.pdf(
            format="A4",
            margin={
                "top": "0mm",
                "right": "0mm",
                "bottom": "0mm",
                "left": "0mm",
            },
            print_background=True,
        )
        logger.info("HTML→PDF 변환 완료 (%d bytes)", len(pdf_bytes))
        return pdf_bytes
    finally:
        page.close()


async def html_to_pdf(html_content: str, css_content: str | None = None) -> bytes:
    """HTML/CSS를 A4 PDF로 변환 (async wrapper)

    Args:
        html_content: HTML 본문
        css_content: 추가 CSS (선택)

    Returns:
        PDF 바이트 데이터
    """
    return await asyncio.to_thread(_html_to_pdf_sync, html_content, css_content)


def _build_full_html(html_content: str, css_content: str | None = None) -> str:
    """HTML과 CSS를 합쳐 완전한 HTML 문서 생성"""
    css_block = f"<style>{css_content}</style>" if css_content else ""

    # html_content가 이미 완전한 HTML 문서인지 확인
    if "<html" in html_content.lower():
        # 이미 <html> 태그가 있으면 <head>에 CSS만 삽입
        if css_content:
            if "</head>" in html_content.lower():
                return html_content.replace("</head>", f"{css_block}</head>", 1)
            elif "<body" in html_content.lower():
                return html_content.replace("<body", f"<head>{css_block}</head><body", 1)
        return html_content

    # 부분 HTML이면 전체 문서로 감싸기
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {{ size: A4; margin: 0; }}
        body {{
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            margin: 0;
            padding: 0;
        }}
    </style>
    {css_block}
</head>
<body>
{html_content}
</body>
</html>"""


def merge_pdfs(pdf_list: list[bytes]) -> bytes:
    """여러 PDF 바이트를 하나의 PDF로 병합"""
    writer = PdfWriter()

    for i, pdf_bytes in enumerate(pdf_list):
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            writer.add_page(page)
        logger.debug("PDF #%d: %d 페이지 추가", i + 1, len(reader.pages))

    output = io.BytesIO()
    writer.write(output)
    result = output.getvalue()
    logger.info("PDF 병합 완료: %d개 → %d bytes", len(pdf_list), len(result))
    return result


async def generate_bid_pdf(bid_id: int, db) -> bytes:
    """입찰의 모든 장표를 순서대로 변환/병합하여 최종 PDF 생성"""
    from app.models.bid import Bid, BidPage

    bid = db.query(Bid).filter(Bid.id == bid_id).first()
    if not bid:
        raise ValueError(f"입찰 id={bid_id}를 찾을 수 없습니다.")

    pages = (
        db.query(BidPage)
        .filter(BidPage.bid_id == bid_id)
        .order_by(BidPage.sort_order)
        .all()
    )

    if not pages:
        raise ValueError("장표가 없습니다.")

    pdf_list: list[bytes] = []

    for page in pages:
        if page.page_type == "html":
            if not page.html_content:
                logger.warning("장표 id=%d: HTML 내용 없음, 건너뜀", page.id)
                continue
            pdf_bytes = await html_to_pdf(page.html_content, page.css_content)
            pdf_list.append(pdf_bytes)

        elif page.page_type == "pdf":
            if not page.pdf_file_path:
                logger.warning("장표 id=%d: PDF 파일 경로 없음, 건너뜀", page.id)
                continue

            pdf_path = Path(page.pdf_file_path)
            if not pdf_path.exists():
                logger.warning("장표 id=%d: PDF 파일 없음 (%s), 건너뜀", page.id, page.pdf_file_path)
                continue

            pdf_bytes = pdf_path.read_bytes()

            # 페이지 범위 지정이 있으면 해당 페이지만 추출
            if page.pdf_page_start is not None or page.pdf_page_end is not None:
                pdf_bytes = _extract_pdf_pages(
                    pdf_bytes, page.pdf_page_start, page.pdf_page_end
                )

            pdf_list.append(pdf_bytes)

    if not pdf_list:
        raise ValueError("변환 가능한 장표가 없습니다.")

    return merge_pdfs(pdf_list)


def _extract_pdf_pages(
    pdf_bytes: bytes,
    start: int | None = None,
    end: int | None = None,
) -> bytes:
    """PDF에서 특정 페이지 범위만 추출"""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()

    total = len(reader.pages)
    start_idx = (start - 1) if start else 0
    end_idx = end if end else total

    start_idx = max(0, min(start_idx, total - 1))
    end_idx = max(start_idx + 1, min(end_idx, total))

    for i in range(start_idx, end_idx):
        writer.add_page(reader.pages[i])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def cleanup_sync():
    """브라우저 종료 (sync)"""
    global _browser, _playwright
    with _lock:
        if _browser:
            _browser.close()
            _browser = None
        if _playwright:
            _playwright.stop()
            _playwright = None
    logger.info("Playwright 브라우저 정리 완료")


async def cleanup():
    """브라우저 종료 (앱 종료 시 호출)"""
    await asyncio.to_thread(cleanup_sync)
