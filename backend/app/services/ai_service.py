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
        model = genai.GenerativeModel("gemini-2.5-flash")
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

    # 프롬프트 구성 - 짧고 직접적으로
    base_prompt = """이 PDF를 보고 **스크린샷처럼 똑같이 생긴** HTML을 만들어라.

금지사항:
- 디자인 변경/개선 절대 금지. 못생겨도 원본 그대로.
- 표 구조 변경 금지. colspan/rowspan 원본과 정확히 일치.
- 폰트 변경 금지. 원본이 돋움이면 돋움, 바탕이면 바탕. (font-family: '돋움', Dotum, sans-serif)
- 여백/간격 변경 금지. 표 사이 간격, 셀 패딩 원본과 동일.

필수사항:
- 빈칸(작성할 곳)은 {{변수명}} 으로 표시 (영문 snake_case)
- 이미 적힌 텍스트는 그대로 유지
- 도장/인감/직인이 있으면 그 위치에 <img class="stamp" src="{{stamp_image}}" style="width:Xmm;height:Ymm;"> 삽입
- A4 크기: body { width:210mm; min-height:297mm; }
- CSS는 <style> 안에 포함

```html 코드 블록 하나만 반환. 설명 불필요."""

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
        # 큰 HTML (pyhwp 변환 등): CSS 추가 방식으로 처리
        # HTML 전체를 보내지 않고, 구조 요약만 전달
        html_summary = _summarize_html_structure(html_content)
        prompt = f"""당신은 HTML/CSS 코드를 수정하는 전문가입니다.

## HTML 구조 요약
{html_summary}

{css_section}

## 수정 요청
{request}

## 중요: 응답 형식
이 HTML은 매우 크므로, **새로운 CSS 규칙만 추가**하여 수정하세요.
HTML 태그 자체를 변경하지 마세요. CSS `!important`를 사용해도 됩니다.

```json
{{
  "css_addition": "추가할 CSS 코드",
  "description": "변경 내용 요약"
}}
```

규칙:
- CSS 셀렉터로 기존 클래스명(.TableControl, .parashape-N, table, td 등)을 활용하세요.
- `!important`를 적극 사용하여 기존 스타일을 덮어쓰세요.
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
