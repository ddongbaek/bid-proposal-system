"""LibreOffice 연동 서비스 - HWP→PDF 변환, HWP→HTML 변환, 페이지 추출"""

import io
import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import HTTPException
from PyPDF2 import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

# LibreOffice 실행 경로 (Windows)
SOFFICE_PATHS = [
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
]

# LibreOffice 내장 Python과 충돌하는 환경변수 목록
_PYTHON_ENV_KEYS = [
    "PYTHONHOME", "PYTHONPATH", "PYTHONSTARTUP",
    "PYTHONIOENCODING", "PYTHONUTF8", "PYTHON_BASIC_REPL",
]


def _clean_env() -> dict[str, str]:
    """LibreOffice 실행을 위해 Python 관련 환경변수를 제거한 env를 반환."""
    env = os.environ.copy()
    for key in _PYTHON_ENV_KEYS:
        env.pop(key, None)
    return env


def _find_soffice() -> str:
    """LibreOffice 실행 파일 경로를 찾는다."""
    # shutil.which로 PATH에서 먼저 검색
    found = shutil.which("soffice")
    if found:
        return found

    # 일반적인 설치 경로에서 검색
    for path in SOFFICE_PATHS:
        if Path(path).exists():
            return path

    raise HTTPException(
        status_code=503,
        detail="LibreOffice가 설치되지 않았습니다. 설치 후 다시 시도하세요.",
    )


def convert_hwp_to_pdf(hwp_content: bytes, filename: str) -> bytes:
    """HWP 파일을 PDF로 변환.

    Args:
        hwp_content: HWP 파일 바이트
        filename: 원본 파일명 (확장자 판별용)

    Returns:
        변환된 PDF 바이트
    """
    soffice = _find_soffice()

    with tempfile.TemporaryDirectory() as tmpdir:
        # HWP 파일 저장 (한글 파일명 문제 방지를 위해 확장자만 유지)
        ext = Path(filename).suffix
        input_path = Path(tmpdir) / f"input{ext}"
        input_path.write_bytes(hwp_content)

        # LibreOffice로 PDF 변환
        cmd = [
            soffice,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", tmpdir,
            str(input_path),
        ]

        logger.info("LibreOffice PDF 변환 시작: %s", filename)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                env=_clean_env(),
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=504,
                detail="변환 시간이 초과되었습니다. (120초)",
            )

        if result.returncode != 0:
            logger.error("LibreOffice 에러: %s", result.stderr)
            raise HTTPException(
                status_code=500,
                detail=f"변환 실패: {result.stderr[:200]}",
            )

        # 변환된 PDF 파일 찾기
        pdf_name = input_path.stem + ".pdf"
        pdf_path = Path(tmpdir) / pdf_name

        if not pdf_path.exists():
            # 다른 이름으로 생성됐을 수 있음
            pdf_files = list(Path(tmpdir).glob("*.pdf"))
            if not pdf_files:
                raise HTTPException(
                    status_code=500,
                    detail="PDF 파일이 생성되지 않았습니다.",
                )
            pdf_path = pdf_files[0]

        logger.info("변환 완료: %s → %s", filename, pdf_path.name)
        return pdf_path.read_bytes()


def extract_pages(pdf_content: bytes, start_page: int | None, end_page: int | None) -> bytes:
    """PDF에서 특정 페이지 범위를 추출.

    Args:
        pdf_content: PDF 바이트
        start_page: 시작 페이지 (1부터, None이면 처음부터)
        end_page: 끝 페이지 (포함, None이면 끝까지)

    Returns:
        추출된 PDF 바이트
    """
    reader = PdfReader(io.BytesIO(pdf_content))
    total_pages = len(reader.pages)

    # 범위 정규화 (1-based → 0-based)
    start_idx = (start_page - 1) if start_page and start_page >= 1 else 0
    end_idx = min(end_page, total_pages) if end_page else total_pages

    if start_idx >= total_pages:
        raise HTTPException(
            status_code=400,
            detail=f"시작 페이지({start_page})가 전체 페이지 수({total_pages})를 초과합니다.",
        )

    if start_idx >= end_idx:
        raise HTTPException(
            status_code=400,
            detail=f"페이지 범위가 올바르지 않습니다. (시작: {start_page}, 끝: {end_page})",
        )

    writer = PdfWriter()
    for i in range(start_idx, end_idx):
        writer.add_page(reader.pages[i])

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def get_pdf_page_count(pdf_content: bytes) -> int:
    """PDF 총 페이지 수를 반환."""
    reader = PdfReader(io.BytesIO(pdf_content))
    return len(reader.pages)


