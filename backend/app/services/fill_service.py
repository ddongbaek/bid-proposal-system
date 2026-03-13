"""인력 자동 채움 서비스 — HTML {{placeholder}} 패턴을 인력 DB 데이터로 치환"""

import base64
import json
import logging
import os
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
    """Personnel + BidPersonnel에서 단순 필드(1:1) 매핑 딕셔너리를 구성한다.

    AI가 생성하는 다양한 변수명에 대응하기 위해 별칭(alias)도 함께 등록한다.
    예: {{position}} → title, {{major}} → education_major
    """
    name = _safe_str(personnel.name)
    title = _safe_str(personnel.title)
    department = _safe_str(personnel.department)
    phone = _safe_str(personnel.phone)
    email = _safe_str(personnel.email)
    birth_date = _format_date(personnel.birth_date)
    hire_date = _format_date(personnel.hire_date)
    years_exp = _safe_str(personnel.years_of_experience)
    edu_level = _safe_str(personnel.education_level)
    edu_school = _safe_str(personnel.education_school)
    edu_major = _safe_str(personnel.education_major)
    grad_year = _safe_str(personnel.graduation_year)
    notes = _safe_str(personnel.notes)

    field_map: dict[str, str] = {
        # 기본 필드
        "name": name,
        "title": title,
        "department": department,
        "phone": phone,
        "email": email,
        "birth_date": birth_date,
        "hire_date": hire_date,
        "years_of_experience": years_exp,
        "education_level": edu_level,
        "education_school": edu_school,
        "education_major": edu_major,
        "graduation_year": grad_year,
        "notes": notes,
        # ── AI가 자주 생성하는 별칭들 ──
        "position": title,                    # 직위
        "affiliation": department,             # 소속
        "major": edu_major,                    # 전공
        "degree": edu_level,                   # 학위
        "school": edu_school,                  # 학교
        "career": years_exp,                   # 경력
        "experience": years_exp,               # 경력
        "office_phone": phone,                 # 사무실 전화
        "mobile_phone": _safe_str(getattr(personnel, 'mobile_phone', None)) or phone,  # 휴대전화
        "mobile": _safe_str(getattr(personnel, 'mobile_phone', None)) or phone,
        "tel": phone,
        "contact": phone,
        "birthdate": birth_date,
        "birth": birth_date,
        "personnel_name": name,                # 인력명
        "member_name": name,
        "employee_name": name,
    }

    if bid_personnel:
        field_map["role_in_bid"] = _safe_str(bid_personnel.role_in_bid)

        # 역할별 별칭: PM으로 배정된 인력이면 pm_* 도 채움
        role = _safe_str(bid_personnel.role_in_bid).upper()
        if "PM" in role or "관리자" in role:
            field_map["pm_name"] = field_map["name"]
            field_map["pm_phone"] = field_map["phone"]
            field_map["pm_email"] = field_map["email"]

        # 제출자 별칭
        if "제출" in _safe_str(bid_personnel.role_in_bid) or "신청" in _safe_str(bid_personnel.role_in_bid):
            field_map["submitter_phone"] = field_map["phone"]
            field_map["submitter_email"] = field_map["email"]

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


