"""
桌面版回報：使用者在桌面版操控了這台電腦上的 Office（讀內容、寫入、開啟 AI 產出的檔案）→ 寫一筆稽核

操控本身發生在使用者的電腦上（desktop/office_bridge.py），伺服器看不到，所以由介面在動作成功後回報。
這裡只收「做了什麼」的摘要（哪個程式、文件名稱、幾個字），不收文件內容。

另外提供桌面版自己更新用的兩個端點（不用登入：桌面版在登入前就要能檢查；內容只有版本資訊和公司自己的程式）：
  GET /desktop/latest    目前伺服器上的桌面版版本、檔案大小、SHA-256
  GET /desktop/download  下載 exe
版本以 desktop/corphia_desktop.py 裡的 VERSION 為準；exe 是 desktop/dist/Corphia AI.exe（build.bat 產生）。
"""

import hashlib
import re
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.request_utils import get_client_ip
from app.services.audit_service import AuditAction, AuditResource, write_audit_log

router = APIRouter(prefix="/desktop", tags=["桌面版"])

_ACTIONS = {
    "office_read": (AuditAction.OFFICE_READ, "讀取 Office 內容"),
    "office_write": (AuditAction.OFFICE_WRITE, "把回答寫入 Office"),
    "file_open": (AuditAction.FILE_OPEN, "用 Office 開啟 AI 產出的檔案"),
}
# 摘要只留這幾個欄位、每個值限長，避免把文件內容夾帶進稽核
_DETAIL_KEYS = ("name", "scope", "chars", "truncated", "detail", "backup")
_VALUE_MAX = 200


class DesktopEvent(BaseModel):
    action: Literal["office_read", "office_write", "file_open"]
    app: str = Field("", max_length=20)
    detail: dict = Field(default_factory=dict)


EXE_NAME = "Corphia AI.exe"
_REPO_ROOT = Path(__file__).resolve().parents[3]
# 算過的 SHA-256 記起來（檔案沒變就不重算）：(修改時間, 大小) → 雜湊
_hash_cache: dict[tuple[float, int], str] = {}


def _desktop_dir() -> Path:
    p = Path(settings.desktop_dir)
    return p if p.is_absolute() else _REPO_ROOT / p


def _exe_path() -> Path:
    return _desktop_dir() / "dist" / EXE_NAME


def _source_version() -> str:
    try:
        m = re.search(r'^VERSION\s*=\s*"([0-9][0-9.]*)"', (_desktop_dir() / "corphia_desktop.py").read_text(encoding="utf-8"), re.M)
        return m.group(1) if m else ""
    except OSError:
        return ""


def _sha256(path: Path) -> str:
    st = path.stat()
    key = (st.st_mtime, st.st_size)
    if key not in _hash_cache:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""):
                h.update(block)
        _hash_cache.clear()
        _hash_cache[key] = h.hexdigest()
    return _hash_cache[key]


@router.get("/latest")
async def latest_desktop():
    """桌面版的最新版本；available＝false 表示伺服器上沒有可下載的 exe（還沒打包）"""
    exe, version = _exe_path(), _source_version()
    if not version or not exe.is_file():
        return {"available": False, "version": version}
    return {"available": True, "version": version, "size": exe.stat().st_size, "sha256": _sha256(exe), "filename": EXE_NAME}


@router.get("/download")
async def download_desktop():
    exe = _exe_path()
    if not exe.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="伺服器上沒有桌面版安裝檔")
    return FileResponse(exe, media_type="application/octet-stream", filename=EXE_NAME)


@router.post("/events")
async def record_event(body: DesktopEvent, current_user: CurrentUser, db: DbSession, request: Request):
    action, text = _ACTIONS[body.action]
    detail = {k: (v[:_VALUE_MAX] if isinstance(v, str) else v) for k, v in body.detail.items() if k in _DETAIL_KEYS and isinstance(v, (str, int, bool))}
    await write_audit_log(
        db=db, action=action, resource_type=AuditResource.DESKTOP,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description=f"{text}（{body.app or '桌面版'}）", details={"app": body.app, **detail},
        ip_address=get_client_ip(request),
    )
    return {"ok": True}
