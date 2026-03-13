"""Gemini AI 서비스 모듈 - PDF→HTML 변환 및 HTML 자연어 수정"""

import json
import logging
import re
from typing import Any

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)


def _get_gemini_model() -> Any:
    """Gemini 모델 인스턴스를 반환. API 키 미설정 시 503 예외 발생."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Gemini API 키가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 설정하세요.",
        )

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-pro")
        return model
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="google-generativeai 패키지가 설치되지 않았습니다.",
        )
    except Exception as e:
        logger.error("Gemini 모델 초기화 실패: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail=f"Gemini API 초기화 실패: {str(e)}",
        )


def _extract_variables(html_content: str) -> list[str]:
    """HTML 내 {{변수명}} 패턴을 추출하여 변수 목록을 반환."""
    pattern = r"\{\{(\w+)\}\}"
    variables = re.findall(pattern, html_content)
    # 중복 제거, 순서 유지
    seen: set[str] = set()
    unique: list[str] = []
    for v in variables:
        if v not in seen:
            seen.add(v)
            unique.append(v)
    return unique


def _parse_ai_response(response_text: str) -> dict[str, str]:
    """AI 응답 텍스트에서 HTML과 CSS를 파싱.

    프롬프트가 완전한 HTML 문서(CSS 인라인 포함)를 반환하도록 되어 있으므로,
    HTML을 통째로 추출하고 CSS는 별도 분리하지 않는다.
    """
    html_content = ""
    css_content = ""

    # HTML 코드 블록 추출
    html_match = re.search(
        r"```html\s*\n(.*?)```", response_text, re.DOTALL
    )
    if html_match:
        html_content = html_match.group(1).strip()
    else:
        # 코드 블록이 없으면 전체를 HTML로 간주 (코드 펜스 제거)
        cleaned = re.sub(r"```\w*\s*\n?", "", response_text)
        cleaned = re.sub(r"```", "", cleaned)
        html_content = cleaned.strip()

    # 별도 CSS 코드 블록이 있으면 추출 (호환성)
    css_match = re.search(
        r"```css\s*\n(.*?)```", response_text, re.DOTALL
    )
    if css_match:
        css_content = css_match.group(1).strip()

    # CSS는 HTML <style> 내에 포함되어 있으므로 별도 분리하지 않음
    # (프론트엔드 PreviewPanel이 완전한 HTML 문서를 그대로 렌더링)

    return {
        "html_content": html_content,
        "css_content": css_content,
    }


async def pdf_to_html(pdf_content: bytes, instructions: str = "") -> dict:
    """PDF 바이트를 Gemini에 보내 HTML/CSS로 변환.

    Args:
        pdf_content: PDF 파일의 바이트 데이터
        instructions: 추가 변환 지시사항 (선택)

    Returns:
        dict: {
            "html_content": str,
            "css_content": str | None,
            "detected_variables": list[str],
            "message": str
        }

    Raises:
        HTTPException: API 키 미설정(503), 변환 실패(500)
    """
    model = _get_gemini_model()

    # 프롬프트 구성 — 한국 공공입찰 양식에 최적화
    base_prompt = """PDF 원본을 **픽셀 단위로 동일하게** 재현하는 HTML을 만들어라.
한국 공공기관 입찰 제안서 양식이다. 원본과 시각적으로 구분할 수 없어야 한다.

## 1. 문서 구조
- 완전한 HTML 문서: <!DOCTYPE html><html><head><meta charset="UTF-8"><style>CSS여기</style></head><body>내용</body></html>
- A4: body { width:210mm; min-height:297mm; padding:15mm; box-sizing:border-box; margin:0 auto; }

