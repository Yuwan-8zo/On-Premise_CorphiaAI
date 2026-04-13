"""
資料庫連接與 Session 管理
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# 建立非同步引擎
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
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
    """初始化資料庫，建立所有資料表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """關閉資料庫連接"""
    await engine.dispose()