def fill_all_personnel(
    html_content: str,
    personnel_list: list[tuple[Personnel, BidPersonnel | None]],
) -> dict:
    """
    HTML 내 다수 인력 테이블을 한번에 채운다.
    <tr> 안에 {{name}}, {{department}} 등 인력 플레이스홀더가 있으면
    배정된 인력 수만큼 행을 복제하고 데이터를 채운다.

    personnel_list: [(Personnel, BidPersonnel|None), ...]
    """
    if not html_content:
        return {"html_content": "", "filled_count": 0, "remaining": []}

    vars_before = set(_extract_variables(html_content))
    result_html = html_content

    # 인력 단순 필드 목록 (이 필드가 <tr> 안에 있으면 인력 행 복제 대상)
    # AI가 생성하는 별칭도 포함
    personnel_fields = {
        "name", "title", "department", "phone", "email",
        "birth_date", "hire_date", "years_of_experience",
        "education_level", "education_school", "education_major",
        "graduation_year", "role_in_bid", "notes",
        "cert_name", "cert_date", "cert_issuer", "cert_number",
        # AI 별칭
        "position", "affiliation", "major", "degree", "school",
        "career", "experience", "office_phone", "mobile_phone",
        "mobile", "tel", "contact", "birthdate", "birth",
        "personnel_name", "member_name", "employee_name",
    }

    # <tr> 패턴 찾기
    tr_pattern = re.compile(r"(<tr\b[^>]*>)(.*?)(</tr>)", re.DOTALL | re.IGNORECASE)
    # 인력 필드 패턴 (번호 없는)
    field_pattern = re.compile(r"\{\{(" + "|".join(re.escape(f) for f in personnel_fields) + r")\}\}")

    def replace_tr(match: re.Match) -> str:
        tr_body = match.group(2)
        full_tr = match.group(0)

        # 이 <tr> 안에 인력 플레이스홀더가 있는지 확인
        if not field_pattern.search(tr_body):
            return full_tr

        if not personnel_list:
            return ""

        rows: list[str] = []
        for person, bp in personnel_list:
            field_map = _build_simple_field_map(person, bp)
            # 자격증 첫번째만 (요약 테이블에서)
            certs = person.certifications or []
            if certs:
                cert = certs[0]
                field_map["cert_name"] = _safe_str(cert.cert_name)
                field_map["cert_date"] = _format_date(cert.cert_date)
                field_map["cert_issuer"] = _safe_str(cert.cert_issuer)
                field_map["cert_number"] = _safe_str(cert.cert_number)
            else:
                field_map["cert_name"] = ""
                field_map["cert_date"] = ""
                field_map["cert_issuer"] = ""
                field_map["cert_number"] = ""

            row = full_tr
            for key, value in field_map.items():
                row = row.replace("{{" + key + "}}", value)
            rows.append(row)

        return "\n".join(rows)

    result_html = tr_pattern.sub(replace_tr, result_html)

    vars_after = set(_extract_variables(result_html))
    filled_count = len(vars_before - vars_after)
    remaining = sorted(vars_after)

    logger.info(
        "전체 인력 자동 채움 완료: %d명, 치환=%d개, 미치환=%d개",
        len(personnel_list),
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
        "zip_code": _safe_str(company_info.zip_code),
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

    # AI가 생성하는 별칭 매핑
    alias_map: dict[str, str] = {
        "foundation_date": company_field_map.get("establishment_date", ""),
        "representative_name": company_field_map.get("representative", ""),
        "business_item": company_field_map.get("business_category", ""),
        "business_registration_number": company_field_map.get("business_number", ""),
    }
    company_field_map.update({k: v for k, v in alias_map.items() if k not in company_field_map})

    for key, value in company_field_map.items():
        result_html = result_html.replace("{{" + key + "}}", value)

    vars_after = set(_extract_variables(result_html))
    filled_count = len(vars_before - vars_after)
    remaining = sorted(vars_after)

    # 인감도장 오버레이 처리
    seal_path = getattr(company_info, "seal_image", None)
    if seal_path:
        result_html = _overlay_seal_image(result_html, seal_path)

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


def _overlay_seal_image(html: str, seal_path: str) -> str:
    """
    HTML 내 (인) 텍스트를 찾아서 인감 이미지를 오버레이로 삽입한다.
    (인) 텍스트가 포함된 부분을 position:relative 컨테이너로 감싸고,
    인감 이미지를 absolute 중앙 배치한다.
    """
    if not seal_path or not os.path.exists(seal_path):
        return html

    # 이미지를 base64로 인라인 (PDF 생성 시에도 표시되도록)
    try:
        with open(seal_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode("ascii")
        ext = os.path.splitext(seal_path)[1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp"}.get(ext.lstrip("."), "image/png")
        data_uri = f"data:{mime};base64,{img_data}"
    except Exception:
        logger.warning("인감 이미지 읽기 실패: %s", seal_path)
        return html

    seal_img = (
        f'<img src="{data_uri}" alt="인감" style="'
        f"position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); "
        f'width:70px; height:70px; object-fit:contain; opacity:0.85; pointer-events:none;">'
    )

    # (인), ( 인 ), (印) 패턴 찾아서 오버레이
    # <td> 또는 <span> 안에 있을 수 있으므로, 텍스트 레벨에서 교체
    seal_pattern = re.compile(r'(\(\s*인\s*\)|\(\s*印\s*\))')

    def replace_seal(match: re.Match) -> str:
        original = match.group(0)
        return (
            f'<span style="position:relative; display:inline-block;">'
            f'{original}{seal_img}</span>'
        )

    result = seal_pattern.sub(replace_seal, html)
    if result != html:
        logger.info("인감 이미지 오버레이 삽입 완료")
    return result


def fill_bid_info(
    html_content: str,
    bid_name: str | None = None,
    bid_number: str | None = None,
    client_name: str | None = None,
) -> dict:
    """
    HTML 내 {{bid_name}}, {{bid_number}}, {{client_name}} 패턴을 입찰 정보로 치환한다.

    Returns:
        {"html_content": str, "filled_count": int, "remaining": list[str]}
    """
    if not html_content:
        return {"html_content": "", "filled_count": 0, "remaining": []}

    vars_before = set(_extract_variables(html_content))
    result_html = html_content

    bid_field_map: dict[str, str] = {
        "bid_name": _safe_str(bid_name),
        "bid_number": _safe_str(bid_number),
        "client_name": _safe_str(client_name),
    }

    for key, value in bid_field_map.items():
        result_html = result_html.replace("{{" + key + "}}", value)

    vars_after = set(_extract_variables(result_html))
    filled_count = len(vars_before - vars_after)
    remaining = sorted(vars_after)

    logger.info(
        "입찰 정보 자동 채움 완료: 치환=%d개, 미치환=%d개",
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
