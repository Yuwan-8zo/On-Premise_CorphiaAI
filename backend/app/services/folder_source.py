"""
連接資料夾的共用規則：哪些路徑可以接、怎麼快速看裡面有什麼、後台的「瀏覽資料夾」

安全規則（API 和之後的掃描、AI 工具都走這裡，不要各自判斷）：
  - 必須是完整路徑、真的存在、是資料夾、伺服器讀得到；捷徑會先解開再判斷
  - 不能是磁碟根目錄（例如 D:\\），也不能是系統資料夾或包含系統資料夾
    （Windows、Program Files、ProgramData、AppData、本系統自己的程式資料夾）
  - .env 設了 CONNECTED_FOLDER_ROOTS 時，只能接這些資料夾底下的路徑
  - 隱藏檔、系統檔、金鑰類檔案一律不讀
"""

from __future__ import annotations

import os
import string
import time
from pathlib import Path

from app.core.config import settings
from app.services.document_service import DocumentService

# 舊版 .doc .xls .ppt 目前解析不了（上傳時也會擋），先不算可讀；之後加 LibreOffice 自動轉檔再打開
SUPPORTED_EXTS = set(DocumentService.SUPPORTED_TYPES) - {".doc", ".xls", ".ppt"}
# AI 建立的新檔放在每個連接資料夾裡的這個子資料夾
AI_OUTPUT_DIR = "AI 產出"

# 掃描時跳過的資料夾、檔案
_SKIP_DIRS = {"$recycle.bin", "system volume information", "node_modules", ".git", "__pycache__", ".venv", "venv"}
_SENSITIVE_NAMES = {".env", "id_rsa", "id_ed25519", "credentials", "secrets.json"}
_SENSITIVE_EXTS = {".key", ".pem", ".pfx", ".p12", ".kdbx", ".crt", ".env"}

# 檢查資料夾時最多看幾個項目、最多花幾秒（大資料夾不要卡住後台畫面）
INSPECT_MAX_ENTRIES = 20000
INSPECT_MAX_SECONDS = 3.0
INSPECT_SAMPLES = 8
BROWSE_MAX_DIRS = 300

_PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _norm(p: Path) -> str:
    return os.path.normcase(str(p))


def _forbidden_roots() -> list[Path]:
    env = os.environ
    roots = [
        env.get("SystemRoot") or env.get("WINDIR"),
        env.get("ProgramFiles"),
        env.get("ProgramFiles(x86)"),
        env.get("ProgramData"),
        env.get("APPDATA"),
        env.get("LOCALAPPDATA"),
        str(_PROJECT_ROOT),
        "/etc", "/bin", "/usr", "/var", "/proc", "/sys", "/root",
    ]
    out = []
    for r in roots:
        if r:
            try:
                out.append(Path(r).resolve())
            except OSError:
                continue
    return out


def _is_within(child: Path, parent: Path) -> bool:
    c, p = _norm(child), _norm(parent)
    return c == p or c.startswith(p.rstrip("\\/") + os.sep)


def allowed_roots() -> list[Path]:
    raw = getattr(settings, "connected_folder_roots", "") or ""
    return [Path(x.strip()).resolve() for x in raw.split(",") if x.strip()]


def is_sensitive(name: str) -> bool:
    low = name.lower()
    return low.startswith(".") or low in _SENSITIVE_NAMES or Path(low).suffix in _SENSITIVE_EXTS


def validate_folder_path(raw: str) -> Path:
    """檢查並回傳正規化後的路徑；不行就丟 ValueError（訊息直接給管理員看）"""
    text = (raw or "").strip().strip('"').strip("'")
    if not text:
        raise ValueError("請輸入資料夾路徑")
    p = Path(text)
    if not p.is_absolute():
        raise ValueError("請輸入完整路徑，例如 D:\\公司文件\\業務部 或 \\\\NAS\\共用\\業務部")
    try:
        p = p.resolve(strict=True)
    except (OSError, RuntimeError):
        raise ValueError("找不到這個資料夾，或伺服器沒有權限讀取")
    if not p.is_dir():
        raise ValueError("這個路徑不是資料夾")
    if p.parent == p:
        raise ValueError("不能連接整個磁碟，請選擇裡面的資料夾")
    for f in _forbidden_roots():
        if _is_within(p, f) or _is_within(f, p):
            raise ValueError("這是系統或本程式使用的資料夾（或包含它們），為了安全不能連接")
    roots = allowed_roots()
    if roots and not any(_is_within(p, r) for r in roots):
        raise ValueError("這個路徑不在系統允許的範圍內（請洽系統管理員設定 CONNECTED_FOLDER_ROOTS）")
    if not os.access(p, os.R_OK):
        raise ValueError("伺服器沒有權限讀取這個資料夾")
    return p