## 2. 폰트 — 필수
- body { font-family: 'Batang', '바탕', '바탕체', serif; font-size:10pt; line-height:1.6; color:#000; }
- 원본이 고딕인 경우에만 font-family: 'Dotum', '돋움', sans-serif 사용
- 제목: 원본과 동일한 크기, 굵기, 밑줄(text-decoration:underline), 자간(letter-spacing) 재현

## 3. 표(table) — 가장 중요, 정확히 따라라
- table { width:100%; border-collapse:collapse; table-layout:fixed; border:2px solid #000; }
- 모든 td, th { border:1px solid #000; padding:3px 5px; vertical-align:middle; font-size:10pt; }
- **<colgroup>으로 각 열 너비를 원본 비율과 동일하게 %로 지정** (눈대중이 아니라 PDF의 실제 비율 측정)
- colspan, rowspan은 원본과 **정확히** 일치 (행/열 수를 세어라)
- 라벨 셀: background:#e8e8e8; text-align:center; font-weight:bold;
- 데이터 셀: text-align:left; (숫자는 right, 가운데 정렬이면 center)
- 셀 내 텍스트 자간(letter-spacing)이 넓은 경우 원본대로 재현 (예: "주 소" → letter-spacing:1em)
- **병합 셀 안에 하위 테이블이 있으면** 중첩 table로 재현

## 4. 텍스트 줄바꿈 — 반드시 원본과 동일
- 원본 PDF에서 줄이 바뀌는 **정확한 위치**에 <br> 삽입
- 여러 줄 텍스트를 절대로 한 줄로 합치지 마
- 문단 사이 간격은 margin-bottom 또는 빈 <br>로 재현
- 들여쓰기: text-indent 또는 &nbsp;&nbsp; 사용
- 글자 간격이 넓은 곳: letter-spacing 사용 (예: "년 월 일" 사이 간격)

## 5. 빈칸/플레이스홀더
- 빈 입력란은 {{영문_snake_case}} 형식
- 이미 텍스트가 있는 셀은 원본 텍스트 그대로 유지
- 회사정보: {{company_name}}, {{address}}, {{representative}}, {{business_number}}, {{phone}}, {{fax}}
- 인력: {{name}}, {{department}}, {{title}}, {{education_level}}, {{education_major}}, {{years_of_experience}}, {{role_in_bid}}
- 자격증: {{cert_name}}, {{cert_date}}, {{cert_issuer}}
- 프로젝트: {{project_name}}, {{project_client}}, {{project_role}}, {{project_start_date}}, {{project_end_date}}
- 날짜: {{submission_year}}, {{submission_month}}, {{submission_day}}
- 기타: {{project_duration}}, {{participant_count}}, {{project_manager_name}}, {{representative_name}}
- 도장/인감: (인)
- **절대 member_1_name, member_2_name 같은 번호 패턴 금지**

## 6. 페이지 번호
- "- 23 -", "- 1 -" 등 원본의 페이지 번호는 **완전 제거** (출력하지 마)

## 7. 절대 금지
- 원본에 없는 요소/장식/그림자/둥근모서리 추가 금지
- 디자인 변경/모던화/개선 금지
- 표 행/열 수 변경 금지
- 반응형/미디어쿼리 금지
- JavaScript 금지
- 원본 여러 줄 → 한 줄로 합치기 금지
- 원본에 없는 색상 추가 금지

## 8. 출력
```html 코드 블록 **하나만** 반환. 설명/주석/마크다운 텍스트 일절 불필요.
CSS는 반드시 <style> 태그 안에."""

    if instructions:
        base_prompt += f"\n\n추가 지시: {instructions}"

    try:
        # PDF를 먼저 보여주고 프롬프트를 뒤에 (시각 중심 처리)
        response = model.generate_content(
            [
                {"mime_type": "application/pdf", "data": pdf_content},
                base_prompt,
            ],
            generation_config={
                "temperature": 0.0,
                "max_output_tokens": 65536,
            },
        )

        if not response.text:
            raise HTTPException(
                status_code=500,
                detail="AI가 빈 응답을 반환했습니다. 다시 시도해주세요.",
            )

        parsed = _parse_ai_response(response.text)
        detected_vars = _extract_variables(parsed["html_content"])

        return {
            "html_content": parsed["html_content"],
            "css_content": parsed["css_content"] or None,
            "detected_variables": detected_vars,
            "message": f"변환 완료. {len(detected_vars)}개의 변수(빈칸)가 감지되었습니다.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("PDF→HTML 변환 실패: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"PDF→HTML 변환 중 오류 발생: {str(e)}",
        )


def _summarize_html_structure(html: str) -> str:
    """큰 HTML의 구조를 요약 (AI에게 CSS 셀렉터 힌트 제공용)."""
    lines = []

    # 사용된 CSS 클래스 목록
    classes = set(re.findall(r'class="([^"]+)"', html))
    class_list = sorted(classes)[:30]  # 상위 30개만
    lines.append(f"사용된 CSS 클래스: {', '.join(class_list)}")

    # 테이블 수
    table_count = html.count("<table")
    lines.append(f"테이블 수: {table_count}개")

    # <style> 내 기존 CSS 규칙 (셀렉터만)
    style_match = re.findall(r"<style[^>]*>(.*?)</style>", html, re.DOTALL)
    if style_match:
        selectors = re.findall(r"([.#\w][^{]+)\{", style_match[0])
        sel_list = [s.strip() for s in selectors[:20]]
        lines.append(f"기존 CSS 셀렉터: {', '.join(sel_list)}")

    # body 내 주요 구조
    body_match = re.search(r"<body[^>]*>(.*?)</body>", html, re.DOTALL)
    if body_match:
        body = body_match.group(1)
        div_classes = re.findall(r'<div[^>]*class="([^"]+)"', body)
        if div_classes:
            lines.append(f"body 내 div 클래스: {', '.join(set(div_classes))}")

    return "\n".join(lines)


def _apply_replacements(html: str, replacements: list[dict]) -> str:
    """AI가 반환한 검색/치환 목록을 원본 HTML에 순서대로 적용."""
    for r in replacements:
        old = r.get("old", "")
        new = r.get("new", "")
        if not old:
            continue
        if old in html:
            html = html.replace(old, new, 1)
        else:
            # 공백/줄바꿈 차이로 매칭 실패 시 유연 매칭 시도
            old_normalized = re.sub(r"\s+", r"\\s+", re.escape(old.strip()))
            match = re.search(old_normalized, html)
            if match:
                html = html[:match.start()] + new + html[match.end():]
            else:
                logger.warning("치환 대상을 찾지 못함: %s", old[:80])
    return html


async def modify_html(
    html_content: str, css_content: str | None, request: str
) -> dict:
    """기존 HTML/CSS에 대해 자연어 수정 요청을 처리.

    큰 HTML도 처리 가능하도록 전체 코드를 다시 생성하지 않고,
    검색/치환(find-and-replace) 방식으로 수정 부분만 반환받아 적용한다.

    Args:
        html_content: 현재 HTML 코드
        css_content: 현재 CSS 코드 (선택)
        request: 자연어 수정 요청 (예: "3번째 열 너비를 넓혀줘")

    Returns:
        dict: {
            "html_content": str,
            "css_content": str | None,
            "changes_description": str
        }

    Raises:
        HTTPException: API 키 미설정(503), 수정 실패(500)
    """
    model = _get_gemini_model()

    # HTML 크기에 따라 전략 분기
    is_large_html = len(html_content) > 50000

    css_section = ""
    if css_content:
        css_section = f"## 현재 CSS\n```css\n{css_content}\n```"

    if is_large_html:
        # 큰 HTML (pyhwp 변환 등): 전체 HTML을 보내되, 출력은 diff로 제한
        # Gemini 2.5 Flash는 1M 토큰 입력 가능하므로 전체 전송 OK
        prompt = f"""당신은 HTML/CSS 코드를 수정하는 전문가입니다.

## 현재 HTML
```html
{html_content}
```

{css_section}

## 수정 요청
{request}

## 중요: 응답 형식
이 HTML은 매우 크므로, 전체를 다시 작성하지 마세요!
다음 두 가지 방식 중 적절한 것을 선택하세요:

**방식1: CSS 추가** (스타일만 변경할 때)
```json
{{
  "css_addition": "추가할 CSS 코드",
  "description": "변경 내용 요약"
}}
```

**방식2: 검색/치환** (텍스트, 속성, 구조를 변경할 때)
```json
{{
  "replacements": [
    {{"old": "원본에서 정확히 복사한 코드", "new": "변경 후 코드"}}
  ],
  "description": "변경 내용 요약"
}}
```

규칙:
- CSS 추가 시: 기존 클래스명 활용, `!important` 적극 사용.
- 검색/치환 시: "old"는 원본 HTML에서 **정확히 복사** (공백, 줄바꿈 포함). 고유하게 식별 가능한 충분한 컨텍스트 포함.
- 두 방식을 동시에 쓰지 마세요. 하나만 선택.
- JSON 코드 블록 하나만 반환. 다른 설명 불필요.
"""
    else:
        prompt = f"""당신은 HTML/CSS 코드를 수정하는 전문가입니다.

## 현재 HTML (일부 생략 가능)
```html
{html_content}
```

{css_section}

## 수정 요청
{request}

## 중요: 응답 형식
전체 HTML을 다시 작성하지 마세요!
**변경할 부분만** 아래 JSON 형식으로 반환하세요:

```json
{{
  "replacements": [
    {{
      "old": "변경 전 코드 (원본에서 정확히 복사)",
      "new": "변경 후 코드"
    }}
  ],
  "description": "변경 내용 요약"
}}
```

규칙:
- "old"는 원본 HTML/CSS에서 **정확히 복사**해야 합니다 (공백, 줄바꿈 포함).
- "old"는 고유하게 식별 가능한 충분한 컨텍스트를 포함하세요.
- 여러 곳을 수정해야 하면 replacements 배열에 여러 항목을 넣으세요.
- CSS 수정 시에도 HTML 내 <style> 태그 안의 코드를 old/new로 지정하세요.
- {{{{변수명}}}} 플레이스홀더가 있으면 그대로 유지하세요.
- JSON 코드 블록 하나만 반환. 다른 설명 불필요.
"""

    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 8192,
            },
        )

        if not response.text:
            raise HTTPException(
                status_code=500,
                detail="AI가 빈 응답을 반환했습니다. 다시 시도해주세요.",
            )

        # JSON 코드 블록 추출
        json_match = re.search(
            r"```json\s*\n(.*?)```", response.text, re.DOTALL
        )
        if not json_match:
            # 코드 블록 없이 JSON만 반환한 경우
            json_match = re.search(
                r"\{[\s\S]*(?:\"replacements\"|\"css_addition\")[\s\S]*\}", response.text
            )

        if not json_match:
            # JSON 파싱 실패 시 전체 HTML 반환 방식으로 fallback
            logger.warning("AI가 JSON 형식으로 응답하지 않음. fallback 사용.")
            parsed = _parse_ai_response(response.text)
            if parsed["html_content"] and len(parsed["html_content"]) > 100:
                return {
                    "html_content": parsed["html_content"],
                    "css_content": parsed["css_content"] or css_content,
                    "changes_description": "수정이 완료되었습니다.",
                }
            # 파싱도 실패하면 원본 유지
            return {
                "html_content": html_content,
                "css_content": css_content,
                "changes_description": "수정을 적용하지 못했습니다. 다시 시도해주세요.",
            }

        json_text = json_match.group(1) if json_match.lastindex else json_match.group(0)
        try:
            data = json.loads(json_text)
        except json.JSONDecodeError:
            # JSON 파싱 실패 시 원본 유지
            logger.error("AI 응답 JSON 파싱 실패: %s", json_text[:200])
            return {
                "html_content": html_content,
                "css_content": css_content,
                "changes_description": "AI 응답을 파싱하지 못했습니다. 다시 시도해주세요.",
            }

        description = data.get("description", "수정이 완료되었습니다.")

        # css_addition 모드 (큰 HTML용): CSS를 </head> 앞에 주입
        css_addition = data.get("css_addition")
        if css_addition:
            new_style = f"\n<style type=\"text/css\">\n/* AI 수정 */\n{css_addition}\n</style>\n"
            if "</head>" in html_content:
                modified_html = html_content.replace("</head>", new_style + "</head>")
            elif "</body>" in html_content:
                modified_html = html_content.replace("</body>", new_style + "</body>")
            else:
                modified_html = html_content + new_style
            return {
                "html_content": modified_html,
                "css_content": css_content,
                "changes_description": description,
            }

        # replacements 모드 (작은 HTML용): 검색/치환
        replacements = data.get("replacements", [])

        if not replacements:
            return {
                "html_content": html_content,
                "css_content": css_content,
                "changes_description": "수정할 내용이 없습니다.",
            }

        # 치환 적용
        modified_html = _apply_replacements(html_content, replacements)

        return {
            "html_content": modified_html,
            "css_content": css_content,
            "changes_description": description,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("HTML 수정 실패: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"HTML 수정 중 오류 발생: {str(e)}",
        )
