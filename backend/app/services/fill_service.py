"""인력 자동 채움 서비스 — HTML {{placeholder}} 패턴을 인력 DB 데이터로 치환"""

import json
import logging
import re
from datetime import date

from app.models.bid import BidPersonnel, CompanyInfo
from app.models.personnel import Certification, Personnel, ProjectHistory

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 날짜 포맷 헬퍼
# ──────────────────────────────────────────────


def _format_date(d: date | None) -> str:
    """date → "YYYY.MM.DD" 형식 문자열. None이면 빈 문자열."""
    if d is None:
        return ""
    return d.strftime("%Y.%m.%d")


def _safe_str(value) -> str:
    """None이면 빈 문자열, 아니면 str 변환."""
    if value is None:
        return ""
    return str(value)


# ──────────────────────────────────────────────
# 변수 추출
# ──────────────────────────────────────────────


def _extract_variables(html_content: str) -> list[str]:
    """HTML 내 {{변수명}} 패턴을 추출하여 고유 변수 목록을 반환."""
    pattern = r"\{\{(\w+)\}\}"
    variables = re.findall(pattern, html_content)
    seen: set[str] = set()
    unique: list[str] = []
    for v in variables:
        if v not in seen:
            seen.add(v)
            unique.append(v)
    return unique


# ──────────────────────────────────────────────
# 단순 필드 매핑 구성
# ──────────────────────────────────────────────


def _build_simple_field_map(
    personnel: Personnel,
    bid_personnel: BidPersonnel | None = None,
) -> dict[str, str]:
    """Personnel + BidPersonnel에서 단순 필드(1:1) 매핑 딕셔너리를 구성한다."""
    field_map: dict[str, str] = {
        "name": _safe_str(personnel.name),
        "title": _safe_str(personnel.title),
        "department": _safe_str(personnel.department),
        "phone": _safe_str(personnel.phone),
        "email": _safe_str(personnel.email),
        "birth_date": _format_date(personnel.birth_date),
        "hire_date": _format_date(personnel.hire_date),
        "years_of_experience": _safe_str(personnel.years_of_experience),
        "education_level": _safe_str(personnel.education_level),
        "education_school": _safe_str(personnel.education_school),
        "education_major": _safe_str(personnel.education_major),
        "graduation_year": _safe_str(personnel.graduation_year),
        "notes": _safe_str(personnel.notes),
    }

    if bid_personnel:
        field_map["role_in_bid"] = _safe_str(bid_personnel.role_in_bid)

    return field_map


# ──────────────────────────────────────────────
# 자격증 필드 매핑
# ──────────────────────────────────────────────

# 자격증 필드 이름 → Certification 속성 매핑
CERT_FIELD_ATTRS = {
    "name": "cert_name",
    "number": "cert_number",
    "date": "cert_date",
    "issuer": "cert_issuer",
}


def _build_cert_map(cert: Certification, prefix: str) -> dict[str, str]:
    """단일 자격증에 대해 {prefix_name: value, prefix_number: value, ...} 딕셔너리를 구성."""
    result: dict[str, str] = {}
    for short_key, attr_name in CERT_FIELD_ATTRS.items():
        value = getattr(cert, attr_name, None)
        if attr_name == "cert_date":
            result[f"{prefix}_{short_key}"] = _format_date(value)
        else:
            result[f"{prefix}_{short_key}"] = _safe_str(value)
    return result


# ──────────────────────────────────────────────
# 프로젝트 이력 필드 매핑
# ──────────────────────────────────────────────

# 프로젝트 필드 이름 → ProjectHistory 속성 매핑
PROJECT_FIELD_ATTRS = {
    "name": "project_name",
    "client": "client",
    "role": "role",
    "start_date": "start_date",
    "end_date": "end_date",
    "budget": "budget",
    "description": "description",
}


def _build_project_map(project: ProjectHistory, prefix: str) -> dict[str, str]:
    """단일 프로젝트에 대해 {prefix_name: value, ...} 딕셔너리를 구성."""
    result: dict[str, str] = {}
    for short_key, attr_name in PROJECT_FIELD_ATTRS.items():
        value = getattr(project, attr_name, None)
        if attr_name in ("start_date", "end_date"):
            result[f"{prefix}_{short_key}"] = _format_date(value)
        else:
            result[f"{prefix}_{short_key}"] = _safe_str(value)
    return result


