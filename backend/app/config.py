"""환경변수 설정 모듈 (pydantic-settings 기반)"""

from pathlib import Path
from pydantic_settings import BaseSettings


# 프로젝트 루트 경로 (backend/ 의 상위)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """애플리케이션 환경변수 설정"""

    # 데이터베이스
    DATABASE_URL: str = f"sqlite:///{PROJECT_ROOT / 'data' / 'db' / 'bid_proposal.db'}"

    # 파일 저장 경로
    UPLOAD_DIR: str = str(PROJECT_ROOT / "data" / "uploads")
    THUMBNAIL_DIR: str = str(PROJECT_ROOT / "data" / "thumbnails")
    GENERATED_DIR: str = str(PROJECT_ROOT / "data" / "generated")
    DB_DIR: str = str(PROJECT_ROOT / "data" / "db")

    # AI (Gemini)
    GEMINI_API_KEY: str = ""

    # IP 화이트리스트
    ALLOWED_IPS_FILE: str = str(PROJECT_ROOT / "config" / "allowed_ips.yaml")

    # 개발 모드 (IP 필터 비활성화 등)
    DEV_MODE: bool = True

    # CORS 허용 오리진
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 파일 업로드 최대 크기 (50MB)
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    model_config = {
        "env_file": str(PROJECT_ROOT / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
