import json
import os
import asyncio
import sys

# Add backend directory to path before importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, init_db

# Ensure all models are imported so create_all works
import app.models.user
import app.models.conversation
import app.models.message
import app.models.document
import app.models.document_chunk

from datetime import datetime

def parse_dt(dt_str):
    if not dt_str:
        return None
    # Python 3.11+ fromisoformat handles space-separated and microseconds correctly
    return datetime.fromisoformat(dt_str)

# Ensure initialization happens
async def restore_users():
    dump_path = r"C:\Users\ngu94\.gemini\antigravity\brain\29950927-b595-4a50-9c7b-b51a34e80738\scratch\users_dump.json"
    
    if not os.path.exists(dump_path):
        print(f"找不到備份檔: {dump_path}")
        return

    with open(dump_path, "r", encoding="utf-8") as f:
        users = json.load(f)

    if not users:
        print("備份檔沒有用戶資料。")
        return

    # 先初始化資料庫與資料表
    await init_db()

    async with engine.begin() as conn:
        # Insert dummy tenant to satisfy foreign key constraints
        await conn.execute(text("""
            INSERT INTO tenants (id, name, slug, settings, is_active, created_at, updated_at) 
            VALUES ('c737975d-d8db-4ca9-ab60-c38b995a5592', '預設組織', 'default', '{}', true, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """))
        
        for user in users:
            # Check if user already exists
            res = await conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": user["email"]})
            if res.scalar() is None:
                print(f"還原使用者: {user['email']}")
                stmt = text("""
                    INSERT INTO users (id, email, password_hash, name, avatar_url, role, is_active, last_login_at, token_revoked_at, failed_login_attempts, locked_until, created_at, updated_at, tenant_id)
                    VALUES (:id, :email, :password_hash, :name, :avatar_url, :role, :is_active, :last_login_at, :token_revoked_at, :failed_login_attempts, :locked_until, :created_at, :updated_at, :tenant_id)
                """)
                await conn.execute(stmt, {
                    "id": user["id"],
                    "email": user["email"],
                    "password_hash": user.get("password_hash", ""),
                    "name": user.get("name", ""),
                    "avatar_url": user.get("avatar_url"),
                    "role": user.get("role", "user"),
                    "is_active": bool(user.get("is_active", 1)),
                    "last_login_at": parse_dt(user.get("last_login_at")),
                    "token_revoked_at": None,
                    "failed_login_attempts": int(user.get("failed_login_attempts", 0)),
                    "locked_until": None,
                    "created_at": parse_dt(user.get("created_at")),
                    "updated_at": parse_dt(user.get("updated_at")),
                    "tenant_id": user.get("tenant_id")
                })
        
    print("使用者還原完成！")

if __name__ == "__main__":
    asyncio.run(restore_users())
