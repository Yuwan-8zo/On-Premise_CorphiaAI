"""
AI 產出檔案的儲存與權限（內容怎麼排版在 file_builder.py）

  save_file          把檔案寫到磁碟（<generated_files_dir>/<使用者>/<檔案 id>.<副檔名>）並記一列
  get_for_user       只有產生它的人拿得到（別人一律當作不存在）
  attach_to_messages 把每則訊息的檔案掛到訊息上（回給前端的 attachments）
  cleanup_orphans    啟動時清掉資料庫已經沒有紀錄的檔案（訊息、對話被刪掉後留下的）
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.generated_file import GeneratedFile
from app.services.file_builder import safe_filename

logger = logging.getLogger(__name__)


def base_dir() -> Path:
    return Path(settings.generated_files_dir).resolve()


def file_path(row: GeneratedFile) -> Path:
    return base_dir() / row.user_id / f"{row.id}.{row.kind}"


def to_attachment(row: GeneratedFile) -> dict:
    return {"id": row.id, "filename": row.filename, "kind": row.kind, "size": row.size}


async def save_file(
    db: AsyncSession, *, user_id: str, tenant_id: Optional[str], conversation_id: Optional[str],
    message_id: Optional[str], kind: str, title: str, data: bytes,
) -> GeneratedFile:
    row = GeneratedFile(
        user_id=user_id, tenant_id=tenant_id, conversation_id=conversation_id, message_id=message_id,
        kind=kind, filename=safe_filename(title, kind), size=len(data),
    )
    db.add(row)
    await db.flush()  # 先拿到 id 才知道磁碟上的檔名
    path = file_path(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    await db.commit()
    await db.refresh(row)
    return row


async def get_for_user(db: AsyncSession, user_id: str, file_id: str) -> Optional[GeneratedFile]:
    return (await db.execute(select(GeneratedFile).where(GeneratedFile.id == file_id, GeneratedFile.user_id == user_id))).scalar_one_or_none()


async def attach_to_messages(db: AsyncSession, messages: Iterable) -> None:
    """在每則訊息物件上加 attachments（沒有檔案的訊息不加，回應裡就是 null）"""
    messages = list(messages)
    ids = [m.id for m in messages]
    if not ids:
        return
    rows = (await db.execute(select(GeneratedFile).where(GeneratedFile.message_id.in_(ids)).order_by(GeneratedFile.created_at))).scalars().all()
    by_message: dict[str, list[dict]] = {}
    for row in rows:
        by_message.setdefault(row.message_id, []).append(to_attachment(row))
    for m in messages:
        if m.id in by_message:
            m.attachments = by_message[m.id]


async def cleanup_orphans(db: AsyncSession) -> int:
    """磁碟上有、資料庫沒有的檔案：刪掉（只動自己這個資料夾裡、檔名是「id.副檔名」的檔案）"""
    root = base_dir()
    if not root.is_dir():
        return 0
    known = set((await db.execute(select(GeneratedFile.id))).scalars().all())
    removed = 0
    for path in root.glob("*/*.*"):
        if path.is_file() and path.stem not in known:
            try:
                path.unlink()
                removed += 1
            except OSError as e:
                logger.warning("清不掉產出檔 %s: %s", path, e)
    return removed