# ──────────────────────────────────────────────
# TR 행 복제 로직 (배열 자동 확장)
# ──────────────────────────────────────────────


def _expand_tr_rows(
    html: str,
    items: list,
    placeholder_prefix: str,
    build_map_fn,
) -> str:
    """
    <tr> 내에 번호 없는 {{prefix_field}} 플레이스홀더가 있으면,
    해당 <tr>을 items 개수만큼 복제하고 각 행에 데이터를 치환한다.

    예: <tr>..{{cert_name}}..{{cert_date}}..</tr>
    → items가 3개면 <tr> 3줄로 복제되고 각각 데이터 채움

    이미 번호가 붙은 {{cert_1_name}} 패턴은 이 함수가 처리하지 않는다.
    """
    # placeholder_prefix 예: "cert", "project"
    # 번호 없는 패턴: {{cert_name}}, {{cert_date}} 등 (cert_1_name 은 제외)
    unnumbered_pattern = re.compile(
        r"\{\{" + re.escape(placeholder_prefix) + r"_(?!\d+_)(\w+)\}\}"
    )

    # <tr>...</tr> 블록을 찾되, 해당 블록 안에 unnumbered 패턴이 있는 것만 대상으로 삼음
    tr_pattern = re.compile(r"(<tr\b[^>]*>)(.*?)(</tr>)", re.DOTALL | re.IGNORECASE)

    def replace_tr(match: re.Match) -> str:
        tr_open = match.group(1)
        tr_body = match.group(2)
        tr_close = match.group(3)
        full_tr = match.group(0)

        # 이 <tr> 안에 번호 없는 플레이스홀더가 있는지 확인
        if not unnumbered_pattern.search(tr_body):
            return full_tr

        # items가 비어있으면 템플릿 행 제거 (빈 행을 남기지 않음)
        if not items:
            return ""

        rows: list[str] = []
        for item in items:
            # 각 item에 대해 번호 없는 매핑 생성
            # build_map_fn은 (item, prefix) → dict 형태
            # 여기서는 prefix 없이 "cert" or "project"를 넘겨서
            # {cert_name: ..., cert_date: ...} 키로 받는다
            item_map = build_map_fn(item, placeholder_prefix)
            row = full_tr
            for key, value in item_map.items():
                row = row.replace("{{" + key + "}}", value)
            rows.append(row)

        return "\n".join(rows)

    result = tr_pattern.sub(replace_tr, html)
    return result


# ──────────────────────────────────────────────
# 메인 함수
# ──────────────────────────────────────────────


def fill_personnel(
    html_content: str,
    personnel: Personnel,
    bid_personnel: BidPersonnel | None = None,
    selected_project_ids: list[int] | None = None,
) -> dict:
    """
    HTML 내 {{placeholder}} 패턴을 인력 데이터로 치환한다.

    처리 순서:
    1. <tr> 행 복제 (번호 없는 배열 플레이스홀더)
    2. 번호 붙은 배열 플레이스홀더 치환 ({{cert_1_name}}, {{project_2_client}} 등)
    3. 단순 필드 치환 ({{name}}, {{department}} 등)

    Returns:
        {"html_content": str, "filled_count": int, "remaining": list[str]}
    """
    if not html_content:
        return {"html_content": "", "filled_count": 0, "remaining": []}

    # 치환 전 변수 목록
    vars_before = set(_extract_variables(html_content))
    result_html = html_content

    # ── 자격증 데이터 준비 ──
    certs: list[Certification] = personnel.certifications or []

    # ── 프로젝트 이력 데이터 준비 (선택된 것만 필터링) ──
    all_projects: list[ProjectHistory] = personnel.project_history or []
    if selected_project_ids is not None:
        projects = [p for p in all_projects if p.id in selected_project_ids]
    else:
        projects = list(all_projects)

    # ── 1단계: <tr> 행 복제 (번호 없는 배열 플레이스홀더) ──
    result_html = _expand_tr_rows(result_html, certs, "cert", _build_cert_map)
    result_html = _expand_tr_rows(result_html, projects, "project", _build_project_map)

    # ── 2단계: 번호 붙은 배열 플레이스홀더 치환 ──
    # 자격증: {{cert_1_name}}, {{cert_2_date}} 등
    for i, cert in enumerate(certs, start=1):
        cert_map = _build_cert_map(cert, f"cert_{i}")
        for key, value in cert_map.items():
            result_html = result_html.replace("{{" + key + "}}", value)

    # 프로젝트: {{project_1_name}}, {{project_2_client}} 등
    for i, proj in enumerate(projects, start=1):
        proj_map = _build_project_map(proj, f"project_{i}")
        for key, value in proj_map.items():
            result_html = result_html.replace("{{" + key + "}}", value)

    # ── 3단계: 단순 필드 치환 ──
    simple_map = _build_simple_field_map(personnel, bid_personnel)
    for key, value in simple_map.items():
        result_html = result_html.replace("{{" + key + "}}", value)

    # ── 4단계: 남은 번호 붙은 배열 변수 빈 문자열로 치환 ──
    # 예: 자격증이 2개인데 {{cert_3_name}} 이 있으면 빈 문자열로
    remaining_numbered = re.compile(
        r"\{\{(?:cert|project)_\d+_\w+\}\}"
    )
    result_html = remaining_numbered.sub("", result_html)

    # ── 결과 통계 ──
    vars_after = set(_extract_variables(result_html))
    filled_count = len(vars_before - vars_after)
    remaining = sorted(vars_after)

    logger.info(
        "인력 자동 채움 완료: personnel_id=%d, 치환=%d개, 미치환=%d개",
        personnel.id,
        filled_count,
        len(remaining),
    )

    return {
        "html_content": result_html,
        "filled_count": filled_count,
        "remaining": remaining,
    }


