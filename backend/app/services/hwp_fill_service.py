"""HWP 파일 직접 채움 서비스 — 한글 COM 자동화로 {{placeholder}} 치환 후 PDF 반환

워크플로우:
  1. HWP/HWPX 파일을 임시 디렉토리에 저장
  2. 한글 COM으로 파일 열기
  3. {{placeholder}} 찾아바꾸기 (회사/입찰/인력 정보)
  4. PDF로 저장 (한글 자체 PDF 출력 — 서식 100% 유지)
  5. PDF 바이트 반환 → 워크스페이스 장표로 추가
"""

import asyncio
import io
import logging
import os
import tempfile
from pathlib import Path

import pythoncom
from PyPDF2 import PdfReader, PdfWriter

from app.models.bid import BidPersonnel, CompanyInfo
from app.models.personnel import Personnel
from app.services.fill_service import (
    _build_simple_field_map,
    _safe_str,
    _format_date,
    CERT_FIELD_ATTRS,
    PROJECT_FIELD_ATTRS,
)

logger = logging.getLogger(__name__)


def _build_all_replacements(
    personnel: Personnel | None = None,
    bid_personnel: BidPersonnel | None = None,
    company_info: CompanyInfo | None = None,
    bid_name: str | None = None,
    bid_number: str | None = None,
    client_name: str | None = None,
) -> dict[str, str]:
    """모든 소스에서 {{key}} → value 치환 딕셔너리를 구성한다."""
    replacements: dict[str, str] = {}

    # 1) 회사 정보
    if company_info:
        company_fields = {
            "company_name": company_info.company_name,
            "business_number": company_info.business_number,
            "corporate_number": company_info.corporate_number,
            "representative": company_info.representative,
            "representative_birth": company_info.representative_birth,
            "address": company_info.address,
            "zip_code": company_info.zip_code,
            "phone": company_info.phone,
            "fax": company_info.fax,
            "email": company_info.email,
            "website": company_info.website,
            "business_type": company_info.business_type,
            "business_category": company_info.business_category,
            "establishment_date": company_info.establishment_date,
            "capital": company_info.capital,
            "employee_count": company_info.employee_count,
        }
        for key, value in company_fields.items():
            replacements[f"{{{{{key}}}}}"] = _safe_str(value)

    # 2) 입찰 정보
    if bid_name is not None:
        replacements["{{bid_name}}"] = _safe_str(bid_name)
    if bid_number is not None:
        replacements["{{bid_number}}"] = _safe_str(bid_number)
    if client_name is not None:
        replacements["{{client_name}}"] = _safe_str(client_name)

    # 3) 인력 정보
    if personnel:
        simple_map = _build_simple_field_map(personnel, bid_personnel)
        for key, value in simple_map.items():
            replacements[f"{{{{{key}}}}}"] = value

        # 자격증 (번호 붙은 패턴)
        certs = personnel.certifications or []
        for i, cert in enumerate(certs, start=1):
            for short_key, attr_name in CERT_FIELD_ATTRS.items():
                value = getattr(cert, attr_name, None)
                if attr_name == "cert_date":
                    replacements[f"{{{{cert_{i}_{short_key}}}}}"] = _format_date(value)
                else:
                    replacements[f"{{{{cert_{i}_{short_key}}}}}"] = _safe_str(value)

        # 프로젝트 이력 (번호 붙은 패턴)
        projects = personnel.project_history or []
        for i, proj in enumerate(projects, start=1):
            for short_key, attr_name in PROJECT_FIELD_ATTRS.items():
                value = getattr(proj, attr_name, None)
                if attr_name in ("start_date", "end_date"):
                    replacements[f"{{{{project_{i}_{short_key}}}}}"] = _format_date(value)
                else:
                    replacements[f"{{{{project_{i}_{short_key}}}}}"] = _safe_str(value)

    return replacements


def _kill_zombie_hwp():
    """이전에 남아있는 한글 프로세스를 종료한다 (COM 충돌 방지)."""
    import subprocess
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", "Hwp.exe"],
            capture_output=True, timeout=5,
        )
        logger.debug("좀비 한글 프로세스 정리 완료")
    except Exception:
        pass


