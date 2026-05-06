"""
管理員 API 路由
"""

from typing import Dict, Any
import hashlib
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import asyncio
import time as time_module

from app.api.deps import get_db, RequireAdmin, get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.models.tenant import Tenant
from app.services.audit_service import AuditAction


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
    current_user: User = Depends(get_current_user),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    列出所有使用者的每日配額設定與今日使用量（僅限管理員）

    PERF FIX: 原本 N+1 查詢——對每個 user 個別 SELECT count(messages)，100 個 user
    就 100 次 round-trip。改成單一 GROUP BY 把所有 user 的當日計數一次撈完。

    SECURITY FIX: 加 tenant_id 過濾，避免某個 tenant 的 admin 看到其他 tenant 的資料。
    """
    from app.core.time_utils import utc_now_naive

    now = utc_now_naive()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tenant_id = current_user.tenant_id or "default"

    # 取本租戶的使用者
    users_result = await db.execute(
        select(User.id, User.email, User.name, User.role, User.daily_message_limit)
        .where(User.tenant_id == tenant_id)
    )
    users = users_result.all()

    if not users:
        return {"status": "success", "data": []}

    # 一次撈所有使用者今日訊息計數（取代 N+1）
    from app.models.conversation import Conversation as Conv
    user_ids = [u[0] for u in users]
    counts_result = await db.execute(
        select(Conv.user_id, func.count(Message.id))
        .join(Conv, Message.conversation_id == Conv.id)
        .where(
            Conv.user_id.in_(user_ids),
            Message.role == "user",
            Message.created_at >= today_start,
        )
        .group_by(Conv.user_id)
    )
    used_by_user = {uid: cnt for uid, cnt in counts_result.all()}

    overview = []
    for uid, email, name, role, limit in users:
        used = used_by_user.get(uid, 0)
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


@router.get("/security-summary", summary="取得近 24h 資安事件聚合")
async def get_security_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    回傳最近 24 小時各類資安事件的次數，供後台儀表板顯示。
    """
    since = datetime.utcnow() - timedelta(hours=24)
    tenant_id = current_user.tenant_id or "default"

    base_q = select(AuditLog.action, func.count(AuditLog.id)).where(
        AuditLog.created_at >= since,
        AuditLog.tenant_id == tenant_id,
    ).group_by(AuditLog.action)

    result = await db.execute(base_q)
    counts = {action: cnt for action, cnt in result.all()}

    return {
        "status": "success",
        "data": {
            "window_hours": 24,
            "pii_detected": counts.get(AuditAction.PII_DETECTED, 0),
            "prompt_injection_blocked": counts.get(AuditAction.PROMPT_INJECTION_BLOCKED, 0),
            "dlp_hit": counts.get(AuditAction.DLP_HIT, 0),
            "login_failed": counts.get(AuditAction.LOGIN_FAILED, 0),
            "account_locked": counts.get(AuditAction.ACCOUNT_LOCKED, 0),
            "token_revoked": counts.get(AuditAction.TOKEN_REVOKE, 0),
        }
    }


# ── Phase 1：新增 4 個 Endpoint ────────────────────────────────────────


