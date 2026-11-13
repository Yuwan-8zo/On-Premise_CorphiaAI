"""
瀏覽器臨時資料夾 API：使用者在聊天室用瀏覽器選這台電腦的資料夾，附給 AI 看（只附下一則訊息，不留底）

  POST   /browser-folder/{conversation_id}/attach   上傳選到的檔案（表單多檔），回報哪些收了、哪些沒收
  GET    /browser-folder/{conversation_id}           還沒送出前查詢目前附了什麼（重新整理頁面後用）
  DELETE /browser-folder/{conversation_id}           主動取消（使用者按「移除附加」）

實際的解析、篩檢、暫存都在 services/browser_folder.py；這裡只負責驗證身分、擁有權、檔案簽章，和寫稽核。
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.api.lookups import get_own_conversation
from app.core.config import settings
from app.core.file_validator import validate_file_signature
from app.core.request_utils import get_client_ip, get_user_agent
from app.services import browser_folder as bf
from app.services.audit_service import AuditAction, AuditResource, write_audit_log

router = APIRouter(prefix="/browser-folder", tags=["瀏覽器臨時資料夾"])


def _require_enabled() -> None:
    if not settings.enable_browser_folder:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這個功能目前沒有開啟")


@router.post("/{conversation_id}/attach")
async def attach_folder(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
    files: list[UploadFile] = File(...),
):
    """
    files 是瀏覽器用資料夾選取器讀到的一批檔案（表單欄位名稱固定叫 files，可以重複）。
    每個檔案先做和單檔上傳一樣的簽章檢查（副檔名和內容籤章要符合），再送去解析。
    """
    _require_enabled()
    await get_own_conversation(db, conversation_id, current_user)  # 只確認是自己的對話，不需要用到物件本身

    payload: list[tuple[str, bytes]] = []
    rejected: list[dict] = []
    for f in files:
        name = f.filename or "（未命名）"
        data = await f.read()
        if not validate_file_signature(data[:1024], name, f.content_type or ""):
            rejected.append({"name": name, "reason": "副檔名和檔案內容不符，或不是支援的格式"})
            continue
        payload.append((name, data))

    try:
        result = await bf.attach(conversation_id, payload)
    except bf.BrowserFolderError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    result["skipped"] = rejected + result["skipped"]

    await write_audit_log(
        db=db, action=AuditAction.BROWSER_FOLDER_ATTACH, resource_type=AuditResource.CONVERSATION,
        resource_id=conversation_id, user_id=current_user.id, user_email=current_user.email,
        tenant_id=current_user.effective_tenant_id,
        description=f"附上這台電腦的資料夾：{len(result['accepted'])} 個檔案、略過 {len(result['skipped'])} 個",
        details={"accepted": result["accepted"], "skipped": [s["name"] for s in result["skipped"]], "pii": result["pii"]},
        ip_address=get_client_ip(request), user_agent=get_user_agent(request),
    )
    return result


@router.get("/{conversation_id}")
async def get_pending(conversation_id: str, current_user: CurrentUser, db: DbSession):
    await get_own_conversation(db, conversation_id, current_user)
    return bf.pending_summary(conversation_id) or {"files": [], "chars": 0, "expires_in_sec": 0}


@router.delete("/{conversation_id}")
async def cancel_pending(conversation_id: str, current_user: CurrentUser, db: DbSession):
    await get_own_conversation(db, conversation_id, current_user)
    bf.discard(conversation_id)
    return {"ok": True}
