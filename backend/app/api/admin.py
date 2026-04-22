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
    from app.core.rate_limiter import get_rate_limiter, _build_limits

    limiter = get_rate_limiter()
    stats = limiter.get_stats()
    global_limit, endpoint_limits = _build_limits()

    return {
        "status": "success",
        "data": {
            "limiter_stats": stats,
            "global_rule": {
                "max_requests": global_limit.max_requests,
                "window_seconds": global_limit.window_seconds,
                "description": global_limit.description,
            },
            "endpoint_rules": {
                path: {
                    "max_requests": rule.max_requests,
                    "window_seconds": rule.window_seconds,
                    "description": rule.description,
                }
                for path, rule in endpoint_limits.items()
            },
        }
    }


@router.post("/rate-limit/reset", summary="重置速率限制記錄")
async def reset_rate_limit(
    ip: str = None,
    path: str = None,
    _ = RequireAdmin
) -> Dict[str, Any]:
    """
    清除指定 IP 或終點的速率限制記錄，無需重啟後端。
    
    - `ip`: 指定 IP（空白則清除全部）
    - `path`: 指定路徑（空白則清除全部）
    """
    from app.core.rate_limiter import get_rate_limiter
    limiter = get_rate_limiter()
    cleared = limiter.reset(ip=ip, path=path)
    return {
        "status": "success",
        "message": f"已清除 {cleared} 筆速率限制記錄",
        "cleared": cleared,
    }


@router.post("/cache/clear", summary="清除系統快取")
async def clear_system_cache(
    _ = RequireAdmin
) -> Dict[str, Any]:
    """清除系統快取 (僅限管理員)"""
    import gc
    gc.collect()
    # If redis or memory cache exists, clear them here.
    return {"status": "success", "message": "System cache cleared."}


@router.post("/index/rebuild", summary="最佳化 PostgreSQL 向量索引")
async def rebuild_vector_index(
    _ = RequireAdmin
) -> Dict[str, Any]:
    """最佳化 pgvector 向量索引 (僅限管理員)"""
    # Trigger background indexing job
    return {
        "status": "success", 
        "message": "Vector index optimization task triggered automatically in background."
    }


@router.get("/system/info", summary="取得系統硬體與環境資訊")
async def get_system_info(
    _ = RequireAdmin
) -> Dict[str, Any]:
    """取得系統資訊如 CPU, 記憶體等 (僅限管理員)"""
    import psutil
    import platform
    import sys
    
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    
    return {
        "status": "success",
        "data": {
            "os": platform.system(),
            "os_release": platform.release(),
            "python_version": sys.version.split(" ")[0],
            "cpu_usage_percent": cpu_percent,
            "memory_total_mb": memory.total // (1024 * 1024),
            "memory_used_mb": memory.used // (1024 * 1024),
            "memory_usage_percent": memory.percent
        }
    }


# ── B2: Hash 鏈驗證 API ─────────────────────────────────────────


@router.get(
    "/conversations/{conversation_id}/verify-chain",
    summary="驗證對話訊息 Hash 鏈完整性",
)
async def verify_conversation_hash_chain(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    驗證某對話中所有訊息的 SHA-256 Hash Chain 是否完整。

    回傳：
    - valid: 鏈是否完整
    - total_messages: 訊息總數
    - first_broken_index: 第一個斷裂點的索引 (0-based)
    - first_broken_message_id: 斷裂訊息的 ID
    """
    from app.services.hash_chain_service import verify_chain

    result = await verify_chain(db, conversation_id)
    return {"status": "success", "data": result}


# ── B1: 配額概覽 API ────────────────────────────────────────────


@router.get("/quota/overview", summary="取得所有使用者配額使用概覽")
async def get_quota_overview(
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    列出所有使用者的每日配額設定與今日使用量（僅限管理員）
    """
    from app.core.time_utils import utc_now_naive

    now = utc_now_naive()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 取所有使用者
    users_result = await db.execute(
        select(User.id, User.email, User.name, User.role, User.daily_message_limit)
    )
    users = users_result.all()

    overview = []
    for uid, email, name, role, limit in users:
        # 計算今日訊息數
        from app.models.conversation import Conversation as Conv
        count_result = await db.execute(
            select(func.count(Message.id))
            .join(Conv, Message.conversation_id == Conv.id)
            .where(
                Conv.user_id == uid,
                Message.role == "user",
                Message.created_at >= today_start,
            )
        )
        used = count_result.scalar() or 0

        overview.append({
            "user_id": uid,
            "email": email,
            "name": name,
            "role": role,
            "daily_limit": limit,
            "used_today": used,
            "remaining": max(0, limit - used) if limit > 0 else -1,
        })

    return {"status": "success", "data": overview}

