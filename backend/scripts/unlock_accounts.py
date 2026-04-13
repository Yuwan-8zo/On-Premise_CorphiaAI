"""
解鎖所有被鎖定的帳號，並重置登入失敗計數
用於開發/測試環境快速清除錯誤鎖定狀態
"""
import asyncio
import sys
import os

# 加入專案根目錄到 sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update
from app.core.database import async_session_maker, init_db
from app.models.user import User


async def unlock_all() -> None:
    await init_db()
    async with async_session_maker() as session:
        # 查詢所有有鎖定紀錄或失敗計數的帳號
        result = await session.execute(
            select(User).where(
                (User.locked_until != None) | (User.failed_login_attempts > 0)
            )
        )
        users = result.scalars().all()

        if not users:
            print("[OK] No locked accounts found.")
            return

        for user in users:
            print(f"[UNLOCK] {user.email} "
                  f"(failed={user.failed_login_attempts}, "
                  f"locked_until={user.locked_until})")
            user.failed_login_attempts = 0
            user.locked_until = None

        await session.commit()
        print(f"\n[DONE] Unlocked {len(users)} account(s). All failure counts reset.")


if __name__ == "__main__":
    asyncio.run(unlock_all())
