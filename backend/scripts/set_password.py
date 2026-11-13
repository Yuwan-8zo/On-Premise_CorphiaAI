"""
建立帳號或重設密碼（同時解除登入鎖定）

用法（在專案根目錄）：
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\set_password.py 信箱
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\set_password.py 信箱 --role admin --name 展示帳號

不加 --password 時會請你輸入新密碼（畫面不會顯示），最安全。
"""
import argparse
import asyncio
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select  # noqa: E402

from app.core.database import async_session_maker, init_db  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402


async def main() -> int:
    parser = argparse.ArgumentParser(description="建立帳號或重設密碼")
    parser.add_argument("email")
    parser.add_argument("--password", help="不建議：直接在指令裡給密碼（會留在指令紀錄）")
    parser.add_argument("--role", choices=[r.value for r in UserRole], default=None,
                        help="新帳號預設 user；已存在的帳號不填就維持原角色")
    parser.add_argument("--name", default=None)
    args = parser.parse_args()

    # 密碼的來源：參數（不建議）→ 環境變數 CORPHIA_NEW_PASSWORD（給設定精靈用：不會出現在指令紀錄裡）→ 請使用者輸入
    password = args.password or os.environ.get("CORPHIA_NEW_PASSWORD")
    if not password:
        password = getpass.getpass("請輸入新密碼：")
        if password != getpass.getpass("再輸入一次：") or not password:
            print("兩次輸入不一致或是空的，沒有變更。")
            return 1

    await init_db()
    async with async_session_maker() as session:
        user = (await session.execute(select(User).where(User.email == args.email))).scalar_one_or_none()
        if user:
            user.password_hash = get_password_hash(password)
            if args.role:
                user.role = args.role
            if args.name:
                user.name = args.name
            action = "已重設密碼"
        else:
            user = User(
                email=args.email,
                password_hash=get_password_hash(password),
                name=args.name or args.email.split("@")[0],
                role=args.role or UserRole.USER.value,
                is_active=True,
            )
            session.add(user)
            action = "已建立帳號"
        # 解除因多次輸錯造成的鎖定
        for field in ("failed_login_attempts",):
            if hasattr(user, field):
                setattr(user, field, 0)
        if hasattr(user, "locked_until"):
            user.locked_until = None
        user.is_active = True
        # 沒有租戶的帳號歸到 default（與註冊、對話、文件一致），否則看不到同租戶的稽核與使用者
        if hasattr(user, "tenant_id") and not user.tenant_id:
            # 預設組織的編號每台不一樣（初始化時產生），用代稱 default 找；找不到才用舊的固定編號
            default_tenant = (await session.execute(select(Tenant.id).where(Tenant.slug == "default"))).scalars().first()
            user.tenant_id = default_tenant or "default"
        await session.commit()
        print(f"{action}：{args.email}（角色：{user.role}）")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
