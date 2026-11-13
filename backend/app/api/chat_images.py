"""
聊天附圖片 API：把圖片附給下一則訊息，請 AI 看圖回答（圖片只在這台主機上處理）

  GET    /chat-images/status                      這台主機能不能看圖（有沒有裝圖文模型）、一則最多幾張
  POST   /chat-images/{conversation_id}/attach    上傳圖片（表單多檔），回報收了哪些、哪些沒收
  GET    /chat-images/{conversation_id}           還沒送出前目前附了哪些（重新整理頁面後用）
  DELETE /chat-images/{conversation_id}           取消附加
  GET    /chat-images/{conversation_id}/{image_id}  讀一張圖（只有對話的主人）

圖片的檢查、轉存、暫存都在 services/chat_images.py；這裡負責驗證身分、擁有權和寫稽核。
"""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.api.lookups import get_own_conversation
from app.core.request_utils import get_client_ip, get_user_agent
import app.services.chat_images as chat_images
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/chat-images", tags=["聊天附圖片"])


def _require_vision() -> None:
    if not get_llm_service().vision_available:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="這台主機沒有安裝看圖片的模型")


@router.get("/status")
async def vision_status(current_user: CurrentUser):
    return {
        "enabled": get_llm_service().vision_available,
        "max_images": chat_images.MAX_IMAGES,
        "max_mb": chat_images.MAX_BYTES // (1024 * 1024),
    }


@router.post("/{conversation_id}/attach")
async def attach_images(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
    files: list[UploadFile] = File(...),
):
    _require_vision()
    await get_own_conversation(db, conversation_id, current_user)
    payload = []
    for f in files:
        # 多讀一個位元組：超過上限的檔案不會整個讀進記憶體，也能被 normalise 認出來擋掉
        payload.append((f.filename or "（未命名）", await f.read(chat_images.MAX_BYTES + 1)))
    try:
        result = chat_images.attach(conversation_id, payload)
    except chat_images.ChatImageError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    await write_audit_log(
        db=db, action=AuditAction.CHAT_IMAGE_ATTACH, resource_type=AuditResource.CONVERSATION,
        resource_id=conversation_id, user_id=current_user.id, user_email=current_user.email,
        tenant_id=current_user.effective_tenant_id,
        description=f"附上圖片：目前 {len(result['images'])} 張、略過 {len(result['skipped'])} 個",
        details={"images": result["images"], "skipped": [s["name"] for s in result["skipped"]]},
        ip_address=get_client_ip(request), user_agent=get_user_agent(request),
    )
    return result


@router.get("/{conversation_id}")
async def pending_images(conversation_id: str, current_user: CurrentUser, db: DbSession):
    await get_own_conversation(db, conversation_id, current_user)
    return {"images": chat_images.pending(conversation_id)}


@router.delete("/{conversation_id}")
async def cancel_images(conversation_id: str, current_user: CurrentUser, db: DbSession):
    await get_own_conversation(db, conversation_id, current_user)
    chat_images.discard(conversation_id)
    return {"ok": True}


@router.get("/{conversation_id}/{image_id}")
async def get_image(conversation_id: str, image_id: str, current_user: CurrentUser, db: DbSession):
    await get_own_conversation(db, conversation_id, current_user)
    path = chat_images.image_path(conversation_id, image_id)
    if path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="圖片不存在")
    # 圖片是使用者的私人內容：不讓瀏覽器或中間的設備留快取
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"})
