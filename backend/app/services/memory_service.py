"""
記憶：跨對話記住使用者交代的事

規則（第一版，全部是「使用者明講」才記，不讓模型自己猜）：
  - 對話裡說「記住……／請記得……／remember that …／覚えて…」→ 存成一則記憶，並告訴前端「已記住」
  - 設定頁可以手動新增、修改、刪除、全部清除、整個關掉
  - 每個人最多 MAX_ITEMS 則、每則 MAX_CHARS 字；回答前把最新的幾則放進系統提示（PROMPT_CHARS 字以內，
    提示詞越長回答越慢）
  - 記憶只屬於自己的帳號；新增、修改、刪除都寫稽核
  - 內容是使用者寫的，放進系統提示前一樣要拿掉模型的控制字元（不能靠記憶改寫系統指令）

開關存在 user_settings.preferences["memory_enabled"]（預設開）。

同一頁的「回答風格」也在這裡（個人化設定都放一起）：每個人選一種，回答前加一句風格說明到系統提示。
存在 user_settings.preferences["reply_style"]；沒選＝預設（不加任何說明）。

「指示」（照 Claude.ai 的個人化設定）：使用者貼一整段固定的指示（語氣、回答規則……），套用到所有對話。
跟上面的「記住……」短記憶不同——這是使用者自己寫好、整段貼上的，不是從對話裡自動擷取的。
存在 user_settings.preferences["custom_instructions"]，同樣先過安全檢查才存（api/memories.py 做）。
"""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_memory import MemorySource, UserMemory
from app.models.user_settings import UserSettings

MAX_ITEMS = 50
MAX_CHARS = 300
PROMPT_CHARS = 800
PREF_KEY = "memory_enabled"
STYLE_KEY = "reply_style"
STYLE_DEFAULT = "default"
INSTRUCTIONS_KEY = "custom_instructions"
MAX_INSTRUCTIONS_CHARS = 3000
# 風格 → 加在系統提示後面的說明（預設不加）
STYLE_DIRECTIVES: dict[str, str] = {
    "concise": "回答風格：精簡。先講結論，能用三句話說完就不要多寫，不要客套話和重複使用者的問題。",
    "detailed": "回答風格：詳細。把原因和做法分步驟說清楚，必要時舉一個例子。",
    "formal": "回答風格：正式。用商務書信的語氣，不用口語、表情符號和驚嘆號。",
}
STYLES = (STYLE_DEFAULT, *STYLE_DIRECTIVES)

# 「記住……」的說法（句首；前面可以有「請／幫我／麻煩你」）
_REMEMBER_RES = [
    re.compile(r"^\s*(?:請|麻煩)?(?:你)?(?:幫我)?(?:要)?(?:記住|記下來|記下|記一下|記得)[，,：:\s]*(?P<body>.+)$", re.S),
    re.compile(r"^\s*(?:please\s+)?remember(?:\s+that)?[,:\s]+(?P<body>.+)$", re.I | re.S),
    re.compile(r"^\s*(?P<body>.+?)(?:を|って|と)?(?:覚えて(?:おいて)?(?:ください|ね)?)[。.!！\s]*$", re.S),
]


class MemoryLimitError(Exception):
    """記憶已經到上限"""


def clean_content(text: str) -> str:
    """整理成一行、去頭尾標點空白、限制長度"""
    s = re.sub(r"\s+", " ", (text or "")).strip().strip("。.!！ ")
    return s[:MAX_CHARS]


def extract_remember(text: str) -> Optional[str]:
    """這句話是不是在交代「記住……」；是就回要記的內容，不是回 None"""
    for rx in _REMEMBER_RES:
        m = rx.match(text or "")
        if m:
            body = clean_content(m.group("body"))
            # 太短（「記住」「記得嗎」）不算
            return body if len(body) >= 2 and not body.endswith(("嗎", "嗎?", "嗎？", "?", "？")) else None
    return None


async def is_enabled(db: AsyncSession, user_id: str) -> bool:
    prefs = (await db.execute(select(UserSettings.preferences).where(UserSettings.user_id == user_id))).scalar_one_or_none()
    return bool((prefs or {}).get(PREF_KEY, True))


async def set_enabled(db: AsyncSession, user_id: str, enabled: bool) -> None:
    await _set_pref(db, user_id, PREF_KEY, enabled)


async def _prefs(db: AsyncSession, user_id: Optional[str]) -> dict:
    if not user_id:
        return {}
    return (await db.execute(select(UserSettings.preferences).where(UserSettings.user_id == user_id))).scalar_one_or_none() or {}


