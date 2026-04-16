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
