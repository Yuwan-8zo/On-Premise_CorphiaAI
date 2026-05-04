"""
測試配置模組 (conftest.py)

提供所有測試共用的 fixture：
- 測試用資料庫 session（每次測試後自動回滾）
- 測試用 HTTP 客戶端
- 預建 test_user、test_admin、auth_headers
"""

import uuid
import pytest
import pytest_asyncio
from typing import AsyncGenerator

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy import text

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.models.tenant import Tenant


# ── 測試用資料庫 URL（優先讀環境變數，否則用 .env.test 預設值）──────
import os
from dotenv import load_dotenv

# 先嘗試載入 .env.test，讓測試可以使用獨立 DB
_env_test = os.path.join(os.path.dirname(__file__), "..", ".env.test")
if os.path.exists(_env_test):
    load_dotenv(_env_test, override=True)

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://corphia:corphia123@localhost:5433/corphia_test",
)

# ── 建立測試引擎（與 app 引擎分離）────────────────────────────────
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── 在所有測試開始前建立表格，結束後刪除 ──────────────────────────
@pytest.fixture(scope="session", autouse=True)
async def setup_test_db():
    """
    Session 級別 fixture：
    - 在測試開始前建立所有資料表（使用測試 DB）
    - 在測試結束後卸載所有資料表
    """
    async with test_engine.begin() as conn:
        # 確保所有 model 已被 import
        import app.models  # noqa: F401
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


# ── 每個測試使用獨立 Session，測試結束後回滾 ──────────────────────
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    提供測試用 AsyncSession。
    每個測試結束後自動回滾，確保資料庫乾淨。
    """
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


# ── 覆寫 app 的 get_db 依賴，使其使用測試 session ─────────────────
@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    提供與測試 DB 綁定的非同步 HTTP 客戶端。
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
    app.dependency_overrides.clear()


# ── Seed Fixtures ─────────────────────────────────────────────────

@pytest_asyncio.fixture
async def test_tenant(db_session: AsyncSession) -> Tenant:
    """建立測試用租戶"""
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name="Test Tenant",
        slug=f"test-tenant-{uuid.uuid4().hex[:6]}",
    )
    db_session.add(tenant)
    await db_session.flush()
    return tenant


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """建立一般測試使用者"""
    user = User(
        id=str(uuid.uuid4()),
        email=f"user_{uuid.uuid4().hex[:6]}@test.com",
        password_hash=get_password_hash("TestPass123!"),
        name="Test User",
        role=UserRole.USER.value,
        tenant_id=test_tenant.id,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def test_admin(db_session: AsyncSession, test_tenant: Tenant) -> User:
    """建立管理員測試使用者"""
    admin = User(
        id=str(uuid.uuid4()),
        email=f"admin_{uuid.uuid4().hex[:6]}@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        name="Test Admin",
        role=UserRole.ADMIN.value,
        tenant_id=test_tenant.id,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()
    return admin


@pytest_asyncio.fixture
async def test_engineer(db_session: AsyncSession) -> User:
    """建立 engineer（最高權限）測試使用者"""
    engineer = User(
        id=str(uuid.uuid4()),
        email=f"engineer_{uuid.uuid4().hex[:6]}@test.com",
        password_hash=get_password_hash("Engineer123!"),
        name="Test Engineer",
        role=UserRole.ENGINEER.value,
        tenant_id=None,
        is_active=True,
    )
    db_session.add(engineer)
    await db_session.flush()
    return engineer


@pytest_asyncio.fixture
def user_auth_headers(test_user: User) -> dict:
    """產生一般使用者 Bearer Token Headers"""
    token = create_access_token({"sub": test_user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
def admin_auth_headers(test_admin: User) -> dict:
    """產生管理員 Bearer Token Headers"""
    token = create_access_token({"sub": test_admin.id})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
def engineer_auth_headers(test_engineer: User) -> dict:
    """產生 engineer Bearer Token Headers"""
    token = create_access_token({"sub": test_engineer.id})
    return {"Authorization": f"Bearer {token}"}
import asyncio
import pytest

@pytest.fixture(scope='session')
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