async def _set_pref(db: AsyncSession, user_id: str, key: str, value) -> None:
    row = (await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))).scalar_one_or_none()
    if row is None:
        db.add(UserSettings(user_id=user_id, preferences={key: value}))
    else:
        # jsonb 要換一個新的 dict，SQLAlchemy 才知道內容變了
        row.preferences = {**(row.preferences or {}), key: value}
    await db.commit()


async def get_style(db: AsyncSession, user_id: Optional[str]) -> str:
    style = (await _prefs(db, user_id)).get(STYLE_KEY)
    return style if style in STYLES else STYLE_DEFAULT


async def set_style(db: AsyncSession, user_id: str, style: str) -> None:
    """呼叫前要先確認 style 在 STYLES 裡"""
    await _set_pref(db, user_id, STYLE_KEY, style)


async def style_directive(db: AsyncSession, user_id: Optional[str]) -> str:
    """加在系統提示後面的風格說明；預設風格回空字串"""
    return STYLE_DIRECTIVES.get(await get_style(db, user_id), "")


async def get_custom_instructions(db: AsyncSession, user_id: Optional[str]) -> str:
    text = (await _prefs(db, user_id)).get(INSTRUCTIONS_KEY)
    return text if isinstance(text, str) else ""


async def set_custom_instructions(db: AsyncSession, user_id: str, text: str) -> None:
    """呼叫前要先過安全檢查、裁到 MAX_INSTRUCTIONS_CHARS（api/memories.py 做）"""
    await _set_pref(db, user_id, INSTRUCTIONS_KEY, text)


async def custom_instructions_block(db: AsyncSession, user_id: Optional[str]) -> str:
    """加在系統提示的那一段；沒設定就回空字串。放在最前面，比風格、記憶都優先（跟 Claude.ai 一樣，
    指示是使用者對「這個助理整體該怎麼表現」的設定，不是單一事實）"""
    if not user_id:
        return ""
    text = await get_custom_instructions(db, user_id)
    if not text:
        return ""
    from app.services.llm_service import _sanitize_chatml_content

    return "### 使用者的個人化指示（套用在所有對話）\n" + _sanitize_chatml_content(text)


async def list_memories(db: AsyncSession, user_id: str) -> list[UserMemory]:
    """新的在前"""
    rows = await db.execute(select(UserMemory).where(UserMemory.user_id == user_id).order_by(UserMemory.created_at.desc()))
    return list(rows.scalars().all())


async def add_memory(db: AsyncSession, user_id: str, content: str, source: str = MemorySource.MANUAL, conversation_id: Optional[str] = None) -> tuple[UserMemory, bool]:
    """
    新增一則記憶。回（記憶, 是不是新的）：內容一模一樣的不重複存。
    到上限丟 MemoryLimitError（請使用者先刪幾則，不偷偷把舊的擠掉）。
    """
    text = clean_content(content)
    if not text:
        raise ValueError("記憶內容不能是空的")
    same = (await db.execute(select(UserMemory).where(UserMemory.user_id == user_id, UserMemory.content == text))).scalars().first()
    if same:
        return same, False
    count = (await db.execute(select(func.count()).select_from(UserMemory).where(UserMemory.user_id == user_id))).scalar_one()
    if count >= MAX_ITEMS:
        raise MemoryLimitError()
    row = UserMemory(user_id=user_id, content=text, source=source, conversation_id=conversation_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row, True


async def get_memory(db: AsyncSession, user_id: str, memory_id: str) -> Optional[UserMemory]:
    return (await db.execute(select(UserMemory).where(UserMemory.id == memory_id, UserMemory.user_id == user_id))).scalar_one_or_none()


async def clear_memories(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(delete(UserMemory).where(UserMemory.user_id == user_id))
    await db.commit()
    return result.rowcount or 0


async def memory_block(db: AsyncSession, user_id: Optional[str]) -> str:
    """放進系統提示的那一段；沒有記憶或關掉了回空字串"""
    if not user_id or not await is_enabled(db, user_id):
        return ""
    from app.services.llm_service import _sanitize_chatml_content

    lines: list[str] = []
    used = 0
    for m in await list_memories(db, user_id):
        line = "- " + _sanitize_chatml_content(m.content)
        if used + len(line) > PROMPT_CHARS:
            break
        lines.append(line)
        used += len(line)
    if not lines:
        return ""
    return "### 使用者請你記住的事（跨對話的記憶；和問題有關才用，不要主動複述）\n" + "\n".join(lines)
