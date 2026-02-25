"""IP 화이트리스트 미들웨어

config/allowed_ips.yaml에 정의된 IP 목록만 접근 허용.
DEV_MODE=true 시 비활성화.
"""

import ipaddress
import logging
from pathlib import Path

import yaml
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.config import settings

logger = logging.getLogger(__name__)


def load_allowed_networks() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    """allowed_ips.yaml 파일에서 허용 IP/대역 로드"""
    config_path = Path(settings.ALLOWED_IPS_FILE)
    if not config_path.exists():
        logger.warning("IP 설정 파일이 없습니다: %s (모든 요청 허용)", config_path)
        return []

    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    allowed_ips = data.get("allowed_ips", [])

    for ip_str in allowed_ips:
        try:
            network = ipaddress.ip_network(ip_str, strict=False)
            networks.append(network)
        except ValueError:
            logger.warning("잘못된 IP/대역 형식 무시: %s", ip_str)

    logger.info("허용된 IP 대역 %d개 로드", len(networks))
    return networks


def is_ip_allowed(
    client_ip: str,
    allowed_networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network],
) -> bool:
    """클라이언트 IP가 허용 목록에 포함되는지 확인"""
    if not allowed_networks:
        # 설정 파일이 없거나 비어있으면 모든 IP 허용
        return True

    try:
        addr = ipaddress.ip_address(client_ip)
        return any(addr in network for network in allowed_networks)
    except ValueError:
        logger.warning("파싱 불가능한 IP: %s", client_ip)
        return False


class IPFilterMiddleware(BaseHTTPMiddleware):
    """IP 화이트리스트 미들웨어"""

    def __init__(self, app, dev_mode: bool = False):
        super().__init__(app)
        self.dev_mode = dev_mode
        self.allowed_networks = load_allowed_networks()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # 개발 모드에서는 IP 필터 비활성화
        if self.dev_mode:
            return await call_next(request)

        # 클라이언트 IP 추출
        client_ip = request.client.host if request.client else "unknown"

        # X-Forwarded-For 헤더 지원 (프록시/로드밸런서 뒤에 있을 때)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # 첫 번째 IP가 실제 클라이언트 IP
            client_ip = forwarded_for.split(",")[0].strip()

        if not is_ip_allowed(client_ip, self.allowed_networks):
            logger.warning("차단된 IP 접근 시도: %s %s", client_ip, request.url.path)
            return JSONResponse(
                status_code=403,
                content={"detail": f"접근이 거부되었습니다. (IP: {client_ip})"},
            )

        return await call_next(request)
