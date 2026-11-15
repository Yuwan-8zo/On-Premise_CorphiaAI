"""
每個人自己選的 AI 模型（個人設定，不影響其他人）

- 存在 user_settings.preferences["model"]（jsonb，模型檔名長度不受欄位限制）
- 沒選過、或選的模型檔已經不在 ai_model/ 裡：用系統預設（model_manager 目前的模型）
- 生成回答時由 ChatService 帶著這個名稱去用對應的模型（LLMService 會把載入過的模型留在記憶體）
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_settings import UserSettings
from app.services.model_manager import get_model_manager

PREF_KEY = "model"


def resolve_model_name(name: Optional[str]) -> Optional[str]:
    """名稱存在就用它，否則用系統預設"""
    manager = get_model_manager()
    if name and manager.get_model(name) is not None:
        return name
    return manager._current_model


async def get_user_model(db: AsyncSession, user_id: str) -> Optional[str]:
    """這個人實際要用的模型名稱（個人選擇 → 系統預設）"""
    prefs = (await db.execute(select(UserSettings.preferences).where(UserSettings.user_id == user_id))).scalar_one_or_none()
    return resolve_model_name((prefs or {}).get(PREF_KEY))


async def set_user_model(db: AsyncSession, user_id: str, name: str) -> None:
    """記住這個人選的模型（呼叫前要先確認模型存在）"""
    row = (await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))).scalar_one_or_none()
    if row is None:
        row = UserSettings(user_id=user_id, preferences={PREF_KEY: name})
        db.add(row)
    else:
        # jsonb 要換一個新的 dict，SQLAlchemy 才知道內容變了
        row.preferences = {**(row.preferences or {}), PREF_KEY: name}
    await db.commit()
