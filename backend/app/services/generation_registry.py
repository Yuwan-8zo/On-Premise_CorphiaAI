"""
正在回答中的對話（整個後端共用一份）

同一個對話同一時間只能有一個回答在寫：
  - 兩個視窗（或兩台裝置）開同一個對話同時送出，兩個回答會搶著接在同一則訊息後面，
    訊息順序和防竄改的雜湊鏈都會壞掉——所以第二個要被擋下來
  - 對話被刪掉時，還在寫的回答要先停下來，不然它寫完要存檔時對話已經不在了
"""
import asyncio
from typing import Optional

# 這段時間內回答沒停下來就不再等（刪除對話時用）
CANCEL_WAIT_SEC = 5.0

_active: dict[str, asyncio.Task] = {}


def is_generating(conversation_id: str) -> bool:
    task = _active.get(conversation_id)
    return task is not None and not task.done()


def register(conversation_id: str, task: asyncio.Task) -> None:
    """登記這個對話的回答；回答結束（寫完、停止、出錯）自動移除"""
    _active[conversation_id] = task

    def _forget(done: asyncio.Task) -> None:
        if _active.get(conversation_id) is done:
            del _active[conversation_id]

    task.add_done_callback(_forget)


async def cancel(conversation_id: str) -> bool:
    """停掉這個對話正在寫的回答並等它收尾；回傳原本有沒有在寫"""
    task: Optional[asyncio.Task] = _active.get(conversation_id)
    if task is None or task.done():
        return False
    task.cancel()
    await asyncio.wait({task}, timeout=CANCEL_WAIT_SEC)
    return True


def active_count() -> int:
    return sum(1 for task in _active.values() if not task.done())
