"""
訊息 API
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import CurrentUser, DbSession
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.conversation import MessageCreate, MessageResponse, MessageUpdate
from app.services.chat_service import ChatService

router = APIRouter(prefix="/messages", tags=["訊息"])


@router.post("/{conversation_id}", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    request: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    發送訊息（非串流）
    
    注意：建議使用 WebSocket 進行串流對話
    """
    # 驗證對話存在
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="對話不存在"
        )
    
    # 發送訊息
    chat_service = ChatService(db)
    message = await chat_service.send_message(
        conversation_id=conversation_id,
        content=request.content,
        use_rag=request.use_rag,
    )
    
    return MessageResponse.model_validate(message)


@router.put("/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: str,
    request: MessageUpdate,
    current_user: CurrentUser,
    db: DbSession,
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
    result = await db.execute(
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.id == message_id,
            Conversation.user_id == current_user.id,
        )
    )
    message = result.scalar_one_or_none()

    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="訊息不存在"
        )

    # 內容長度驗證（防 DoS）
    if request.content is None or len(request.content) > 32_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content 必須非空且不可超過 32000 字"
        )

    # 紀錄改動時間到 audit log（保留鏈斷裂作為「被修改過」的證據）
    import logging as _logging
    _logging.getLogger(__name__).warning(
        "Message %s content modified by user %s (hash chain will break)",
        message_id, current_user.id,
    )

    message.content = request.content
    await db.commit()
    await db.refresh(message)

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
    result = await db.execute(
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Message.id == message_id,
            Conversation.user_id == current_user.id,
        )
    )
    message = result.scalar_one_or_none()
    
    if message is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="訊息不存在"
        )
    
    message.rating = rating
    await db.commit()
    
    return {"message": "評分成功", "rating": rating}
