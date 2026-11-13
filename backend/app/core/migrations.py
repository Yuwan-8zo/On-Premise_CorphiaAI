"""
資料庫升級：系統更新後，把「已經存在的資料表」改成新版需要的樣子

為什麼需要：啟動時的 create_all 只會「建立還沒有的資料表」，不會幫舊資料表加欄位。
功能更新如果要在舊資料表多一個欄位，沒有這一步的話，舊安裝的系統一更新就會出錯（找不到欄位）。

做法（刻意保持簡單，不引入額外工具）：
  - MIGRATIONS 是一串依序執行的步驟，每一步有固定的名稱和幾句 SQL
  - schema_migrations 資料表記「哪些步驟做過了」；每次啟動只做還沒做過的，各自包在一筆交易裡
  - SQL 一律寫成可以重複執行的（ADD COLUMN IF NOT EXISTS…）：就算紀錄不見了，重跑也不會壞

新增步驟的規則：
  1. 只能在清單「最後面」加，不可以改或刪已經發布的步驟（別人的資料庫可能已經做過了）
  2. 名稱用「日期-做什麼」，例如 2026-11-13-folder-instructions
  3. 只做加法（加欄位、加索引、補預設值）；要刪欄位、改型別請分兩版做，先確定沒有程式在用
  4. 對應的 model 也要同步加上欄位（新安裝的系統靠 create_all 一次建好，不會跑到這裡的 ALTER）
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger(__name__)

MIGRATIONS: list[tuple[str, list[str]]] = [
    # 專案資料夾的自訂指示（每個專案給 AI 的固定說明）
    ("2026-11-13-folder-instructions", ["ALTER TABLE folders ADD COLUMN IF NOT EXISTS instructions TEXT"]),
    # 回答的思考過程、有沒有連外網的紀錄（重新整理後還看得到）
    ("2026-11-13-message-reasoning-web-search", [
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning TEXT",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS web_search JSONB",
    ]),
    # 對話分支：每則訊息記著接在哪一則後面；原本的對話是一直線，照寫入順序接起來
    ("2026-11-14-message-parent", [
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id VARCHAR(36)",
        "CREATE INDEX IF NOT EXISTS ix_messages_parent_id ON messages (parent_id)",
        """UPDATE messages m SET parent_id = p.prev_id
           FROM (SELECT id, LAG(id) OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS prev_id FROM messages) p
           WHERE m.id = p.id AND m.parent_id IS NULL AND p.prev_id IS NOT NULL""",
    ]),
]


async def run_migrations(engine: AsyncEngine) -> list[str]:
    """做完還沒做過的升級步驟；回傳這次做了哪些"""
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT now())"
        ))
        done = set((await conn.execute(text("SELECT id FROM schema_migrations"))).scalars().all())
    applied: list[str] = []
    for name, statements in MIGRATIONS:
        if name in done:
            continue
        # 每一步自己一筆交易：中途失敗就整步退回，不會留下做一半的狀態
        async with engine.begin() as conn:
            for sql in statements:
                await conn.execute(text(sql))
            await conn.execute(text("INSERT INTO schema_migrations (id) VALUES (:id) ON CONFLICT (id) DO NOTHING"), {"id": name})
        applied.append(name)
        logger.info("資料庫升級完成：%s", name)
    return applied
