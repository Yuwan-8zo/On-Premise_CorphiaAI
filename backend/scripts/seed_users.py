"""
建立預設使用者帳號腳本
"""
import asyncio
import sys
import os

# 加入專案根目錄到 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import async_session_maker, init_db
from app.models.user import User, UserRole
from app.core.security import get_password_hash

USERS_TO_CREATE = [
    {
        "email": "engineer@gmail.com",
        "password": "Engineer123",
        "name": "Engineer",
        "role": UserRole.ENGINEER.value,
    },
    {
        "email": "admin@gmail.com",
        "password": "Admin123",
        "name": "Admin",
        "role": UserRole.ADMIN.value,
    },
    {
        "email": "user@gmail.com",
        "password": "User123",
        "name": "User",
        "role": UserRole.USER.value,
    },
    {
        "email": "ngu940820@gmail.com",
        "password": "940820Ngu",
        "name": "Ngu",
        "role": UserRole.ENGINEER.value,
    }
]

async def seed_users():
    await init_db()
    async with async_session_maker() as session:
        for user_data in USERS_TO_CREATE:
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"[INFO] 帳號 {user_data['email']} 已存在，更新密碼與身分...")
                existing_user.password_hash = get_password_hash(user_data["password"])
                existing_user.role = user_data["role"]
                existing_user.name = user_data["name"]
            else:
                print(f"[INFO] 建立新帳號 {user_data['email']}...")
                new_user = User(
                    email=user_data["email"],
                    password_hash=get_password_hash(user_data["password"]),
                    name=user_data["name"],
                    role=user_data["role"],
                    is_active=True
                )
                session.add(new_user)
        
        await session.commit()
        print("[SUCCESS] 帳號建立/更新完成。")

if __name__ == "__main__":
    asyncio.run(seed_users())
