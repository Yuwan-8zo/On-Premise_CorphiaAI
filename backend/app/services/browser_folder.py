"""
瀏覽器臨時資料夾：使用者在聊天室用瀏覽器選這台電腦的一個資料夾，附給 AI 看

和「連接資料夾」（A，管理員在伺服器上設定、長期索引）不一樣：這個是使用者自己操作、
只附在「下一則」訊息，不建立 documents／document_chunks 紀錄，伺服器不留底——

  attach()  收到上傳的檔案（已經在記憶體裡的 bytes）→ 寫到暫存檔解析成文字（解析完立刻刪暫存檔，
            解析失敗、逾時、程序被中斷都一樣會刪，見 finally）→ 送模型前的篩檢（context_guard）→
            放進「這個對話的暫存格」，等對方送下一則訊息才用，用完或過期就清掉
  consume() 這個對話有沒有剛附的內容；有就回文字並清掉（只用一次）

暫存格只在這台伺服器的記憶體裡（process 內的 dict），不是資料庫欄位：伺服器重啟、這個對話還沒送出
下一則訊息，暫存的內容就不見了——這本來就是設計成「只附這一次」。
"""

from __future__ import annotations

import logging
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock

from app.core.config import settings
import app.services.text_extract as text_extract
from app.services.context_guard import screen_chunks

logger = logging.getLogger(__name__)


class BrowserFolderError(Exception):
    """給使用者看的錯誤（整批都不收，例如檔案數、總大小超過上限）"""


@dataclass
class _Pending:
    text: str
    files: list[str]
    skipped: list[dict]
    report: dict
    expires_at: float


@dataclass
class _Store:
    items: dict[str, _Pending] = field(default_factory=dict)
    lock: Lock = field(default_factory=Lock)


_store = _Store()


def _sweep_locked() -> None:
    """清掉過期的（呼叫端要先拿到 lock）"""
    now = time.time()
    for cid in [cid for cid, p in _store.items.items() if p.expires_at <= now]:
        del _store.items[cid]


def _ttl_seconds() -> float:
    return max(1, settings.browser_folder_ttl_min) * 60


async def attach(conversation_id: str, files: list[tuple[str, bytes]]) -> dict:
    """
    files：[(檔名, 內容), ...]（檔名只用來判斷副檔名、顯示給使用者看，不當成路徑使用）
    回傳摘要：{"accepted": [檔名...], "skipped": [{"name", "reason"}...], "chars": 附上的總字數}
    附上的內容本身不回傳給呼叫端（API 層不需要，也不要讓它再被記錄下來）
    """
    if not files:
        raise BrowserFolderError("沒有選到任何檔案")
    if len(files) > settings.browser_folder_max_files:
        raise BrowserFolderError(f"這個資料夾有 {len(files)} 個檔案，一次最多附 {settings.browser_folder_max_files} 個")
    total_bytes = sum(len(data) for _, data in files)
    max_bytes = settings.browser_folder_max_total_mb * 1024 * 1024
    if total_bytes > max_bytes:
        raise BrowserFolderError(f"這個資料夾總共 {total_bytes / 1024 / 1024:.1f} MB，超過 {settings.browser_folder_max_total_mb} MB 的上限")

    skipped: list[dict] = []
    chunks: list[dict] = []  # 給 context_guard.screen_chunks 用的格式
    per_file_max = settings.browser_folder_max_chars_per_file

    for name, data in files:
        ext = Path(name).suffix.lower()
        if ext not in text_extract.SUPPORTED_EXTS:
            skipped.append({"name": name, "reason": "不支援的檔案格式"})
            continue
        tmp_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(data)
                tmp_path = Path(tmp.name)
            text = (await text_extract.extract_text(tmp_path, ext.lstrip("."))).strip()
        except Exception as e:
            logger.info("瀏覽器臨時資料夾：%s 解析失敗：%s", name, e)
            skipped.append({"name": name, "reason": "讀不出內容（檔案可能壞了或格式特殊）"})
            continue
        finally:
            # 暫存檔只是為了重用既有的解析器，解析完（不管成功失敗）都要立刻刪掉，不留底
            if tmp_path is not None:
                tmp_path.unlink(missing_ok=True)
        if not text:
            skipped.append({"name": name, "reason": "內容是空的"})
            continue
        chunks.append({"chunk_id": name, "content": text[:per_file_max], "metadata": {"filename": name}})

    kept, report = screen_chunks(chunks)
    dropped_names = set(report["injection"]) | set(report["dlp"])
    for c in chunks:
        if c["chunk_id"] in dropped_names:
            reason = "內容像是要改寫 AI 的規則" if c["chunk_id"] in report["injection"] else "內容含有公司禁止的詞"
            skipped.append({"name": c["chunk_id"], "reason": reason})

    if not kept:
        raise BrowserFolderError("這個資料夾裡沒有讀得到內容、而且通過安全檢查的檔案" if files else "沒有選到任何檔案")

    # 總字數還是太多：從後面開始整份拿掉（不要把每份都砍一半，變得兩邊都看不完整）
    total_chars = sum(len(c["content"]) for c in kept)
    while total_chars > settings.browser_folder_max_chars_total and len(kept) > 1:
        dropped = kept.pop()
        total_chars -= len(dropped["content"])
        skipped.append({"name": dropped["chunk_id"], "reason": "資料夾內容太多，超過上限的部分沒有附上"})
    if total_chars > settings.browser_folder_max_chars_total:
        kept[0]["content"] = kept[0]["content"][: settings.browser_folder_max_chars_total]
        total_chars = len(kept[0]["content"])

    text = "\n\n".join(f"【{c['chunk_id']}】\n{c['content']}" for c in kept)
    accepted = [c["chunk_id"] for c in kept]

    with _store.lock:
        _sweep_locked()
        _store.items[conversation_id] = _Pending(
            text=text, files=accepted, skipped=skipped, report=report, expires_at=time.time() + _ttl_seconds(),
        )
    return {"accepted": accepted, "skipped": skipped, "chars": total_chars, "pii": report["pii"]}


def consume(conversation_id: str) -> tuple[str, list[str]] | None:
    """這個對話有沒有剛附上、還沒用掉的內容；有的話回（文字, 檔名清單）並清掉。只用一次。"""
    with _store.lock:
        _sweep_locked()
        pending = _store.items.pop(conversation_id, None)
    return (pending.text, pending.files) if pending else None


def discard(conversation_id: str) -> None:
    """使用者按「取消附加」、或這則訊息送到一半失敗：主動清掉，不用等過期"""
    with _store.lock:
        _store.items.pop(conversation_id, None)


def pending_summary(conversation_id: str) -> dict | None:
    """查詢用（不消耗）：前端重新整理頁面後，看這個對話還有沒有等著送出的附加內容"""
    with _store.lock:
        _sweep_locked()
        pending = _store.items.get(conversation_id)
        if pending is None:
            return None
        return {"files": list(pending.files), "chars": len(pending.text), "expires_in_sec": max(0, int(pending.expires_at - time.time()))}
