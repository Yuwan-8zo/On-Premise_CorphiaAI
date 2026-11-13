"""
對話 API
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Request

from sqlalchemy import select, func, desc, or_

from app.api.lookups import ensure_own_folder, get_own_conversation
from app.core.query_utils import like_contains
from app.api.deps import CurrentUser, DbSession
from app.models.conversation import Conversation
from app.models.message import Message
import app.services.message_tree as message_tree
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    MessageResponse,
    SharedConversationResponse,
)
from app.services.audit_service import write_audit_log, AuditAction, AuditResource
from app.services.generated_files import attach_to_messages
from app.core.request_utils import get_client_ip, get_user_agent

router = APIRouter(prefix="/conversations", tags=["對話"])

def _safe_title(title: str) -> str:
    """對話標題常直接取自第一則訊息，必須先遮罩個資，避免身分證等出現在側邊欄與資料庫。"""
    from app.core.config import settings as _settings
    from app.services.pii_masking_service import mask_pii
    if not title or not _settings.enable_pii_masking:
        return title
    return mask_pii(title)["masked_text"]



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
    - 支援搜尋：標題或訊息內容（只找自己的對話）
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
            raise HTTPException(status_code=400, detail="search 字串過長")
        pattern = like_contains(search)
        # 標題符合，或對話裡有任何一則訊息的內容符合（子查詢也限定是自己的對話）
        in_messages = (
            select(Message.conversation_id)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .where(Conversation.user_id == current_user.id, Message.content.ilike(pattern, escape="\\"))
        )
        query = query.where(or_(Conversation.title.ilike(pattern, escape="\\"), Conversation.id.in_(in_messages)))
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

    desired = current_user.effective_tenant_id

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
    await ensure_own_folder(db, request_body.folder_id, current_user)

    # 自我修復：若 user 的 tenant_id 指向不存在的 tenant，先 remap 到 default
    safe_tenant_id = await _ensure_valid_tenant_id(db, current_user)

    conversation = Conversation(
        tenant_id=safe_tenant_id,
        user_id=current_user.id,
        title=_safe_title(request_body.title),
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
    conversation = await get_own_conversation(db, conversation_id, current_user)
    
    return ConversationResponse.model_validate(conversation)


@router.put("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    request: ConversationUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """更新對話"""
    conversation = await get_own_conversation(db, conversation_id, current_user)
    
    # 更新欄位
    update_data = request.model_dump(exclude_unset=True)
    if update_data.get("folder_id"):
        await ensure_own_folder(db, update_data["folder_id"], current_user)
    # NOTE: 防止 title 被更新為空字串
    if 'title' in update_data:
        update_data['title'] = (update_data['title'] or '').strip() or conversation.title
        update_data['title'] = _safe_title(update_data['title'])
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
    conversation = await get_own_conversation(db, conversation_id, current_user)
    
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
        tenant_id=conversation.tenant_id,
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
    await get_own_conversation(db, conversation_id, current_user)
    
    # 只回畫面上這一條對話（修改或重答留下的其他版本不在這條上，用 version_ids 告訴前端可以切換）
    path, everything = await message_tree.current_path(db, conversation_id)
    if before_id:
        # 游標分頁：回這一則之前的
        index = next((i for i, m in enumerate(path) if m.id == before_id), None)
        if index is not None:
            path = path[:index]
    messages = path[-limit:]

    # AI 產出的檔案（Word／Excel／簡報）掛到各自的訊息上
    await attach_to_messages(db, messages)
    return _with_versions(messages, everything)


def _with_versions(messages: list[Message], everything: list[Message]) -> List[MessageResponse]:
    """每則訊息附上同一個位置的所有版本（只有一版就不附，前端不顯示切換鈕）"""
    siblings = message_tree.versions(everything)
    out = []
    for m in messages:
        ids = siblings.get(m.id, [])
        out.append(MessageResponse.model_validate(m).model_copy(update={"version_ids": ids if len(ids) > 1 else []}))
    return out


@router.post("/{conversation_id}/messages/{message_id}/activate", response_model=List[MessageResponse])
async def activate_version(
    conversation_id: str,
    message_id: str,
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(50, ge=1, le=200),
):
    """
    對話分支：切換到某一版（修改前的問題、或另一次的回答）。
    畫面改成顯示那一版、以及它底下最新的內容；之後的新訊息接在那後面。回傳切換後的訊息列表。
    """
    await get_own_conversation(db, conversation_id, current_user)
    everything = await message_tree.load_all(db, conversation_id)
    if not any(m.id == message_id for m in everything):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="訊息不存在")
    leaf_id = message_tree.deepest_leaf(everything, message_id)
    await message_tree.set_leaf_id(db, conversation_id, leaf_id)
    await db.commit()
    messages = message_tree.active_path(everything, leaf_id)[-limit:]
    await attach_to_messages(db, messages)
    return _with_versions(messages, everything)


@router.get("/{conversation_id}/verify-chain")
async def verify_conversation_chain(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    驗證對話歷史完整性 (Hash防篡改鏈)
    """
    await get_own_conversation(db, conversation_id, current_user)

    from app.services.hash_chain_service import verify_chain
    return await verify_chain(db, conversation_id)