def _hwp_to_pdf_sync(
    input_path: str,
    pdf_output_path: str,
) -> dict:
    """
    한글 COM으로 HWP 열기 → PDF 저장만 (치환 없음).
    직접 작성된 HWP를 그대로 PDF로 변환할 때 사용.
    """
    import win32com.client
    import time

    _kill_zombie_hwp()
    time.sleep(0.5)

    pythoncom.CoInitialize()
    hwp = None

    try:
        hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")

        try:
            hwp.XHwpWindows.Item(0).Visible = False
        except Exception:
            pass

        logger.info("HWP Open (직접변환): %s", input_path)
        open_result = hwp.Open(input_path, "", "forceopen:true")
        if not open_result:
            raise RuntimeError(f"한글이 파일을 열지 못했습니다 (result={open_result})")

        # PDF로 저장
        hwp.HAction.GetDefault("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
        hwp.HParameterSet.HFileOpenSave.filename = pdf_output_path
        hwp.HParameterSet.HFileOpenSave.Format = "PDF"
        pdf_result = hwp.HAction.Execute("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)

        if not pdf_result or not os.path.exists(pdf_output_path):
            logger.warning("FileSaveAsPdf 실패, FileSaveAs_S 시도")
            hwp.HAction.GetDefault("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
            hwp.HParameterSet.HFileOpenSave.filename = pdf_output_path
            hwp.HParameterSet.HFileOpenSave.Format = "PDF"
            hwp.HAction.Execute("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)

        if not os.path.exists(pdf_output_path):
            raise RuntimeError("PDF 파일이 생성되지 않았습니다")
        fsize = os.path.getsize(pdf_output_path)
        if fsize < 100:
            raise RuntimeError(f"PDF 파일이 너무 작습니다 ({fsize} bytes)")

        reader = PdfReader(pdf_output_path)
        total_pages = len(reader.pages)

        hwp.Clear(1)

    except Exception:
        logger.exception("HWP COM 자동화 오류 (직접변환)")
        raise
    finally:
        if hwp:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

    return {"total_pages": total_pages}


def _hwp_fill_and_pdf_sync(
    input_path: str,
    pdf_output_path: str,
    replacements: dict[str, str],
) -> dict:
    """
    한글 COM으로 HWP 열기 → 찾아바꾸기 → PDF 저장.
    반드시 별도 스레드에서 호출 (COM 초기화 필요).

    Returns: {"filled_count": int, "total_pages": int}
    """
    import win32com.client
    import time

    # 이전 좀비 한글 프로세스 정리
    _kill_zombie_hwp()
    time.sleep(0.5)

    pythoncom.CoInitialize()
    hwp = None
    filled_count = 0

    try:
        hwp = win32com.client.Dispatch("HWPFrame.HwpObject")
        hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")

        # 창 숨기기
        try:
            hwp.XHwpWindows.Item(0).Visible = False
        except Exception:
            logger.debug("XHwpWindows 숨기기 실패 (무시)")

        # 파일 열기
        logger.info("HWP Open 시도: %s (exists=%s, size=%d)",
                     input_path, os.path.exists(input_path),
                     os.path.getsize(input_path) if os.path.exists(input_path) else 0)
        # HWPX도 자동 인식하도록 포맷 파라미터 비움
        open_result = hwp.Open(input_path, "", "forceopen:true")
        logger.info("HWP Open 결과: %s", open_result)
        if not open_result:
            raise RuntimeError(f"한글이 파일을 열지 못했습니다 (result={open_result})")

        # 찾아바꾸기 실행
        for find_str, replace_str in replacements.items():
            if not replace_str:
                continue

            hwp.HAction.GetDefault("AllReplace", hwp.HParameterSet.HFindReplace.HSet)
            option = hwp.HParameterSet.HFindReplace
            option.MatchCase = 0
            option.AllWordForms = 0
            option.SeveralWords = 0
            option.UseWildCards = 0
            option.WholeWordOnly = 0
            option.AutoSpell = 0
            option.FindString = find_str
            option.ReplaceString = replace_str
            option.ReplaceMode = 1
            option.IgnoreMessage = 1
            option.HanjaFromHangul = 0
            option.FindJaso = 0
            option.FindRegExp = 0
            option.Direction = hwp.FindDir("AllDoc")

            result = hwp.HAction.Execute("AllReplace", hwp.HParameterSet.HFindReplace.HSet)
            if result:
                filled_count += 1
                logger.debug("치환: %s → %s", find_str, replace_str[:20])

        # PDF로 저장 (한글 자체 PDF 출력)
        hwp.HAction.GetDefault("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
        hwp.HParameterSet.HFileOpenSave.filename = pdf_output_path
        hwp.HParameterSet.HFileOpenSave.Format = "PDF"
        pdf_result = hwp.HAction.Execute("FileSaveAsPdf", hwp.HParameterSet.HFileOpenSave.HSet)
        logger.info("PDF 저장 결과: %s, 경로: %s", pdf_result, pdf_output_path)

        # FileSaveAsPdf 실패 시 FileSaveAs_S로 fallback
        if not pdf_result or not os.path.exists(pdf_output_path):
            logger.warning("FileSaveAsPdf 실패, FileSaveAs_S 시도")
            hwp.HAction.GetDefault("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
            hwp.HParameterSet.HFileOpenSave.filename = pdf_output_path
            hwp.HParameterSet.HFileOpenSave.Format = "PDF"
            pdf_result = hwp.HAction.Execute("FileSaveAs_S", hwp.HParameterSet.HFileOpenSave.HSet)
            logger.info("FileSaveAs_S PDF 결과: %s", pdf_result)

        # 저장 확인
        if not os.path.exists(pdf_output_path):
            raise RuntimeError("PDF 파일이 생성되지 않았습니다")
        fsize = os.path.getsize(pdf_output_path)
        logger.info("PDF 파일 크기: %d bytes", fsize)
        if fsize < 100:
            raise RuntimeError(f"PDF 파일이 너무 작습니다 ({fsize} bytes)")

        # 페이지 수 확인
        reader = PdfReader(pdf_output_path)
        total_pages = len(reader.pages)
        logger.info("PDF 페이지 수: %d", total_pages)

        # 문서 닫기
        hwp.Clear(1)

    except Exception:
        logger.exception("HWP COM 자동화 오류")
        raise
    finally:
        if hwp:
            try:
                hwp.Quit()
            except Exception:
                pass
        pythoncom.CoUninitialize()

    return {"filled_count": filled_count, "total_pages": total_pages}


async def fill_hwp_to_pdf(
    hwp_bytes: bytes,
    filename: str,
    personnel: Personnel | None = None,
    bid_personnel: BidPersonnel | None = None,
    company_info: CompanyInfo | None = None,
    bid_name: str | None = None,
    bid_number: str | None = None,
    client_name: str | None = None,
) -> dict:
    """
    HWP 바이트 → {{placeholder}} 치환 → PDF 바이트 반환.

    Returns:
        {
            "pdf_bytes": bytes,         # 전체 PDF
            "page_pdfs": list[bytes],   # 페이지별 분리된 PDF 바이트 리스트
            "filled_count": int,
            "total_pages": int,
            "replacements": dict,       # 실제 치환된 항목 (미리보기용)
        }
    """
    replacements = _build_all_replacements(
        personnel=personnel,
        bid_personnel=bid_personnel,
        company_info=company_info,
        bid_name=bid_name,
        bid_number=bid_number,
        client_name=client_name,
    )

    # 빈 값 제외한 실제 치환 대상
    active = {k: v for k, v in replacements.items() if v}
    logger.info("HWP→PDF 시작: %s, 치환 후보 %d개", filename, len(active))

    # 확장자 판별
    ext = Path(filename).suffix.lower()
    in_ext = ext if ext in (".hwp", ".hwpx") else ".hwp"

    # 임시 디렉토리에서 COM 처리 (ASCII 파일명 사용)
    # COM이 파일을 잠글 수 있으므로 ignore_cleanup_errors=True
    tmpdir_obj = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    tmpdir = tmpdir_obj.name
    try:
        input_path = os.path.join(tmpdir, f"input{in_ext}")
        pdf_path = os.path.join(tmpdir, "output.pdf")

        with open(input_path, "wb") as f:
            f.write(hwp_bytes)

        # COM 처리 (별도 스레드)
        result = await asyncio.to_thread(
            _hwp_fill_and_pdf_sync, input_path, pdf_path, active
        )

        # PDF 읽기
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
    finally:
        try:
            tmpdir_obj.cleanup()
        except Exception:
            pass  # COM이 파일 잠금 유지 시 무시

    # 페이지별 분리
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_pdfs: list[bytes] = []
    for page in reader.pages:
        writer = PdfWriter()
        writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        page_pdfs.append(buf.getvalue())

    logger.info(
        "HWP→PDF 완료: %s → %d페이지, %d건 치환",
        filename, result["total_pages"], result["filled_count"],
    )

    return {
        "pdf_bytes": pdf_bytes,
        "page_pdfs": page_pdfs,
        "filled_count": result["filled_count"],
        "total_pages": result["total_pages"],
        "replacements": active,
    }


async def direct_hwp_to_pdf(
    hwp_bytes: bytes,
    filename: str,
) -> dict:
    """
    HWP 바이트 → PDF 바이트 (치환 없음, 직접 작성된 파일 그대로 변환).

    Returns:
        {
            "pdf_bytes": bytes,
            "page_pdfs": list[bytes],
            "total_pages": int,
        }
    """
    ext = Path(filename).suffix.lower()
    in_ext = ext if ext in (".hwp", ".hwpx") else ".hwp"

    tmpdir_obj = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    tmpdir = tmpdir_obj.name
    try:
        input_path = os.path.join(tmpdir, f"input{in_ext}")
        pdf_path = os.path.join(tmpdir, "output.pdf")

        with open(input_path, "wb") as f:
            f.write(hwp_bytes)

        result = await asyncio.to_thread(_hwp_to_pdf_sync, input_path, pdf_path)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
    finally:
        try:
            tmpdir_obj.cleanup()
        except Exception:
            pass

    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_pdfs: list[bytes] = []
    for page in reader.pages:
        writer = PdfWriter()
        writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        page_pdfs.append(buf.getvalue())

    logger.info("HWP→PDF 직접변환 완료: %s → %d페이지", filename, result["total_pages"])

    return {
        "pdf_bytes": pdf_bytes,
        "page_pdfs": page_pdfs,
        "total_pages": result["total_pages"],
    }
