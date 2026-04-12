"""
管理員 API 路由
"""

from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, RequireAdmin
from app.models.user import User
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", summary="取得系統統計數據")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin
) -> Dict[str, Any]:
    """
    取得系統統計數據 (僅限管理員)
    """
    # 查詢總使用者數
    user_count_result = await db.execute(select(func.count(User.id)))
    total_users = user_count_result.scalar() or 0
    
    # 查詢總對話數
    conv_count_result = await db.execute(select(func.count(Conversation.id)))
    total_conversations = conv_count_result.scalar() or 0
    
    # 查詢總文件數
    doc_count_result = await db.execute(select(func.count(Document.id)))
    total_documents = doc_count_result.scalar() or 0
    
    # 查詢總訊息數
    msg_count_result = await db.execute(select(func.count(Message.id)))
    total_messages = msg_count_result.scalar() or 0
    
    return {
        "status": "success",
        "data": {
            "totalUsers": total_users,
            "totalConversations": total_conversations,
            "totalDocuments": total_documents,
            "totalMessages": total_messages
        }
    }


@router.get("/rate-limit/stats", summary="取得速率限制統計")
async def get_rate_limit_stats(
    _ = RequireAdmin
) -> Dict[str, Any]:
    """
    取得速率限制器的即時統計資料 (僅限管理員)
    """
    from app.core.rate_limiter import get_rate_limiter, GLOBAL_RATE_LIMIT, ENDPOINT_RATE_LIMITS

    limiter = get_rate_limiter()
    stats = limiter.get_stats()

    return {
        "status": "success",
        "data": {
            "limiter_stats": stats,
            "global_rule": {
                "max_requests": GLOBAL_RATE_LIMIT.max_requests,
                "window_seconds": GLOBAL_RATE_LIMIT.window_seconds,
                "description": GLOBAL_RATE_LIMIT.description,
            },
            "endpoint_rules": {
                path: {
                    "max_requests": rule.max_requests,
                    "window_seconds": rule.window_seconds,
                    "description": rule.description,
                }
                for path, rule in ENDPOINT_RATE_LIMITS.items()
            },
        }
    }
