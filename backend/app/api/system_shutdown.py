"""
關閉主機服務（管理後台的按鈕）

桌面版關掉視窗不會關服務（其他電腦和手機還連著），所以要有一個明確的地方可以把整套系統關掉：
後端、AI 模型、資料庫。做的事和按「一鍵關閉」一樣（執行安裝資料夾的 stop.py）。

誰可以按：管理員，而且人要在主機前面——只接受從主機本機連進來的請求。
  公司其他電腦或手機上的管理員不能遠端把主機關掉：關了之後要有人到主機前面才開得回來，
  而且一個被盜用的管理員帳號就能讓全公司停擺。
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import RequireAdmin, get_current_user
from app.core.database import get_db
from app.core.web_ui import is_loopback
from app.models.user import User
from app.services.audit_service import AuditAction, AuditResource, write_audit_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["系統監控"])

PROJECT_ROOT = Path(__file__).resolve().parents[3]
STOP_SCRIPT = PROJECT_ROOT / "stop.py"
STOP_LOG = PROJECT_ROOT / ".runtime" / "admin-stop.log"


def start_stop_script() -> None:
    """
    在背景執行 stop.py。它會把後端（也就是現在這個程式）關掉，所以要讓它獨立於後端執行：
    不開視窗、不跟著後端一起被結束，輸出寫到 .runtime/admin-stop.log。
    """
    STOP_LOG.parent.mkdir(parents=True, exist_ok=True)
    flags = 0
    for name in ("CREATE_NO_WINDOW", "CREATE_NEW_PROCESS_GROUP", "DETACHED_PROCESS"):
        flags |= getattr(subprocess, name, 0)
    with open(STOP_LOG, "w", encoding="utf-8", errors="replace") as log:
        subprocess.Popen(
            [sys.executable, str(STOP_SCRIPT)], cwd=str(PROJECT_ROOT),
            stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
            creationflags=flags, close_fds=True,
        )


@router.post("/shutdown", status_code=status.HTTP_202_ACCEPTED, summary="關閉主機服務（只限主機本機的管理員）")
async def shutdown_host(
    request: Request,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
    _=RequireAdmin,
):
    # 用實際連進來的位址判斷（不看轉送的標頭，那個可以偽造）
    peer = request.client.host if request.client else None
    if not is_loopback(peer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能在主機本機關閉服務")
    if not STOP_SCRIPT.is_file():
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="這個安裝沒有關閉程式（stop.py）")
    # 先寫稽核再關：關了之後就寫不進去了
    await write_audit_log(
        db=db, action=AuditAction.SYSTEM_SHUTDOWN, resource_type=AuditResource.SYSTEM,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.tenant_id,
        description="管理員從管理後台關閉主機服務", ip_address=peer,
    )
    logger.warning("[shutdown][admin=%s] 從管理後台關閉主機服務", current_user.email)
    start_stop_script()
    return {"stopping": True}