# ── 分享（同租戶唯讀）────────────────────────────────────────────
# 對話主人按「分享」才會打開；打開後同租戶的人拿到連結可以唯讀觀看，主人自己永遠看得到。
# 沒分享、不同租戶、不存在都回 404（不透露對話是否存在）。

SHARED_KEY = "shared"
SHARED_MESSAGE_LIMIT = 500


@router.post("/{conversation_id}/share")
async def share_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
    request: Request,
):
    """開啟分享：同租戶的人可以用連結唯讀觀看"""
    conversation = await get_own_conversation(db, conversation_id, current_user)
    if not (conversation.settings or {}).get(SHARED_KEY):
        # JSON 欄位要換一個新的 dict，SQLAlchemy 才知道內容變了
        conversation.settings = {**(conversation.settings or {}), SHARED_KEY: True}
        await db.commit()
        await write_audit_log(
            db=db,
            action=AuditAction.CONVERSATION_UPDATE,
            resource_type=AuditResource.CONVERSATION,
            resource_id=conversation_id,
            user_id=current_user.id,
            user_email=current_user.email,
            tenant_id=conversation.tenant_id,
            description=f"分享對話（同租戶唯讀）: {conversation.title}",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
    return {"shared": True}


@router.delete("/{conversation_id}/share")
async def unshare_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """關閉分享：之後只有自己看得到"""
    conversation = await get_own_conversation(db, conversation_id, current_user)
    settings = dict(conversation.settings or {})
    if settings.pop(SHARED_KEY, None):
        conversation.settings = settings
        await db.commit()
    return {"shared": False}


@router.get("/{conversation_id}/shared", response_model=SharedConversationResponse)
async def view_shared_conversation(
    conversation_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """唯讀觀看分享的對話：主人自己，或主人已分享且同租戶的人"""
    from app.core.tenancy import same_tenant
    from app.models.user import User

    conversation = await db.get(Conversation, conversation_id)
    is_owner = conversation is not None and conversation.user_id == current_user.id
    allowed = conversation is not None and (
        is_owner
        or ((conversation.settings or {}).get(SHARED_KEY) and same_tenant(current_user, conversation.tenant_id))
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="對話不存在或沒有分享")

    # 重新讀一次：分享開關改過後「最後更新時間」是資料庫算的，要讀回來才能用
    await db.refresh(conversation)
    owner = await db.get(User, conversation.user_id)
    # 分享的是擁有者畫面上那一條對話（其他版本不分享）
    path, _everything = await message_tree.current_path(db, conversation_id)
    shared_messages = path[:SHARED_MESSAGE_LIMIT]
    return SharedConversationResponse(
        conversation=ConversationResponse.model_validate(conversation),
        # 分享頁只給回答本身：思考過程是給本人回顧用的，不隨分享出去
        messages=[MessageResponse.model_validate(m).model_copy(update={"reasoning": None}) for m in shared_messages],
        owner_name=owner.name if owner else "",
        is_owner=is_owner,
    )
