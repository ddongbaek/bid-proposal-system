"""SQLAlchemy 데이터베이스 연결 모듈"""

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


# SQLite용 엔진 생성 (check_same_thread=False: FastAPI 비동기 환경에서 필요)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


# SQLite 외래키 제약 활성화
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# 세션 팩토리
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# 선언적 Base 클래스
class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI 의존성 주입용 DB 세션 제공 함수"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_add_columns() -> None:
    """기존 테이블에 누락된 컬럼을 자동 추가 (간이 마이그레이션)"""
    logger = logging.getLogger(__name__)
    inspector = inspect(engine)

    # (테이블명, 컬럼명, ALTER 구문) 목록
    migrations = [
        ("personnel", "resident_number", "ALTER TABLE personnel ADD COLUMN resident_number TEXT"),
        ("company_info", "zip_code", "ALTER TABLE company_info ADD COLUMN zip_code TEXT"),
        ("company_info", "seal_image", "ALTER TABLE company_info ADD COLUMN seal_image TEXT"),
        ("company_info", "certified_copy_image", "ALTER TABLE company_info ADD COLUMN certified_copy_image TEXT"),
    ]

    with engine.connect() as conn:
        for table, column, ddl in migrations:
            if table in inspector.get_table_names():
                existing = [c["name"] for c in inspector.get_columns(table)]
                if column not in existing:
                    conn.execute(text(ddl))
                    conn.commit()
                    logger.info("마이그레이션: %s.%s 컬럼 추가 완료", table, column)


def create_tables() -> None:
    """모든 테이블 생성 (앱 시작 시 호출)"""
    Base.metadata.create_all(bind=engine)
    _migrate_add_columns()