def overlaps(a: str, b: str) -> bool:
    """兩個路徑是不是同一個、或一個在另一個裡面（重疊就會重複建立索引、也可能跨租戶看到別人的檔案）"""
    pa, pb = Path(a), Path(b)
    return _is_within(pa, pb) or _is_within(pb, pa)


def inspect_folder(path: Path, include_subfolders: bool = True) -> dict:
    """快速看資料夾裡有什麼：支援的檔案數、總大小、各類型數量、幾個範例檔名（超過上限就停，標記 truncated）"""
    t0 = time.monotonic()
    supported = unsupported = sensitive = total_bytes = seen = 0
    by_type: dict[str, int] = {}
    samples: list[str] = []
    truncated = False
    stack = [path]
    while stack:
        cur = stack.pop()
        try:
            entries = list(os.scandir(cur))
        except OSError:
            continue
        for e in entries:
            seen += 1
            if seen > INSPECT_MAX_ENTRIES or time.monotonic() - t0 > INSPECT_MAX_SECONDS:
                truncated = True
                stack.clear()
                break
            try:
                if e.is_dir(follow_symlinks=False):
                    if include_subfolders and e.name.lower() not in _SKIP_DIRS and not e.name.startswith("."):
                        stack.append(Path(e.path))
                    continue
                if not e.is_file(follow_symlinks=False):
                    continue
                if is_sensitive(e.name):
                    sensitive += 1
                    continue
                ext = Path(e.name).suffix.lower()
                if ext not in SUPPORTED_EXTS:
                    unsupported += 1
                    continue
                supported += 1
                total_bytes += e.stat(follow_symlinks=False).st_size
                by_type[ext] = by_type.get(ext, 0) + 1
                if len(samples) < INSPECT_SAMPLES:
                    samples.append(os.path.relpath(e.path, path))
            except OSError:
                continue
    return {
        "path": str(path), "file_count": supported, "total_bytes": total_bytes, "by_type": by_type,
        "unsupported_count": unsupported, "skipped_sensitive": sensitive, "samples": samples, "truncated": truncated,
    }


def browse(raw: str | None) -> dict:
    """後台的資料夾瀏覽：沒給路徑＝列出起點（允許範圍，或各磁碟）；給了就列出底下的子資料夾"""
    roots = allowed_roots()
    if not raw:
        if roots:
            starts = [r for r in roots if r.is_dir()]
        else:
            starts = [Path(f"{d}:\\") for d in string.ascii_uppercase if os.path.isdir(f"{d}:\\")] if os.name == "nt" else [Path("/")]
        return {"path": None, "parent": None, "dirs": [{"name": str(s), "path": str(s)} for s in starts]}
    p = Path(raw).resolve()
    if not p.is_dir():
        raise ValueError("找不到這個資料夾")
    if roots and not any(_is_within(p, r) for r in roots):
        raise ValueError("這個路徑不在系統允許的範圍內")
    forbidden = _forbidden_roots()
    dirs = []
    try:
        for e in sorted(os.scandir(p), key=lambda x: x.name.lower()):
            if len(dirs) >= BROWSE_MAX_DIRS:
                break
            try:
                if not e.is_dir(follow_symlinks=False) or e.name.startswith(".") or e.name.startswith("$") or e.name.lower() in _SKIP_DIRS:
                    continue
            except OSError:
                continue
            child = Path(e.path)
            if any(_is_within(child, f) for f in forbidden):
                continue
            dirs.append({"name": e.name, "path": str(child)})
    except OSError:
        raise ValueError("伺服器沒有權限讀取這個資料夾")
    at_top = p.parent == p or (roots and any(_norm(p) == _norm(r) for r in roots))
    return {"path": str(p), "parent": None if at_top else str(p.parent), "dirs": dirs}
