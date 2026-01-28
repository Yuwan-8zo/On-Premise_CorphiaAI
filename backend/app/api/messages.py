"""
è¨Šæ¯ API
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from app.api.deps import CurrentUser, DbSession
from database.models.conversation import Conversation
from database.models.message import Message
from database.schemas.conversation import MessageCreate, MessageResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/messages", tags=["è¨Šæ¯"])


@router.post("/{conversation_id}", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    request: MessageCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    ?¼é€è??¯ï??ä¸²æµï?
    
    æ³¨æ?ï¼šå»ºè­°ä½¿??WebSocket ?²è?ä¸²æ?å°è©±
    """
    # é©—è?å°è©±å­˜åœ¨
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
            detail="å°è©±ä¸å???
        )
    
    # ?¼é€è???
    chat_service = ChatService(db)
    message = await chat_service.send_message(
        conversation_id=conversation_id,
        content=request.content,
        use_rag=request.use_rag,
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
    è©•å?è¨Šæ¯
    
    - rating: 1-5
    """
    if rating < 1 or rating > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="è©•å?å¿…é???1-5 ä¹‹é?"
        )
    
    # ?–å?è¨Šæ¯
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
            detail="è¨Šæ¯ä¸å???
        )
    
    message.rating = rating
    await db.commit()
    
    return {"message": "è©•å??å?", "rating": rating}
