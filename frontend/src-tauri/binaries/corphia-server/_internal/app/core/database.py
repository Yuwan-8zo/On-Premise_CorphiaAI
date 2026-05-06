"""
資料庫連接與 Session 管理
"""

import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

logger = logging.getLogger(__name__)


# 建立非同步引擎
# 連線池大小由 .env 控制，方便 Docker/PostgreSQL 設定同步調整。
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,    # 使用前測試連線是否仍有效
    pool_recycle=1800,     # 每 30 分鐘回收連線，避免 PostgreSQL 踢掉閒置連線
)

# 建立非同步 Session 工廠
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy 基礎模型類別"""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    取得資料庫 Session
    
    用於 FastAPI 依賴注入
    
    Yields:
        AsyncSession: 非同步資料庫 Session
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    初始化資料庫，建立所有資料表
    
    DB-FIX-03：加入 import app.models 確保所有 model 已被 SQLAlchemy 偵測到，
    才能正確執行 create_all。並加入錯誤日誌便於排查連線問題。
    """
    from sqlalchemy import text
    
    # 確保所有 model 已被 import（讓 SQLAlchemy 的 metadata 能看到所有表格）
    import app.models  # noqa: F401
    
    try:
        async with engine.begin() as conn:
            # 建立 pgvector extension（冪等操作）
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            # 建立所有表格（checkfirst=True 確保已存在的表格不會重建）
            await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        logger.info("Database tables initialized (create_all completed)")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


async def close_db() -> None:
    """關閉資料庫連接"""
    await engine.dispose()
    logger.info("Database connection pool disposed")
