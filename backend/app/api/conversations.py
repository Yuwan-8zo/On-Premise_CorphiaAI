"""
對話 API
"""

from typing import List, Optional
import logging
from fastapi import APIRouter, HTTPException, status, Query, WebSocket, WebSocketDisconnect, Depends

from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import CurrentUser, DbSession
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.user import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    MessageResponse,
    ChatRequest,
)
from app.services.chat_service import chat_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["對話"])


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
    取得對話列表
    
    - 支援分頁
    - 支援搜尋標題
    - 支援資料夾過濾
    - 支援置頂/封存過濾
    """
    # 建立查詢
    query = select(Conversation).where(
        Conversation.user_id == current_user.id
    )
    
    # 過濾條件
    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    if folder_id:
        query = query.where(Conversation.folder_id == folder_id)
    if is_pinned is not None:
        query = query.where(Conversation.is_pinned == is_pinned)
    if is_archived is not None:
        query = query.where(Conversation.is_archived == is_archived)
    else:
        # 預設不顯示封存
        query = query.where(Conversation.is_archived == False)
    
    # 計算總數
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar()
    
    # 分頁與排序
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
    """建立新對話"""
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
    """取得對話詳情"""
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
            detail="對話不存在"
        )
    
    return ConversationResponse.model_validate(conversation)


@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    request: ConversationUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """更新對話"""
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
            detail="對話不存在"
        )
    
    # 更新欄位
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
    """刪除對話"""
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
            detail="對話不存在"
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
    """取得對話訊息列表"""
    # 驗證對話所有權
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="對話不存在"
        )
    
    # 查詢訊息
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .limit(limit)
    )
    messages = result.scalars().all()
    
@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str,
    token: str = Query(...),
    db: DbSession = Depends(get_db),
):
    """
    WebSocket 對話端點
    
    - 驗證 Token
    - 接收使用者訊息
    - 串流回傳 AI 回應
    """
    await websocket.accept()
    
    try:
        # 1. 驗證 Token (WebSocket無法直接使用 Depends(get_current_user))
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # 2. 驗證對話權限
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user.id
            )
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            await websocket.send_json({
                "type": "error",
                "message": "對話不存在或無權訪問"
            })
            await websocket.close()
            return

        # 3. 處理訊息循環
        while True:
            data = await websocket.receive_json()
            chat_request = ChatRequest(**data)
            
            # 發送開始訊號
            await websocket.send_json({
                "type": "start",
                "messageId": "pending"
            })
            
            try:
                # 呼叫 ChatService 處理對話
                full_content = ""
                async for chunk in chat_service.process_message(
                    db=db,
                    conversation_id=conversation_id,
                    content=chat_request.message,
                    user_id=user.id,
                    tenant_id=user.tenant_id or "default",
                    use_rag=chat_request.use_rag,
                    temperature=chat_request.temperature or 0.7,
                    max_tokens=chat_request.max_tokens or 2048
                ):
                    full_content += chunk
                    # 發送串流片段
                    await websocket.send_json({
                        "type": "stream",
                        "content": chunk
                    })
                
                # 發送結束訊號
                await websocket.send_json({
                    "type": "done",
                    "content": full_content
                })
                
            except Exception as e:
                logger.error(f"對話處理錯誤: {e}", exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "message": f"處理失敗: {str(e)}"
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket 斷開連接: {conversation_id}")
    except Exception as e:
        logger.error(f"WebSocket 錯誤: {e}", exc_info=True)
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except:
            pass


async def get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """從 Token 取得使用者 (WebSocket 用)"""
    from app.core.security import decode_token
    from app.models.user import User
    
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
        
    user_id = payload.get("sub")
    if not user_id:
        return None
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user and user.is_active:
        return user
    return None

