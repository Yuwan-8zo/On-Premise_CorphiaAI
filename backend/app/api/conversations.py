"""
å°è©± API
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query

from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from database.models.conversation import Conversation
from database.models.message import Message, MessageRole
from database.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    MessageResponse,
)

router = APIRouter(prefix="/conversations", tags=["å°è©±"])


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    folder_id: Optional[str] = None,
    is_pinned: Optional[bool] = None,
    is_archived: Optional[bool] = None,
):
    """
    ?–å?å°è©±?—è¡¨
    
    - ?¯æ´?†é?
    - ?¯æ´?œå?æ¨™é?
    - ?¯æ´è³‡æ?å¤¾é?æ¿?
    - ?¯æ´ç½®é?/å°å??æ¿¾
    """
    # å»ºç??¥è©¢
    query = select(Conversation).where(
        Conversation.user_id == current_user.id
    )
    
    # ?æ¿¾æ¢ä»¶
    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    if folder_id:
        query = query.where(Conversation.folder_id == folder_id)
    if is_pinned is not None:
        query = query.where(Conversation.is_pinned == is_pinned)
    if is_archived is not None:
        query = query.where(Conversation.is_archived == is_archived)
    else:
        # ?è¨­ä¸é¡¯ç¤ºå?å­?
        query = query.where(Conversation.is_archived == False)
    
    # è¨ˆç?ç¸½æ•¸
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar()
    
    # ?†é??‡æ?åº?
    query = query.order_by(
        desc(Conversation.is_pinned),
        desc(Conversation.updated_at)
    ).offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    conversations = result.scalars().all()
    
    return ConversationListResponse(
        data=[ConversationResponse.model_validate(c) for c in conversations],
        total=total
    )


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request: ConversationCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """å»ºç??°å?è©?""
    conversation = Conversation(
        tenant_id=current_user.tenant_id or "default",
        user_id=current_user.id,
        title=request.title,
        model=request.model,
        folder_id=request.folder_id,
        settings=request.settings,
    )
    
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    
    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """?–å?å°è©±è©³æ?"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="å°è©±ä¸å???
        )
    
    return ConversationResponse.model_validate(conversation)


@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    request: ConversationUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """?´æ–°å°è©±"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="å°è©±ä¸å???
        )
    
    # ?´æ–°æ¬„ä?
    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(conversation, field, value)
    
    await db.commit()
    await db.refresh(conversation)
    
    return ConversationResponse.model_validate(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """?ªé™¤å°è©±"""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="å°è©±ä¸å???
        )
    
    await db.delete(conversation)
    await db.commit()


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
):
    """?–å?å°è©±è¨Šæ¯?—è¡¨"""
    # é©—è?å°è©±?€?‰æ?
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="å°è©±ä¸å???
        )
    
    # ?¥è©¢è¨Šæ¯
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .limit(limit)
    )
    messages = result.scalars().all()
    
    return [MessageResponse.model_validate(m) for m in messages]
