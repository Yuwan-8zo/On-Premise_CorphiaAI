"""
B4: Admin 對話重播 API

管理員可以：
1. 查看任一使用者的對話列表
2. 讀取任一對話的完整訊息歷史（含 hash chain 狀態）
3. 驗證對話完整性

用途：合規稽核、內容審查、事件調查
"""

import logging
from typing import Dict, List, Any, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DbSession, RequireAdmin
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/replay", tags=["admin-replay"])


@router.get("/users", summary="列出所有使用者（供重播選擇）")
async def list_users_for_replay(
    db: DbSession,
    current_user: CurrentUser,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """
    列出所有使用者供管理員選擇（僅限 Admin / Engineer）
    """
    if current_user.role not in ("admin", "engineer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足")

    query = select(
        User.id, User.email, User.name, User.role, User.tenant_id
    )

    # 非 engineer 只能看自己租戶
    if current_user.role != "engineer":
        query = query.where(User.tenant_id == current_user.tenant_id)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.email.ilike(search_filter)) | (User.name.ilike(search_filter))
        )

    query = query.order_by(User.created_at)
    result = await db.execute(query)
    users = result.all()

    return {
        "status": "success",
        "data": [
            {
                "id": uid,
                "email": email,
                "name": name,
                "role": role,
                "tenant_id": tid,
            }
            for uid, email, name, role, tid in users
        ],
    }


@router.get(
    "/users/{target_user_id}/conversations",
    summary="查看指定使用者的對話列表",
)
async def list_user_conversations(
    target_user_id: str,
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """
    查看指定使用者的所有對話（僅限 Admin / Engineer）
    """
    if current_user.role not in ("admin", "engineer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足")

    # 非 engineer 檢查租戶歸屬
    if current_user.role != "engineer":
        target_result = await db.execute(
            select(User.tenant_id).where(User.id == target_user_id)
        )
        target_tenant = target_result.scalar_one_or_none()
        if target_tenant != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無法查看其他租戶的使用者",
            )

    # 計數
    count_result = await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.user_id == target_user_id
        )
    )
    total = count_result.scalar() or 0

    # 分頁查詢
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == target_user_id)
        .order_by(desc(Conversation.updated_at))
        .offset(offset)
        .limit(page_size)
    )
    conversations = result.scalars().all()

    return {
        "status": "success",
        "data": [
            {
                "id": c.id,
                "title": c.title,
                "model": c.model,
                "message_count": c.message_count,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in conversations
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/conversations/{conversation_id}/messages",
    summary="重播對話：讀取完整訊息記錄",
)
async def replay_conversation_messages(
    conversation_id: str,
    db: DbSession,
    current_user: CurrentUser,
    include_hash: bool = Query(False, description="是否包含 hash chain 資訊"),
) -> Dict[str, Any]:
    """
    讀取指定對話的完整訊息記錄（重播模式）。

    設定 include_hash=true 可同時回傳每則訊息的 content_hash / prev_hash，
    用於前端或報告顯示 Hash Chain 驗證結果。
    """
    if current_user.role not in ("admin", "engineer"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足")

    # 取得對話
    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = conv_result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="對話不存在"
        )

    # 租戶檢查
    if current_user.role != "engineer":
        if conversation.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="無法查看其他租戶的對話",
            )

    # 取得訊息
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    # 格式化
    data = []
    for m in messages:
        entry = {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tokens": m.tokens,
            "sources": m.sources,
            "rating": m.rating,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        if include_hash:
            entry["content_hash"] = m.content_hash
            entry["prev_hash"] = m.prev_hash
        data.append(entry)

    return {
        "status": "success",
        "conversation": {
            "id": conversation.id,
            "title": conversation.title,
            "user_id": conversation.user_id,
            "model": conversation.model,
            "created_at": conversation.created_at.isoformat()
            if conversation.created_at
            else None,
        },
        "messages": data,
        "total": len(data),
    }
