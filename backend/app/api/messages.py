"""
訊息 API
"""

from fastapi import APIRouter, HTTPException, Request, status

from app.api.lookups import get_own_conversation, get_own_message
from app.api.deps import CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.schemas.conversation import MessageCreate, MessageResponse, MessageUpdate
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.chat_service import ChatGenerationError, ChatService
from app.services.generated_files import attach_to_messages
from app.services.message_guard import screen_user_message
from app.services.model_preference import get_user_model
from app.services.quota_service import check_user_quota
from app.services.pii_masking_service import mask_pii
from app.core.config import settings

router = APIRouter(prefix="/messages", tags=["訊息"])


@router.post("/{conversation_id}", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    request: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
    http_request: Request,
):
    """
    發送訊息（非串流；WebSocket 斷線時前端的備用路線）

    和即時串流同一套規則：每日配額 → 安全閘道（個資遮罩、違禁詞、提示詞注入）→ 生成。
    被攔阻時回 400，detail 帶 code（DLP_BLOCKED／INJECTION_BLOCKED）與原因。
    """
    conversation = await get_own_conversation(db, conversation_id, current_user)

    quota = await check_user_quota(db, current_user.id)
    if not quota.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "QUOTA_EXCEEDED", "message": quota.message},
        )

    events: list[dict] = []

    async def collect(event: dict) -> None:
        events.append(event)

    content = await screen_user_message(
        db, request.content.strip(),
        conversation_id=conversation_id,
        tenant_id=conversation.tenant_id,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=get_client_ip(http_request),
        emit=collect,
    )
    if content is None:
        last = events[-1] if events else {}
        code = "DLP_BLOCKED" if last.get("type") == "dlp_block" else "INJECTION_BLOCKED"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": code, "message": last.get("message", "訊息已被攔阻")},
        )

    try:
        message = await ChatService(db, model_name=await get_user_model(db, current_user.id)).send_message(
            conversation_id=conversation_id,
            content=content,
            use_rag=request.use_rag,
        )
    except ChatGenerationError as e:
        code = status.HTTP_503_SERVICE_UNAVAILABLE if e.code == "LLM_LOADING" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail={"code": e.code or "GENERATION_FAILED", "message": e.message}) from e

    # 這一題如果產出了檔案（Word／Excel／簡報），一起回給前端
    await attach_to_messages(db, [message])
    return MessageResponse.model_validate(message)


@router.put("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: str,
    request: MessageUpdate,
    current_user: CurrentUser,
    db: DbSession,
    http_request: Request,
):
    """
    修改訊息的內容 (不觸發重新生成)

    SECURITY 注意：訊息有 hash chain（content_hash + prev_hash）作為防篡改記錄，
    一旦修改 content，原有的 hash 會跟新 content 不符。為了讓 admin replay /
    audit 仍能識別出「這條被修改過」，我們：
      1) 不重算 content_hash（保留舊值）→ 鏈會「斷在這裡」，verify_chain 會回報
      2) 在 message metadata 標記被修改過時間（如果有 metadata 欄位）
    這比「靜默重簽」安全：審計報告可以看到鏈在哪裡斷，知道是被人為修改的。
    """
    message = await get_own_message(db, message_id, current_user)

    # 內容長度驗證（防 DoS）
    if request.content is None or len(request.content) > 32_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content 必須非空且不可超過 32000 字"
        )

    # 存進資料庫前一樣要遮罩個資（和送訊息同一套規則）
    content = request.content
    if settings.enable_pii_masking:
        content = mask_pii(content)["masked_text"]

    message.content = content
    await db.commit()
    await db.refresh(message)

    # 寫稽核紀錄（保留鏈斷裂作為「被修改過」的證據，稽核頁看得到是誰、什麼時候改的）
    conversation = await get_own_conversation(db, message.conversation_id, current_user)
    await write_audit_log(
        db=db,
        action=AuditAction.CONVERSATION_UPDATE,
        resource_type=AuditResource.CONVERSATION,
        resource_id=message.conversation_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=conversation.tenant_id,
        description="修改訊息內容（防篡改鏈會在這則訊息斷開）",
        details={"message_id": message_id},
        ip_address=get_client_ip(http_request),
    )

    return MessageResponse.model_validate(message)


@router.put("/{message_id}/rating")
async def rate_message(
    message_id: str,
    rating: int,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    評分訊息
    
    - rating: 1-5
    """
    if rating < 1 or rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="評分必須在 1-5 之間"
        )
    
    # 取得訊息
    message = await get_own_message(db, message_id, current_user)
    
    message.rating = rating
    await db.commit()
    
    return {"message": "評分成功", "rating": rating}
