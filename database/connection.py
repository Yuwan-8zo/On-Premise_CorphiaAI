"""
資料庫連接配置
"""

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# 資料庫 URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./data/corphia.db"
)

# 建立引擎
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DEBUG", "false").lower() == "true",
    future=True,
)

# Session 工廠
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# 基礎模型
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    取得資料庫 Session
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    初始化資料庫（建立所有表）
    """
    # 確保 data 目錄存在
    os.makedirs("data", exist_ok=True)
    
    # 匯入所有模型以確保它們被註冊
    from database.models import (
        tenant,
        user,
        conversation,
        message,
        document,
        folder,
        user_settings,
        audit_log,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    關閉資料庫連接
    """
    await engine.dispose()
