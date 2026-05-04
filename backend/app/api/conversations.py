"""
對話 API
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Request

from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    MessageResponse,
)
from app.services.audit_service import (
    write_audit_log,
    AuditAction,
    AuditResource,
    get_client_ip,
    get_user_agent,
)

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
        # 跳脫 LIKE 萬用字元，限制長度避免 DoS
        if len(search) > 128:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="search 字串過長")
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(Conversation.title.ilike(f"%{escaped}%", escape="\\"))
    if folder_id:
        query = query.where(Conversation.folder_id == folder_id)
    if is_pinned is not None:
        query = query.where(Conversation.is_pinned == is_pinned)
    if is_archived is not None:
        query = query.where(Conversation.is_archived == is_archived)
    else:
        # 預設不顯示封存
        # FIX: 用 isnot(True) 取代 == False，這樣 NULL 也會被視為「未封存」
        # 舊資料 migration 前可能有 is_archived=NULL 的紀錄，原本 `== False`
        # 在 SQL 中對 NULL 回傳 NULL（=falsy），導致這些對話消失
        query = query.where(Conversation.is_archived.isnot(True))
    
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


async def _ensure_valid_tenant_id(db, current_user) -> str:
    """
    防止 user.tenant_id 指向已被刪除的 tenant 導致 INSERT 違反 FK 約束。
    流程：
      1. 若 user.tenant_id 在 tenants 表存在 → 直接回傳
      2. 不存在 → 確保 'default' tenant 存在（不存在就現場建立）
      3. 把 user 的 tenant_id 更新到 'default' 並 commit
      4. 回傳 'default'
    """
    from app.models.tenant import Tenant
    from sqlalchemy import select
    from app.models.user import User

    desired = current_user.tenant_id or "default"

    # 確認 desired tenant 是否存在
    exists = await db.execute(select(Tenant).where(Tenant.id == desired))
    if exists.scalar_one_or_none():
        return desired

    # 不存在 → 確保 default 存在
    default_check = await db.execute(select(Tenant).where(Tenant.id == "default"))
    if not default_check.scalar_one_or_none():
        default_tenant = Tenant(
            id="default",
            slug="default",
            name="預設組織",
            description="系統預設租戶（自動建立）",
            is_active=True,
        )
        db.add(default_tenant)
        await db.commit()

    # 把這個 user 的 tenant_id 更新到 default，避免下次又踩到同一個雷
    user_row = await db.execute(select(User).where(User.id == current_user.id))
    user_obj = user_row.scalar_one_or_none()
    if user_obj is not None:
        user_obj.tenant_id = "default"
        await db.commit()

    return "default"


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    request_body: ConversationCreate,
    current_user: CurrentUser,
    db: DbSession,
    request: Request = None,
):
    """建立新對話"""
    # 自我修復：若 user 的 tenant_id 指向不存在的 tenant，先 remap 到 default
    safe_tenant_id = await _ensure_valid_tenant_id(db, current_user)

    conversation = Conversation(
        tenant_id=safe_tenant_id,
        user_id=current_user.id,
        title=request_body.title,
        model=request_body.model,
        folder_id=request_body.folder_id,
        settings=request_body.settings,
    )

    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.CONVERSATION_CREATE,
        resource_type=AuditResource.CONVERSATION,
        resource_id=conversation.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=safe_tenant_id,
        description=f"建立對話: {conversation.title}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )

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
    # NOTE: 防止 title 被更新為空字串
    if 'title' in update_data:
        update_data['title'] = (update_data['title'] or '').strip() or conversation.title
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
    request: Request = None,
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
    
    conversation_title = conversation.title
    
    await db.delete(conversation)
    await db.commit()
    
    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.CONVERSATION_DELETE,
        resource_type=AuditResource.CONVERSATION,
        resource_id=conversation_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"刪除對話: {conversation_title}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[str] = Query(None, description="游標分頁：回傳此 message_id 之前的訊息"),
):
    """
    取得對話訊息列表

    - `before_id` 為空時：回傳最新的 `limit` 筆（供初次載入）
    - `before_id` 有值時：回傳比該訊息更早的 `limit` 筆（供無限捲動）
    """
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
    
    # 查詢訊息（支援 cursor 分頁）
    query = select(Message).where(Message.conversation_id == conversation_id)
    
    if before_id:
        # 查出 before_id 的 created_at，再取更早的訊息
        cursor_result = await db.execute(
            select(Message.created_at).where(Message.id == before_id)
        )
        cursor_time = cursor_result.scalar_one_or_none()
        if cursor_time:
            query = query.where(Message.created_at < cursor_time)
    
    # 先 DESC 取最新的 N 筆，再反轉為 ASC 確保時間順序正確
    query = query.order_by(Message.created_at.desc()).limit(limit)
    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))
    
    return [MessageResponse.model_validate(m) for m in messages]


@router.get("/{conversation_id}/verify-chain")
async def verify_conversation_chain(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    驗證對話歷史完整性 (Hash防篡改鏈)
    """
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

    from app.services.hash_chain_service import verify_chain
    return await verify_chain(db, conversation_id)
