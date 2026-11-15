"""
連接資料夾的掃描與建立索引

每個連接資料夾：
  1. 走過資料夾（規則同 folder_source.walk_folder），和上次記下的檔案比對
       新檔案 → 建一筆文件紀錄，排隊建立索引
       修改過（大小或修改時間不同）→ 舊的段落刪掉，重新建立索引
       不見了 → 文件紀錄和段落刪掉
  2. 一個一個建立索引（解析、分段、向量化，沿用 DocumentService.process_document）
  3. 更新資料夾的狀態、檔案數、大小、上次更新時間

不會動到原本的檔案：只讀取；文件紀錄的 file_path 指向原檔，刪除紀錄時也不刪檔
（一般「刪除文件」會刪掉上傳的檔案，所以 documents API 擋掉資料夾來的文件，見 lookups.ensure_can_modify_document）。

文件紀錄怎麼認出是資料夾來的：doc_metadata = {source: "folder", folder_id, rel_path, mtime, size}

排程：folder_scan_loop() 在 app 啟動時開始，每分鐘看一次哪些資料夾到時間了；
後台按「立即更新」或新增、修改資料夾時用 request_scan() 馬上排一次。一次只掃一個資料夾（CPU 留給回答問題）。
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from sqlalchemy import delete, func, select

from app.core.time_utils import utc_now_naive
from app.models.connected_folder import ConnectedFolder, FolderStatus
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk

logger = logging.getLogger(__name__)

SOURCE = "folder"
# 排程多久看一次（秒）；每個資料夾實際多久掃一次看它自己的 scan_interval_min
LOOP_SECONDS = 60
# 一次只掃一個資料夾
_scan_lock = asyncio.Lock()
# 已經排隊等著掃、正在掃的資料夾（同一個不重複排）
_queued: set[str] = set()
_running: set[str] = set()


def folder_doc_filter(folder_id: str):
    """SQL 條件：這個連接資料夾的文件"""
    return Document.doc_metadata["folder_id"].astext == folder_id


def is_folder_document(doc: Document) -> bool:
    return (doc.doc_metadata or {}).get("source") == SOURCE


async def _uploader_for(db, folder: ConnectedFolder) -> str | None:
    """文件紀錄一定要有上傳者：用連接這個資料夾的管理員；他的帳號被刪了就找同租戶的任一管理員"""
    if folder.created_by:
        return folder.created_by
    from app.models.user import User, UserRole

    row = (await db.execute(
        select(User.id).where(User.tenant_id == folder.tenant_id, User.role.in_([UserRole.ADMIN.value, UserRole.ENGINEER.value])).limit(1)
    )).scalar_one_or_none()
    return row


async def folder_progress(db) -> dict[str, dict[str, int]]:
    """每個連接資料夾：已建好索引、失敗、等待中的檔案數（後台顯示進度用）"""
    # 取出每份資料夾文件的（資料夾, 狀態）在這裡數：JSON 欄位的運算式放進 GROUP BY，資料庫會當成和 SELECT 的不同而拒絕
    rows = (await db.execute(
        select(Document.doc_metadata["folder_id"].astext, Document.status)
        .where(Document.doc_metadata["source"].astext == SOURCE)
    )).all()
    counts: dict[tuple[str, str], int] = {}
    for fid, st in rows:
        counts[(fid, st)] = counts.get((fid, st), 0) + 1
    out: dict[str, dict[str, int]] = {}
    for (fid, st), n in counts.items():
        d = out.setdefault(fid, {"indexed": 0, "failed": 0, "waiting": 0})
        if st == DocumentStatus.COMPLETED.value:
            d["indexed"] += n
        elif st == DocumentStatus.FAILED.value:
            d["failed"] += n
        else:
            d["waiting"] += n
    return out


async def delete_folder_documents(db, folder_id: str) -> None:
    """取消連接：這個資料夾的文件紀錄和段落全部刪掉（原檔不動）"""
    ids = select(Document.id).where(folder_doc_filter(folder_id))
    await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_(ids)))
    await db.execute(delete(Document).where(folder_doc_filter(folder_id)))


async def scan_folder(folder_id: str) -> None:
    """掃一個資料夾：比對檔案、更新文件紀錄、把需要的檔案建立索引（一次只掃一個）"""
    async with _scan_lock:
        _queued.discard(folder_id)
        _running.add(folder_id)
        try:
            await _scan(folder_id)
        finally:
            _running.discard(folder_id)


async def _scan(folder_id: str) -> None:
    from app.core.database import async_session_maker
    from app.services.document_service import DocumentService
    from app.services.folder_source import validate_folder_path, walk_folder

    async with async_session_maker() as db:
        folder = await db.get(ConnectedFolder, folder_id)
        if folder is None or not folder.is_enabled:
            return
        # 路徑還在、還符合安全規則嗎（資料夾被移走、權限被改掉）
        try:
            root = await asyncio.to_thread(validate_folder_path, folder.path)
        except ValueError as e:
            folder.status, folder.error_message, folder.last_scan_at = FolderStatus.ERROR, str(e), utc_now_naive()
            await db.commit()
            logger.warning(f"連接資料夾無法讀取：{folder.name}（{e}）")
            return
        folder.status, folder.error_message = FolderStatus.SCANNING, None
        await db.commit()

        files = [f for kind, f in await asyncio.to_thread(lambda: list(walk_folder(root, folder.include_subfolders))) if kind == "file" and f]
        existing = {
            (d.doc_metadata or {}).get("rel_path"): d
            for d in (await db.execute(select(Document).where(folder_doc_filter(folder_id)))).scalars()
        }
        uploader = await _uploader_for(db, folder)
        seen: set[str] = set()
        added = changed = 0
        for f in files:
            seen.add(f.rel)
            meta = {"source": SOURCE, "folder_id": folder_id, "rel_path": f.rel, "mtime": f.mtime, "size": f.size}
            doc = existing.get(f.rel)
            if doc is None:
                if not uploader:
                    continue
                db.add(Document(
                    tenant_id=folder.tenant_id, uploaded_by=uploader, filename=f.rel, original_filename=Path(f.path).name,
                    file_type=f.ext.lstrip("."), file_size=f.size, file_path=f.path,
                    status=DocumentStatus.PENDING.value, doc_metadata=meta,
                ))
                added += 1
            elif (doc.doc_metadata or {}).get("mtime") != f.mtime or (doc.doc_metadata or {}).get("size") != f.size:
                # 改過：舊段落刪掉，重新建立索引
                await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
                doc.doc_metadata, doc.file_size, doc.file_path = meta, f.size, f.path
                doc.status, doc.error_message, doc.chunk_count = DocumentStatus.PENDING.value, None, 0
                changed += 1
        removed = [d for rel, d in existing.items() if rel not in seen]
        for d in removed:
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == d.id))
            await db.delete(d)
        folder.file_count = len(files)
        folder.total_bytes = sum(f.size for f in files)
        await db.commit()
        logger.info(f"連接資料夾「{folder.name}」：{len(files)} 個檔案，新增 {added}、修改 {changed}、移除 {len(removed)}")

        # 建立索引：等待中的一個一個來（失敗的只有檔案改過才會再試，不會一直重試）
        pending = (await db.execute(
            select(Document.id).where(folder_doc_filter(folder_id), Document.status == DocumentStatus.PENDING.value)
        )).scalars().all()

    for doc_id in pending:
        # 停用或取消連接了就停下來
        async with async_session_maker() as db:
            folder = await db.get(ConnectedFolder, folder_id)
            if folder is None or not folder.is_enabled:
                return
        async with async_session_maker() as db:
            await DocumentService(db).process_document(doc_id)

    async with async_session_maker() as db:
        folder = await db.get(ConnectedFolder, folder_id)
        if folder is None:
            return
        failed = (await db.execute(
            select(func.count()).select_from(Document).where(folder_doc_filter(folder_id), Document.status == DocumentStatus.FAILED.value)
        )).scalar() or 0
        folder.status = FolderStatus.READY
        folder.error_message = f"{failed} 個檔案讀取失敗（可能是掃描的圖片 PDF 或檔案損毀）" if failed else None
        folder.last_scan_at = utc_now_naive()
        await db.commit()


def is_scanning(folder_id: str) -> bool:
    return folder_id in _running or folder_id in _queued


def request_scan(folder_id: str) -> bool:
    """馬上排一次掃描（已經在排隊就不重複）；回傳有沒有新排進去"""
    if folder_id in _queued or folder_id in _running:
        return False
    _queued.add(folder_id)

    async def _run():
        try:
            await _wait_rag_ready()
            await scan_folder(folder_id)
        except Exception:
            _queued.discard(folder_id)
            logger.exception(f"掃描連接資料夾失敗：{folder_id}")

    asyncio.get_running_loop().create_task(_run())
    return True


async def _wait_rag_ready(max_wait: float = 300) -> None:
    """建立索引要用文件檢索模型：等它載入好（最多等 5 分鐘）"""
    from app.services.boot_service import is_rag_ready

    waited = 0.0
    while not is_rag_ready() and waited < max_wait:
        await asyncio.sleep(2)
        waited += 2


async def folder_scan_loop() -> None:
    """背景排程：每分鐘看一次，哪個資料夾到了該更新的時間就排進去"""
    from app.core.database import async_session_maker

    await _wait_rag_ready()
    while True:
        try:
            async with async_session_maker() as db:
                folders = (await db.execute(select(ConnectedFolder).where(ConnectedFolder.is_enabled.is_(True)))).scalars().all()
                now = utc_now_naive()
                due = [
                    f.id for f in folders
                    if f.status in (FolderStatus.PENDING, FolderStatus.SCANNING)  # 從沒掃過，或上次掃到一半就關機
                    or f.last_scan_at is None
                    or (now - f.last_scan_at).total_seconds() >= f.scan_interval_min * 60
                ]
            for fid in due:
                request_scan(fid)
        except Exception:
            logger.exception("連接資料夾排程出錯")
        await asyncio.sleep(LOOP_SECONDS)
