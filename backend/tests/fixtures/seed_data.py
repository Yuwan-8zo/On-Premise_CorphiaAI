"""
測試種子資料生成器 (seed_data.py)

提供可重用的工廠函式，用於快速建立測試所需的資料庫記錄。

使用方式：
    from tests.fixtures.seed_data import create_test_user, create_test_conversation

    user = await create_test_user(db, role="admin")
    conv = await create_test_conversation(db, user_id=user.id)
"""

import uuid
from typing import Optional, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.tenant import Tenant
from app.models.user import User, UserRole
from app.models.conversation import Conversation
from app.models.document import Document


async def create_test_tenant(
    db: AsyncSession,
    *,
    name: str = "Test Tenant",
    slug: Optional[str] = None,
) -> Tenant:
    """
    建立測試用租戶

    Args:
        db: 資料庫 session
        name: 租戶顯示名稱
        slug: 租戶 slug（預設自動生成）

    Returns:
        Tenant: 建立的租戶物件
    """
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name=name,
        slug=slug or f"test-tenant-{uuid.uuid4().hex[:8]}",
    )
    db.add(tenant)
    await db.flush()
    return tenant


async def create_test_user(
    db: AsyncSession,
    *,
    role: Literal["user", "admin", "engineer"] = "user",
    email: Optional[str] = None,
    password: str = "TestPass123!",
    name: Optional[str] = None,
    tenant_id: Optional[str] = None,
    is_active: bool = True,
) -> User:
    """
    建立測試使用者

    Args:
        db: 資料庫 session
        role: 使用者角色（user / admin / engineer）
        email: 電子郵件（預設自動生成）
        password: 明文密碼（將被雜湊）
        name: 顯示名稱
        tenant_id: 所屬租戶 ID
        is_active: 是否啟用

    Returns:
        User: 建立的使用者物件
    """
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=str(uuid.uuid4()),
        email=email or f"{role}_{uid}@test.corphia.com",
        password_hash=get_password_hash(password),
        name=name or f"Test {role.capitalize()} {uid}",
        role=role,
        tenant_id=tenant_id,
        is_active=is_active,
    )
    db.add(user)
    await db.flush()
    return user


async def create_test_conversation(
    db: AsyncSession,
    *,
    user_id: str,
    tenant_id: Optional[str] = None,
    title: str = "Test Conversation",
    is_pinned: bool = False,
    is_archived: bool = False,
    folder_id: Optional[str] = None,
) -> Conversation:
    """
    建立測試對話

    Args:
        db: 資料庫 session
        user_id: 對話所屬使用者 ID
        tenant_id: 租戶 ID
        title: 對話標題
        is_pinned: 是否置頂
        is_archived: 是否封存
        folder_id: 所屬資料夾 ID

    Returns:
        Conversation: 建立的對話物件
    """
    conversation = Conversation(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id or "default",
        user_id=user_id,
        title=title,
        is_pinned=is_pinned,
        is_archived=is_archived,
        folder_id=folder_id,
    )
    db.add(conversation)
    await db.flush()
    return conversation


async def create_test_document(
    db: AsyncSession,
    *,
    tenant_id: str,
    user_id: str,
    filename: str = "test_document.txt",
    status: str = "ready",
) -> Document:
    """
    建立測試文件記錄（不實際上傳檔案）

    Args:
        db: 資料庫 session
        tenant_id: 租戶 ID
        user_id: 上傳者 ID
        filename: 原始檔名
        status: 文件處理狀態（pending / processing / ready / failed）

    Returns:
        Document: 建立的文件物件
    """
    document = Document(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        uploaded_by=user_id,
        original_filename=filename,
        stored_filename=f"{uuid.uuid4().hex}_{filename}",
        file_path=f"./test_uploads/{uuid.uuid4().hex}_{filename}",
        file_size=1024,
        mime_type="text/plain",
        status=status,
    )
    db.add(document)
    await db.flush()
    return document
