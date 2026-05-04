"""
資料庫初始化腳本

建立資料表並新增預設資料
"""

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 添加專案根目錄到 Python 路徑
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine, Base, async_session_maker
from app.core.security import get_password_hash
from app.models import Tenant, User, UserRole


async def init_database():
    """初始化資料庫"""
    print("🔧 開始初始化資料庫...")
    
    # 建立所有資料表
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ 資料表建立完成")
    
    # 建立預設資料
    async with async_session_maker() as session:
        # 檢查是否已有資料
        from sqlalchemy import select
        result = await session.execute(select(Tenant))
        if result.scalar_one_or_none():
            print("ℹ️  資料庫已有資料，跳過初始化")
            return
        
        # 建立預設租戶
        default_tenant = Tenant(
            name="預設組織",
            slug="default",
            description="系統預設租戶",
            settings={
                "allow_user_upload": True,
                "max_documents": 100,
                "max_conversations": 1000,
            }
        )
        session.add(default_tenant)
        await session.flush()
        
        print(f"✅ 建立預設租戶: {default_tenant.name}")
        
        # 建立預設帳號
        users = [
            User(
                email="engineer@local",
                password_hash=get_password_hash("Engineer123!"),
                name="系統工程師",
                role=UserRole.ENGINEER.value,
                tenant_id=None,  # Engineer 不屬於任何租戶
            ),
            User(
                email="admin@local",
                password_hash=get_password_hash("Admin123!"),
                name="管理員",
                role=UserRole.ADMIN.value,
                tenant_id=default_tenant.id,
            ),
            User(
                email="user@local",
                password_hash=get_password_hash("User123!"),
                name="測試使用者",
                role=UserRole.USER.value,
                tenant_id=default_tenant.id,
            ),
        ]
        
        for user in users:
            session.add(user)
            print(f"✅ 建立使用者: {user.email} ({user.role})")
        
        await session.commit()
    
    print("🎉 資料庫初始化完成!")
    print("")
    print("📋 預設帳號:")
    print("  - engineer@local / Engineer123! (系統管理員)")
    print("  - admin@local / Admin123! (租戶管理員)")
    print("  - user@local / User123! (一般使用者)")


if __name__ == "__main__":
    asyncio.run(init_database())