def convert_hwp_to_html(hwp_content: bytes, filename: str) -> str:
    """HWP 파일을 HTML로 변환 (pyhwp 라이브러리 사용).

    pyhwp의 hwp5html을 이용하여 표/양식 구조를 유지한 HTML을 생성.
    HWP5 형식(.hwp)만 지원. HWPX는 미지원.

    Args:
        hwp_content: HWP 파일 바이트
        filename: 원본 파일명

    Returns:
        변환된 HTML 문자열
    """
    ext = Path(filename).suffix.lower()
    if ext not in (".hwp",):
        raise HTTPException(
            status_code=400,
            detail="HTML 변환은 .hwp 파일만 지원합니다. (.hwpx는 미지원)",
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / f"input{ext}"
        input_path.write_bytes(hwp_content)

        output_path = Path(tmpdir) / "output.html"
        css_path = Path(tmpdir) / "styles.css"

        logger.info("pyhwp HWP→HTML 변환 시작: %s", filename)

        # 1) HTML 생성
        try:
            r1 = subprocess.run(
                ["hwp5html", "--html", "--output", str(output_path), str(input_path)],
                capture_output=True,
                text=True,
                timeout=60,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="변환 시간이 초과되었습니다.")

        if r1.returncode != 0:
            logger.error("hwp5html 에러: %s", r1.stderr)
            raise HTTPException(
                status_code=500,
                detail=f"HTML 변환 실패: {r1.stderr[:200]}",
            )

        if not output_path.exists():
            raise HTTPException(status_code=500, detail="HTML 파일이 생성되지 않았습니다.")

        # 2) CSS 별도 생성
        try:
            r2 = subprocess.run(
                ["hwp5html", "--css", str(input_path)],
                capture_output=True,
                timeout=60,
            )
            if r2.returncode == 0 and r2.stdout:
                css_path.write_bytes(r2.stdout)
        except subprocess.TimeoutExpired:
            pass  # CSS 실패는 치명적이지 않음

        # 3) CSS를 HTML에 인라인 병합
        html_text = output_path.read_text(encoding="utf-8")

        if css_path.exists():
            css_text = css_path.read_text(encoding="utf-8")
            html_text = html_text.replace(
                '<link rel="stylesheet" href="styles.css" type="text/css" />',
                f"<style type=\"text/css\">\n{css_text}\n</style>",
            )

        # 4) 폰트 정규화 + 레이아웃 보정 CSS 삽입
        html_text = _inject_normalize_css(html_text)

        logger.info("HTML 변환 완료: %s (%d bytes)", filename, len(html_text))
        return html_text


# HWP 폰트 → 웹 안전 폰트 매핑 + 레이아웃 보정
_FONT_NORMALIZE_CSS = """
<style type="text/css">
/* === 폰트 정규화: HWP 폰트를 웹 안전 폰트로 매핑 === */
@import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&family=Nanum+Myeongjo:wght@400;700&display=swap');

/* 명조 계열 fallback */
@font-face { font-family: "함초롬바탕"; src: local("함초롬바탕"), local("HCR Batang"); }
@font-face { font-family: "한컴바탕"; src: local("한컴바탕"), local("HANBatang"), local("HAN Batang"); }
@font-face { font-family: "한양신명조"; src: local("한양신명조"), local("HY신명조"); }
@font-face { font-family: "HY신명조"; src: local("HY신명조"); }
@font-face { font-family: "휴먼명조"; src: local("휴먼명조"); }

/* 고딕 계열 fallback */
@font-face { font-family: "함초롬돋움"; src: local("함초롬돋움"), local("HCR Dotum"); }
@font-face { font-family: "한컴돋움"; src: local("한컴돋움"), local("HANDotum"), local("HAN Dotum"); }
@font-face { font-family: "나눔고딕"; src: local("나눔고딕"), local("NanumGothic"); }
@font-face { font-family: "HY헤드라인M"; src: local("HY헤드라인M"), local("HYHeadLine"); }
@font-face { font-family: "HY울릉도M"; src: local("HY울릉도M"); }

/* 전역 폰트 fallback (원본 폰트 없을 때만 적용) + 배경 흰색 강제 */
html, body {
  font-family: "맑은 고딕", "Malgun Gothic", "Nanum Gothic", "나눔고딕",
               "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  background-color: #fff !important;
}

/* TableControl: 테이블 래퍼 div (원본 <p><span> → <div>로 변환됨) */
.TableControl {
  max-width: 100%;
}

/* 테이블 셀 정렬 보정 */
table {
  border-collapse: collapse;
}
td {
  vertical-align: middle;
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* 인쇄용 A4 레이아웃 */
.Paper {
  background-color: #fff;
  margin: 0 auto;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

@media print {
  body { background: none; padding: 0; margin: 0; }
  .Paper { box-shadow: none; border: none; margin: 0; }
}
</style>
"""


def _fix_table_control_structure(html: str) -> str:
    """pyhwp의 <p><span class="TableControl"><table>...</table></span></p> 구조를 수정.

    HTML 파서는 <p>(인라인) 안에 <table>(블록)을 허용하지 않아 테이블이 p 밖으로 빠져나옴.
    해결: 1) CSS에서 text-align: center인 parashape 클래스를 찾고
          2) <p>+<span> 래퍼를 제거하고 <table>에 직접 margin 스타일을 적용
    """
    import re

    # 1) CSS에서 text-align: center를 사용하는 parashape 클래스 목록 수집
    centered_classes: set[str] = set()
    for m in re.finditer(
        r'p\.(parashape-\d+)\s*\{[^}]*text-align:\s*center[^}]*\}', html
    ):
        centered_classes.add(m.group(1))

    logger.debug("중앙정렬 parashape 클래스: %s", centered_classes)

    # 2) <p class="..."><span class="TableControl" style="..."><table ...>...</table></span>...</p>
    #    → <div class="TableControl" style="..."><table ...>...</table></div>
    result = []
    pos = 0

    while True:
        span_idx = html.find('<span class="TableControl"', pos)
        if span_idx == -1:
            result.append(html[pos:])
            break

        # 이 span을 감싸는 <p> 태그 찾기
        p_start = html.rfind('<p ', pos, span_idx)
        if p_start == -1:
            p_start = html.rfind('<p>', pos, span_idx)
        if p_start == -1:
            result.append(html[pos:span_idx + 1])
            pos = span_idx + 1
            continue

        p_tag_end = html.find('>', p_start) + 1
        p_tag = html[p_start:p_tag_end]

        # <p>와 <span> 사이에 다른 콘텐츠가 없는지 확인
        between = html[p_tag_end:span_idx].strip()
        if between:
            # 다른 콘텐츠가 있으면 이 패턴이 아님
            result.append(html[pos:span_idx + 1])
            pos = span_idx + 1
            continue

        # p 태그의 클래스에서 parashape 클래스 추출
        class_match = re.search(r'class="([^"]*)"', p_tag)
        p_classes = class_match.group(1) if class_match else ""
        is_centered = any(cls in centered_classes for cls in p_classes.split())

        # 올바른 </table></span> 쌍 찾기 (중첩 테이블 고려)
        # span 안의 첫 <table> 부터 시작, depth=1로 시작하여 매칭되는 </table> 찾기
        span_tag_end_tmp = html.find('>', span_idx) + 1
        table_depth = 0
        search_pos = span_tag_end_tmp
        close_pair = -1
        while search_pos < len(html):
            next_open = html.find('<table', search_pos)
            next_close = html.find('</table>', search_pos)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                table_depth += 1
                search_pos = next_open + 6
            else:
                table_depth -= 1
                if table_depth == 0:
                    # 최외곽 </table> 찾음
                    close_pair = next_close
                    break
                search_pos = next_close + 8

        if close_pair == -1:
            result.append(html[pos:span_idx + 1])
            pos = span_idx + 1
            continue

        # </table> 바로 뒤의 </span> 확인
        after_table = html[close_pair + len('</table>'):close_pair + len('</table>') + 20]
        if not after_table.startswith('</span>'):
            result.append(html[pos:span_idx + 1])
            pos = span_idx + 1
            continue

        close_span_end = close_pair + len('</table></span>')

        # 그 뒤의 </p> 찾기
        remaining = html[close_span_end:]
        close_p_match = re.match(r'(&#13;)?\s*</p>', remaining)
        if not close_p_match:
            result.append(html[pos:span_idx + 1])
            pos = span_idx + 1
            continue

        close_p_end = close_span_end + close_p_match.end()

        # <p> 앞까지 그대로 복사
        result.append(html[pos:p_start])

        # 테이블 정렬 스타일 결정
        margin_style = "margin: 0 auto;" if is_centered else ""

        # span 여는 태그 이후부터 </table> 포함까지 추출
        span_tag_end = html.find('>', span_idx) + 1
        table_end = close_pair + len('</table>')
        table_and_content = html[span_tag_end:table_end]  # <table>...</table>

        result.append(
            f'<div class="TableControl" style="width: fit-content; {margin_style}">'
        )
        result.append(table_and_content)
        result.append('</div>')

        pos = close_p_end

    return ''.join(result)


def _inject_normalize_css(html: str) -> str:
    """변환된 HTML에 폰트 정규화 + 레이아웃 보정 CSS를 삽입."""
    import re

    # pyhwp가 <p> 안에 <span><table>을 넣지만, HTML 파서는 <p> 안에 블록 요소를 허용하지 않아
    # 테이블이 p 밖으로 빠져나옴. 해결: <p>...<span> 구조를 <div>로 변환
    # 실패 시 원본 유지 (PDF 렌더링에는 영향 없음 — 브라우저가 자체 처리)
    try:
        for _pass in range(10):
            prev_count = html.count('<span class="TableControl"')
            if prev_count == 0:
                break
            html = _fix_table_control_structure(html)
            new_count = html.count('<span class="TableControl"')
            if new_count == 0 or new_count >= prev_count:
                break
    except Exception:
        logger.warning("TableControl 변환 스킵 (복잡한 구조)")

    # .Normal 클래스에서 text-align 제거 (parashape 클래스의 text-align이 확실히 적용되도록)
    html = re.sub(
        r"(\.Normal\s*\{[^}]*?)text-align:\s*[^;]+;",
        r"\1/* text-align: removed - parashape handles alignment */",
        html,
    )

    # </head> 바로 앞에 삽입
    if "</head>" in html:
        return html.replace("</head>", _FONT_NORMALIZE_CSS + "</head>")
    if "<body" in html:
        return html.replace("<body", _FONT_NORMALIZE_CSS + "<body")
    return _FONT_NORMALIZE_CSS + html


def _find_form_boundaries(html: str) -> list[dict]:
    """HTML에서 [ 서식 N ] 패턴을 찾아 서식 경계 목록을 반환.

    각 서식 경계는 서식 번호 단락의 위치와 그 뒤의 부제목(첫 의미있는 텍스트)을 포함.
    """
    paras = list(re.finditer(r"<p[^>]*>(.*?)</p>", html, re.DOTALL))
    boundaries: list[dict] = []

    for i, p in enumerate(paras):
        text = re.sub(r"<[^>]+>", "", p.group(1))
        text = re.sub(r"&#\d+;", "", text).strip()
        # [ 서식 N ] 패턴 매칭 (참조 문구 제외)
        m = re.search(r"\[?\s*서식\s*(\d+)\s*\]?", text)
        if not m:
            continue
        # "서식 8의 참여인력 현황표에 기재된" 같은 참조 문구 제외
        if "기재된" in text or "의 참여인력" in text:
            continue

        # 부제목: 서식 번호 뒤 첫 의미있는 단락
        subtitle = ""
        for j in range(i + 1, min(i + 5, len(paras))):
            next_text = re.sub(r"<[^>]+>", "", paras[j].group(1))
            next_text = re.sub(r"&#\d+;", "", next_text).strip()
            if next_text and len(next_text) > 2 and not re.match(r"^[\s\d.]+$", next_text):
                subtitle = next_text[:40]
                break

        boundaries.append({
            "form_num": int(m.group(1)),
            "position": p.start(),
            "subtitle": subtitle,
        })

    return boundaries


def parse_html_sections(html: str) -> list[dict]:
    """변환된 HTML에서 서식 단위로 섹션 목록을 추출.

    [ 서식 N ] 패턴을 기준으로 그룹핑하여, 하나의 서식에 속하는
    제목 단락 + 모든 테이블을 하나의 섹션으로 묶는다.
    서식 번호가 없는 앞부분은 "표지/목차"로 처리.

    Returns:
        list[dict]: [{"index": 1, "label": "표지/목차", "start": ..., "end": ...}, ...]
    """
    boundaries = _find_form_boundaries(html)
    if not boundaries:
        # 서식 패턴이 없으면 전체를 하나의 섹션으로
        return []

    sections: list[dict] = []

    # body 시작 위치
    body_idx = html.find("<body")
    body_start = html.find(">", body_idx) + 1 if body_idx != -1 else 0

    # body 끝 위치
    body_end_idx = html.find("</body>")
    body_end = body_end_idx if body_end_idx != -1 else len(html)

    # 서식 1 앞에 내용이 있으면 "표지/목차" 섹션 추가
    first_form_pos = boundaries[0]["position"]
    if first_form_pos > body_start + 50:  # 의미있는 내용이 있을 때만
        sections.append({
            "index": 0,
            "label": "표지/목차",
            "start": body_start,
            "end": first_form_pos,
        })

    # 각 서식 경계 → 다음 서식 경계까지를 하나의 섹션으로
    # index는 순차 번호 사용 (서식 번호가 중복될 수 있으므로)
    next_index = 1 if sections else 0  # 표지/목차가 있으면 1부터, 없으면 0부터
    if sections:
        next_index = sections[-1]["index"] + 1

    for i, boundary in enumerate(boundaries):
        start = boundary["position"]
        # 끝: 다음 서식의 시작 또는 body 끝
        end = boundaries[i + 1]["position"] if i + 1 < len(boundaries) else body_end

        form_num = boundary["form_num"]
        subtitle = boundary["subtitle"]
        label = f"서식 {form_num}"
        if subtitle:
            label += f" - {subtitle}"

        sections.append({
            "index": next_index,
            "label": label,
            "start": start,
            "end": end,
        })
        next_index += 1

    return sections


def extract_html_sections(html: str, indices: list[int]) -> str:
    """HTML에서 지정된 섹션만 추출하여 새 HTML 문서를 생성.

    Args:
        html: 전체 변환된 HTML
        indices: 추출할 섹션 인덱스 목록 (0=표지, 1~13=서식 번호)

    Returns:
        선택된 섹션만 포함하는 HTML 문서
    """
    sections = parse_html_sections(html)
    if not sections:
        return html

    # head 부분 추출 (스타일 유지)
    head_end = html.find("</head>")
    if head_end == -1:
        head_part = ""
    else:
        head_part = html[: head_end + len("</head>")]

    # 선택된 섹션의 HTML 조각 수집
    selected_parts: list[str] = []
    for sec in sections:
        if sec["index"] in indices:
            section_html = html[sec["start"]:sec["end"]].strip()
            # 앞쪽 고아 닫는 태그 제거
            section_html = re.sub(
                r"^(\s*</(?:td|tr|table|div|span|p)>\s*)+",
                "",
                section_html,
                flags=re.IGNORECASE,
            ).strip()
            selected_parts.append(section_html)

    body_content = "\n".join(selected_parts)

    if head_part:
        return f"{head_part}\n<body>\n{body_content}\n</body>\n</html>"
    else:
        return f"<html><body>\n{body_content}\n</body></html>"
