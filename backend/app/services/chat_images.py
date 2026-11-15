"""
聊天裡附的圖片 (chat_images.py)

使用者在聊天室貼上或附加圖片（截圖、拍下來的文件、圖表），請 AI 看圖回答。
圖片和文字一樣只在這台主機上處理：存在主機的 uploads/chat-images/，由本機的圖文模型讀，不會送到任何外部服務。

流程：
  附加   收到的檔案一律用影像程式庫重新解碼、縮到合理大小、另存成 JPEG——
         不是把使用者上傳的原檔直接留著用。這樣順便拿掉拍攝地點等附帶資訊，
         做過手腳的壞檔案（假裝成圖片的其他東西）也會在這一步被擋掉。
  待送   附好的圖片記在記憶體裡等「下一則訊息」（和附加檔案同一個做法）：送出時用掉；沒送就會過期。
  之後   圖片檔留在主機上，掛在那一則訊息上，回頭看對話時還看得到。對話刪除時由 delete_conversation_images 清掉。
"""

from __future__ import annotations

import base64
import io
import re
import shutil
import threading
import time
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

# 一則訊息最多幾張、單張原檔最大多少
MAX_IMAGES = 4
MAX_BYTES = 12 * 1024 * 1024
# 存下來的長邊上限（像素）：再大對模型沒有幫助，只會讓它讀得更慢
MAX_SIDE = 1568
JPEG_QUALITY = 88
# 解碼前就擋掉的超大圖（像素總數）：小小的壓縮檔解開可以是幾 GB，會把主機記憶體吃光
MAX_PIXELS = 40_000_000
# 附了沒送出，多久後丟掉（秒）
PENDING_TTL_SEC = 600
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "BMP", "GIF"}
_ID = re.compile(r"^[0-9a-f]{32}$")

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class ChatImageError(ValueError):
    """使用者看得懂的原因（太多張、太大、不是圖片）"""


_lock = threading.Lock()
# conversation_id → (到期時間, [圖片編號])
_pending: dict[str, tuple[float, list[str]]] = {}


def _root() -> Path:
    return Path(settings.upload_directory) / "chat-images"


def _folder(conversation_id: str) -> Path:
    # 對話編號是系統產生的；仍然只留安全的字，避免被拿來組出別的路徑
    return _root() / re.sub(r"[^0-9a-zA-Z_-]", "", conversation_id)


def image_path(conversation_id: str, image_id: str) -> Path | None:
    """這張圖在主機上的檔案；編號格式不對或檔案不在回 None"""
    if not _ID.match(image_id or ""):
        return None
    path = _folder(conversation_id) / f"{image_id}.jpg"
    return path if path.is_file() else None


def normalise(data: bytes) -> bytes:
    """
    把上傳的檔案變成乾淨的 JPEG：確認真的是圖片 → 照拍攝方向轉正 → 縮到長邊上限 → 重新編碼。
    不是圖片、格式不支援、太大都丟 ChatImageError。
    """
    if len(data) > MAX_BYTES:
        raise ChatImageError(f"圖片太大（上限 {MAX_BYTES // (1024 * 1024)} MB）")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ALLOWED_FORMATS:
                raise ChatImageError("不支援這種圖片格式（支援 PNG、JPEG、WebP、BMP、GIF）")
            probe.verify()  # 檔案結構檢查；通過後要重新開一次才能讀內容
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)  # 手機直拍的照片轉正
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            # 透明底的圖鋪成白底再轉 JPEG（不然透明的地方會變黑，字就看不到了）
            if img.mode in ("RGBA", "LA", "P"):
                rgba = img.convert("RGBA")
                flat = Image.new("RGB", rgba.size, (255, 255, 255))
                flat.paste(rgba, mask=rgba.getchannel("A"))
                img = flat
            else:
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=JPEG_QUALITY)  # 不帶原本的附帶資訊（拍攝地點、裝置）
            return out.getvalue()
    except ChatImageError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError) as e:
        raise ChatImageError("這個檔案不是可以讀取的圖片") from e


def _sweep_locked(now: float) -> None:
    for conversation_id in [c for c, (expires, _ids) in _pending.items() if expires <= now]:
        _pending.pop(conversation_id, None)


def attach(conversation_id: str, files: list[tuple[str, bytes]]) -> dict:
    """
    附圖片給下一則訊息。files 是（檔名, 內容）。回 {"images": [編號], "skipped": [{"name", "reason"}]}。
    已經附過的會累加，總數超過上限丟 ChatImageError（一張都不收，讓使用者自己決定留哪幾張）。
    """
    with _lock:
        _sweep_locked(time.time())
        existing = list(_pending.get(conversation_id, (0, []))[1])
    if len(existing) + len(files) > MAX_IMAGES:
        raise ChatImageError(f"一則訊息最多附 {MAX_IMAGES} 張圖片")
    folder = _folder(conversation_id)
    accepted, skipped = [], []
    for name, data in files:
        try:
            clean = normalise(data)
        except ChatImageError as e:
            skipped.append({"name": name, "reason": str(e)})
            continue
        image_id = uuid.uuid4().hex
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{image_id}.jpg").write_bytes(clean)
        accepted.append(image_id)
    with _lock:
        _pending[conversation_id] = (time.time() + PENDING_TTL_SEC, existing + accepted)
    return {"images": existing + accepted, "skipped": skipped}


def pending(conversation_id: str) -> list[str]:
    with _lock:
        _sweep_locked(time.time())
        return list(_pending.get(conversation_id, (0, []))[1])


def consume(conversation_id: str) -> list[str]:
    """送出訊息時用掉待送的圖片（回編號清單；沒有回空清單）"""
    with _lock:
        _sweep_locked(time.time())
        return list(_pending.pop(conversation_id, (0, []))[1])


def discard(conversation_id: str) -> None:
    """使用者取消附加：待送清單清掉，檔案也刪掉（還沒掛到任何訊息上）"""
    for image_id in consume(conversation_id):
        path = image_path(conversation_id, image_id)
        if path:
            path.unlink(missing_ok=True)


def data_uri(conversation_id: str, image_id: str) -> str | None:
    """給圖文模型的格式（內嵌在請求裡，不經過任何網址）"""
    path = image_path(conversation_id, image_id)
    if path is None:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def delete_conversation_images(conversation_id: str) -> None:
    """對話刪除時一起清掉它的圖片"""
    discard(conversation_id)
    shutil.rmtree(_folder(conversation_id), ignore_errors=True)


__all__ = [
    "MAX_IMAGES", "MAX_BYTES", "ChatImageError", "normalise", "attach", "pending", "consume", "discard",
    "image_path", "data_uri", "delete_conversation_images",
]
