"""
對話分支 (message_tree.py)

修改之前的問題、或請 AI 重答時，舊的那一版不刪也不改，新的版本接在同一個位置旁邊；
畫面上可以用「‹ 2/3 ›」切換要看哪一版，之後的對話接在所選的那一版後面。

資料長這樣：每則訊息記著自己接在哪一則後面（parent_id）。
  同一則後面、同一種角色的好幾則＝同一個位置的不同版本（兄弟）。
  對話記著「現在看到的最後一則」（settings.leaf_id）；從它往上走到頭，就是畫面上這一條對話。

對稽核的意義：以前「修改後重送」會改寫原本的訊息並刪掉後面的回答，防竄改雜湊鏈在那裡就斷了。
現在訊息只增不改，雜湊鏈照寫入順序一路接下去，每一版都留著、都驗得過。
"""

from __future__ import annotations

from typing import Iterable, Optional, Sequence

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message

# 對話設定裡記「現在看到的最後一則」的欄位名
LEAF_KEY = "leaf_id"


async def load_all(db: AsyncSession, conversation_id: str) -> list[Message]:
    """這個對話的所有訊息（每一版都在），照寫入順序"""
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at, Message.id)
    )
    return list(result.scalars().all())


def active_path(messages: Sequence[Message], leaf_id: Optional[str]) -> list[Message]:
    """
    畫面上這一條對話（由舊到新）：從 leaf_id 往上走到頭。
    沒有記 leaf_id、或它指的訊息不在了：用最後寫入的那一則（舊對話就是原本的樣子）。
    """
    if not messages:
        return []
    by_id = {m.id: m for m in messages}
    current = by_id.get(leaf_id or "") or messages[-1]
    path: list[Message] = []
    seen: set[str] = set()
    while current is not None and current.id not in seen:
        seen.add(current.id)  # 資料壞掉繞成圈時不會跑不完
        path.append(current)
        current = by_id.get(current.parent_id or "")
    path.reverse()
    return path


def versions(messages: Iterable[Message]) -> dict[str, list[str]]:
    """每則訊息 → 和它同一個位置的所有版本（照寫入順序，包含自己）"""
    groups: dict[tuple[Optional[str], str], list[str]] = {}
    for m in messages:
        groups.setdefault((m.parent_id, m.role), []).append(m.id)
    return {mid: ids for ids in groups.values() for mid in ids}


def deepest_leaf(messages: Sequence[Message], start_id: str) -> str:
    """從某一則往下走到底：每一層都挑最後寫入的那一則（切換版本後，顯示那一版底下最新的內容）"""
    newest_child: dict[str, str] = {}
    for m in messages:  # 照寫入順序，後面的蓋掉前面的
        if m.parent_id:
            newest_child[m.parent_id] = m.id
    current, seen = start_id, set()
    while current in newest_child and current not in seen:
        seen.add(current)
        current = newest_child[current]
    return current


async def get_leaf_id(db: AsyncSession, conversation_id: str) -> Optional[str]:
    settings = (await db.execute(select(Conversation.settings).where(Conversation.id == conversation_id))).scalar_one_or_none()
    return (settings or {}).get(LEAF_KEY)


async def set_leaf_id(db: AsyncSession, conversation_id: str, leaf_id: str) -> None:
    """記下「現在看到的最後一則」（只改這一個設定，其他設定原樣留著）；呼叫端負責 commit"""
    settings = (await db.execute(select(Conversation.settings).where(Conversation.id == conversation_id))).scalar_one_or_none()
    await db.execute(
        update(Conversation).where(Conversation.id == conversation_id)
        .values(settings={**(settings or {}), LEAF_KEY: leaf_id})
        .execution_options(synchronize_session=False)
    )


async def current_path(db: AsyncSession, conversation_id: str) -> tuple[list[Message], list[Message]]:
    """回傳（畫面上這一條對話, 所有訊息）"""
    messages = await load_all(db, conversation_id)
    return active_path(messages, await get_leaf_id(db, conversation_id)), messages


__all__ = ["LEAF_KEY", "load_all", "active_path", "versions", "deepest_leaf", "get_leaf_id", "set_leaf_id", "current_path"]