def fill_company(
    html_content: str,
    company_info: CompanyInfo,
) -> dict:
    """
    HTML 내 {{placeholder}} 패턴을 회사 기본정보 데이터로 치환한다.

    지원 변수: company_name, business_number, corporate_number, representative,
    representative_birth, address, phone, fax, email, website,
    business_type, business_category, establishment_date, capital, employee_count

    Returns:
        {"html_content": str, "filled_count": int, "remaining": list[str]}
    """
    if not html_content:
        return {"html_content": "", "filled_count": 0, "remaining": []}

    vars_before = set(_extract_variables(html_content))
    result_html = html_content

    # 회사 정보 필드 매핑
    company_field_map: dict[str, str] = {
        "company_name": _safe_str(company_info.company_name),
        "business_number": _safe_str(company_info.business_number),
        "corporate_number": _safe_str(company_info.corporate_number),
        "representative": _safe_str(company_info.representative),
        "representative_birth": _safe_str(company_info.representative_birth),
        "address": _safe_str(company_info.address),
        "phone": _safe_str(company_info.phone),
        "fax": _safe_str(company_info.fax),
        "email": _safe_str(company_info.email),
        "website": _safe_str(company_info.website),
        "business_type": _safe_str(company_info.business_type),
        "business_category": _safe_str(company_info.business_category),
        "establishment_date": _safe_str(company_info.establishment_date),
        "capital": _safe_str(company_info.capital),
        "employee_count": _safe_str(company_info.employee_count),
    }

    for key, value in company_field_map.items():
        result_html = result_html.replace("{{" + key + "}}", value)

    vars_after = set(_extract_variables(result_html))
    filled_count = len(vars_before - vars_after)
    remaining = sorted(vars_after)

    logger.info(
        "회사 정보 자동 채움 완료: 치환=%d개, 미치환=%d개",
        filled_count,
        len(remaining),
    )

    return {
        "html_content": result_html,
        "filled_count": filled_count,
        "remaining": remaining,
    }


def get_selected_project_ids(bid_personnel: BidPersonnel | None) -> list[int] | None:
    """BidPersonnel의 selected_projects JSON 문자열에서 프로젝트 ID 목록을 파싱한다."""
    if not bid_personnel or not bid_personnel.selected_projects:
        return None
    try:
        ids = json.loads(bid_personnel.selected_projects)
        if isinstance(ids, list):
            return [int(x) for x in ids]
    except (json.JSONDecodeError, ValueError, TypeError):
        logger.warning(
            "selected_projects JSON 파싱 실패: bp_id=%d, value=%s",
            bid_personnel.id,
            bid_personnel.selected_projects,
        )
    return None
