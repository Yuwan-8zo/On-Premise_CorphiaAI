"""
B2: 訊息審計 Hash 鏈服務

為每一則訊息計算 SHA-256 hash，並串接前一則訊息的 hash 形成鏈：
    content_hash = SHA256(prev_hash || role || content || created_at_iso)

用途：
- 合規稽核時驗證「對話記錄未被事後竄改」
- 口試報告中展示「地端 AI 的不可否認性機制」
"""

import hashlib
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.message import Message

logger = logging.getLogger(__name__)


def compute_message_hash(
    prev_hash: str,
    role: str,
    content: str,
    created_at_iso: str,
) -> str:
    """
    計算單一訊息的 content_hash

    Args:
        prev_hash: 前一則訊息的 content_hash（首則訊息用 "GENESIS"）
        role: 訊息角色 (user / assistant / system)
        content: 訊息原文
        created_at_iso: 建立時間的 ISO 8601 字串

    Returns:
        str: 64 字元的 hex digest
    """
    payload = f"{prev_hash}||{role}||{content}||{created_at_iso}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def get_latest_hash(
    db: AsyncSession,
    conversation_id: str,
) -> str:
    """
    取得某對話中最後一則訊息的 content_hash，若對話為空則回傳 GENESIS

    Args:
        db: 資料庫 session
        conversation_id: 對話 ID

    Returns:
        str: 最後一則的 content_hash 或 "GENESIS"
    """
    result = await db.execute(
        select(Message.content_hash)
        .where(Message.conversation_id == conversation_id)
        .where(Message.content_hash.isnot(None))
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    last_hash = result.scalar_one_or_none()
    return last_hash or "GENESIS"


async def _get_latest_hash_locked(
    db: AsyncSession,
    conversation_id: str,
) -> str:
    """
    跟 get_latest_hash 一樣，但用 SELECT ... FOR UPDATE 鎖定該列直到 transaction 結束。

    用途：stamp_message 內部使用，防止「兩個並發 stamp 拿到相同 prev_hash」破壞鏈。
    使用者開兩個 tab 對同一個 conversation 快速送訊息時，這個鎖才會發揮作用。
    """
    result = await db.execute(
        select(Message.content_hash)
        .where(Message.conversation_id == conversation_id)
        .where(Message.content_hash.isnot(None))
        .order_by(desc(Message.created_at))
        .limit(1)
        .with_for_update()  # ← row-level lock，並發 stamp 會排隊
    )
    last_hash = result.scalar_one_or_none()
    return last_hash or "GENESIS"


async def stamp_message(
    db: AsyncSession,
    message: Message,
    conversation_id: str,
) -> None:
    """
    為已建立的 Message 物件蓋上 hash stamp

    NOTE: 這個函式假設呼叫端會在適當時機 commit session。

    SECURITY: 使用 SELECT ... FOR UPDATE 確保「讀 prev_hash + 寫 new_hash」是原子操作，
    避免兩個並發請求拿到相同 prev_hash 造成鏈分岔。

    Args:
        db: 資料庫 session
        message: 已加入 session 但尚未(或剛)commit 的 Message 實例
        conversation_id: 對話 ID
    """
    prev_hash = await _get_latest_hash_locked(db, conversation_id)
    created_at_iso = message.created_at.isoformat() if message.created_at else ""
    content_hash = compute_message_hash(
        prev_hash=prev_hash,
        role=message.role,
        content=message.content,
        created_at_iso=created_at_iso,
    )
    message.prev_hash = prev_hash
    message.content_hash = content_hash


async def verify_chain(
    db: AsyncSession,
    conversation_id: str,
) -> dict:
    """
    驗證某對話的完整 Hash 鏈

    Returns:
        {
            "valid": bool,
            "total_messages": int,
            "first_broken_index": int | None,
            "first_broken_message_id": str | None,
        }
    """
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    expected_prev = "GENESIS"
    for idx, msg in enumerate(messages):
        # 沒有 hash 的舊訊息直接跳過
        if not msg.content_hash:
            continue

        # 前一則 hash 不符 → 鏈斷裂
        if msg.prev_hash != expected_prev:
            return {
                "valid": False,
                "total_messages": len(messages),
                "first_broken_index": idx,
                "first_broken_message_id": msg.id,
            }

        # 重算 hash 看是否被竄改
        created_at_iso = msg.created_at.isoformat() if msg.created_at else ""
        recalc = compute_message_hash(
            prev_hash=msg.prev_hash,
            role=msg.role,
            content=msg.content,
            created_at_iso=created_at_iso,
        )
        if recalc != msg.content_hash:
            return {
                "valid": False,
                "total_messages": len(messages),
                "first_broken_index": idx,
                "first_broken_message_id": msg.id,
            }

        expected_prev = msg.content_hash

    return {
        "valid": True,
        "total_messages": len(messages),
        "first_broken_index": None,
        "first_broken_message_id": None,
    }
