"""
Phase 4（B 系列）資料庫遷移腳本

新增欄位：
  - users.daily_message_limit  (INT DEFAULT 100)
  - messages.content_hash      (VARCHAR(64))
  - messages.prev_hash         (VARCHAR(64))
  - documents.version          (INT DEFAULT 1)
  - documents.superseded_by    (VARCHAR(36) FK → documents.id)

執行方式：
  python -m app.migrations.phase4_governance

NOTE: 使用 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 語法，
      已存在的欄位會被安全跳過，可重複執行。
"""

import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STATEMENTS = [
    # B1: 使用者每日配額
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER NOT NULL DEFAULT 100;
    """,
    # B2: 審計 Hash 鏈
    """
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
    """,
    """
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);
    """,
    # B3: 文件版本化
    """
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    """,
    """
    ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS superseded_by VARCHAR(36)
    REFERENCES documents(id) ON DELETE SET NULL;
    """,
]


async def run_migration():
    """執行 Phase 4 遷移"""
    from app.core.database import engine

    logger.info("⏳ Phase 4 Governance 遷移開始...")

    async with engine.begin() as conn:
        for i, stmt in enumerate(STATEMENTS, 1):
            try:
                await conn.execute(
                    # text() 是 asyncpg 必備的
                    __import__("sqlalchemy").text(stmt.strip())
                )
                logger.info(f"  [{i}/{len(STATEMENTS)}] ✅ 完成")
            except Exception as e:
                # 如果欄位已存在（duplicate column），繼續跑
                err_msg = str(e).lower()
                if "already exists" in err_msg or "duplicate column" in err_msg:
                    logger.info(f"  [{i}/{len(STATEMENTS)}] ⏭️ 欄位已存在，跳過")
                else:
                    logger.error(f"  [{i}/{len(STATEMENTS)}] ❌ 失敗: {e}")
                    raise

    logger.info("✅ Phase 4 Governance 遷移完成！")


if __name__ == "__main__":
    asyncio.run(run_migration())