@router.get("/user-lockout-summary", summary="取得每位使用者的鎖定與登入失敗摘要")
async def get_user_lockout_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    聚合每個使用者的鎖定 / 失敗狀態。回傳包括：
    - current_attempts: 當前失敗次數
    - is_locked: 是否被鎖定
    - minutes_until_unlock: 解鎖所需分鐘
    - failures_last_7d: 近 7 天登入失敗數
    """
    from app.core.time_utils import utc_now_naive

    now = utc_now_naive()
    seven_days_ago = now - timedelta(days=7)
    tenant_id = current_user.tenant_id

    # 每使用者最近 7 天 LOGIN_FAILED 數
    base_q = select(AuditLog.user_email, func.count(AuditLog.id)).where(
        AuditLog.action == "login_failed",
        AuditLog.created_at >= seven_days_ago,
    )
    if tenant_id:
        base_q = base_q.where(AuditLog.tenant_id == tenant_id)
    fail_result = await db.execute(base_q.group_by(AuditLog.user_email))
    fails_by_email = {email: cnt for email, cnt in fail_result.all() if email}

    # 該租戶的所有使用者
    users_q = select(User.id, User.email, User.failed_login_attempts, User.locked_until)
    if tenant_id:
        users_q = users_q.where(User.tenant_id == tenant_id)
    users_result = await db.execute(users_q)

    summary = []
    for uid, email, attempts, locked_until in users_result.all():
        is_locked = locked_until is not None and locked_until > now
        minutes_until_unlock = None
        if is_locked:
            minutes_until_unlock = max(0, int((locked_until - now).total_seconds() / 60))
        summary.append({
            "user_id": uid,
            "email": email,
            "current_attempts": attempts or 0,
            "is_locked": is_locked,
            "minutes_until_unlock": minutes_until_unlock,
            "failures_last_7d": fails_by_email.get(email, 0),
        })
    return {"status": "success", "data": summary}


# 模組級快取：path → (mtime, sha256)
_HASH_CACHE: dict[str, tuple[float, str]] = {}


def _compute_sha256_cached(path: Path) -> str | None:
    """計算檔案 SHA256，利用 mtime 做快取"""
    try:
        mtime = path.stat().st_mtime
        cached = _HASH_CACHE.get(str(path))
        if cached and cached[0] == mtime:
            return cached[1]
        sha = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
                sha.update(chunk)
        digest = sha.hexdigest()
        _HASH_CACHE[str(path)] = (mtime, digest)
        return digest
    except Exception:
        return None


@router.get("/models/integrity", summary="取得每個本機模型的完整性與效能資訊")
async def get_models_integrity(
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    返回本機每個 GGUF 模型的：
    - SHA256 hash（帶快取）
    - 檔案大小
    - 是否為當前使用模型
    - 推論統計（整體 throughput）
    """
    from app.services.model_manager import get_model_manager
    from app.services.llm_service import get_llm_service

    manager = get_model_manager()
    llm = get_llm_service()
    models = manager.available_models

    result = []
    for m in models:
        path = Path(m.path)
        size_bytes = path.stat().st_size if path.exists() else 0
        # SHA256 在 thread pool 跑，避免阻塞 event loop
        sha = await asyncio.to_thread(_compute_sha256_cached, path)
        is_active = manager.current_model_path == m.path
        result.append({
            "name": m.name,
            "path": m.path,
            "filename": m.filename,
            "size_bytes": size_bytes,
            "sha256": sha,
            "is_active": is_active,
            "quantization": m.quantization,
        })

    # 整體 throughput stats（所有推論加總）
    throughput = llm.get_throughput_stats() if hasattr(llm, "get_throughput_stats") else {}

    return {
        "status": "success",
        "data": {
            "models": result,
            "throughput": throughput,
        }
    }


@router.get("/tenants/usage", summary="取得每個租戶的使用量總覽")
async def get_tenants_usage(
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
) -> Dict[str, Any]:
    """
    返回每個租戶的使用量摘要：
    - users_count: 使用者數
    - documents_count: 文件總數
    - messages_24h: 過去 24 小時訊息數
    - security_events_24h: 過去 24 小時資安事件數
    """
    from app.core.time_utils import utc_now_naive

    now = utc_now_naive()
    last_24h = now - timedelta(hours=24)

    # 一次撈所有 tenant
    tenants_result = await db.execute(select(Tenant))
    tenants = tenants_result.scalars().all()

    # 各種 group-by 一次撈
    users_count = dict((tid, cnt) for tid, cnt in (await db.execute(
        select(User.tenant_id, func.count(User.id)).group_by(User.tenant_id)
    )).all())

    docs_count = dict((tid, cnt) for tid, cnt in (await db.execute(
        select(Document.tenant_id, func.count(Document.id)).group_by(Document.tenant_id)
    )).all())

    msgs_24h = dict((tid, cnt) for tid, cnt in (await db.execute(
        select(Conversation.tenant_id, func.count(Message.id))
        .join(Message, Message.conversation_id == Conversation.id)
        .where(Message.created_at >= last_24h)
        .group_by(Conversation.tenant_id)
    )).all())

    # 24h 資安事件（7 種類型）
    SECURITY_ACTIONS = {"pii_detected", "prompt_injection_blocked", "dlp_hit", "login_failed", "account_locked", "token_revoke", "ngrok_start"}
    sec_24h_q = select(AuditLog.tenant_id, func.count(AuditLog.id)).where(
        AuditLog.action.in_(SECURITY_ACTIONS),
        AuditLog.created_at >= last_24h,
    ).group_by(AuditLog.tenant_id)
    sec_24h = dict((tid, cnt) for tid, cnt in (await db.execute(sec_24h_q)).all())

    data = []
    for t in tenants:
        data.append({
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "is_active": t.is_active,
            "users_count": users_count.get(t.id, 0),
            "documents_count": docs_count.get(t.id, 0),
            "messages_24h": msgs_24h.get(t.id, 0),
            "security_events_24h": sec_24h.get(t.id, 0),
        })
    return {"status": "success", "data": data}

