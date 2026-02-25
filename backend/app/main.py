"""정량제안서 작성 시스템 API 서버"""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.middleware.ip_filter import IPFilterMiddleware
from app.routers import ai, hwp, library, personnel
import app.models  # noqa: F401 - register models with Base.metadata

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Bid Proposal System API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# IP filter
app.add_middleware(IPFilterMiddleware, dev_mode=settings.DEV_MODE)

# Routers
app.include_router(personnel.router, prefix="/api/personnel", tags=["personnel"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(library.router, prefix="/api/library", tags=["library"])
app.include_router(hwp.router, prefix="/api/hwp", tags=["hwp"])


@app.on_event("startup")
async def startup_event():
    # Create data directories first (DB directory must exist before create_tables)
    for dir_path in [settings.DB_DIR, settings.UPLOAD_DIR, settings.THUMBNAIL_DIR, settings.GENERATED_DIR]:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
    logger.info("데이터 디렉토리 생성 완료")

    # Create database tables
    create_tables()
    logger.info("데이터베이스 테이블 생성 완료")

    logger.info("서버 시작 준비 완료")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
