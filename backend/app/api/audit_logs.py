"""
審計日誌 API 路由

提供審計日誌查詢、篩選與匯出功能 (僅限 Admin/Engineer)
"""

import csv
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc

from app.core.query_utils import like_contains, page_count
from app.core.tenancy import audit_scope
from app.core.time_utils import to_naive_utc
from app.api.deps import CurrentUser, DbSession, RequireAdmin
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse, AuditLogListResponse

logger = logging.getLogger(__name__)

# 稽核紀錄只開放管理員與工程師（查詢、匯出 CSV／JSON 都適用）
router = APIRouter(prefix="/audit-logs", tags=["審計日誌"], dependencies=[RequireAdmin])


def _action_filter(action: str):
    """單一操作類型用等於比對；逗號分隔的多個類型用 IN。"""
    actions = [a.strip() for a in action.split(",") if a.strip()]
    if len(actions) > 1:
        return AuditLog.action.in_(actions)
    return AuditLog.action == (actions[0] if actions else action)


def _parse_time(value: Optional[str], end: bool = False) -> Optional[datetime]:
    """
    篩選時間轉成資料庫用的 naive UTC。
    只有日期（YYYY-MM-DD）時：起日＝當天 00:00，迄日＝隔天 00:00（不含），整天都算進來。
    格式錯誤回 None（不套用這個條件）。
    """
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if end and len(value.strip()) == 10:
        dt += timedelta(days=1)
    return to_naive_utc(dt)


def _filters(
    current_user,
    action: Optional[str],
    resource_type: Optional[str],
    user_id: Optional[str],
    search: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> list:
    """清單與匯出共用的篩選條件（範圍規則見 core/tenancy：沒有租戶的紀錄算 default）"""
    conds = []
    scope = audit_scope(current_user)
    if scope is not None:
        conds.append(scope)
    if action:
        # 前端「只看資安事件」會送多個操作類型，以逗號分隔
        conds.append(_action_filter(action))
    if resource_type:
        conds.append(AuditLog.resource_type == resource_type)
    if user_id:
        conds.append(AuditLog.user_id == user_id)
    if search:
        if len(search) > 256:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="search 字串過長")
        # 跳脫 % / _ / \，否則使用者輸入的萬用字元會被當 LIKE 通配
        f = like_contains(search)
        conds.append(AuditLog.description.ilike(f, escape="\\") | AuditLog.user_email.ilike(f, escape="\\"))
    start = _parse_time(start_date)
    if start is not None:
        conds.append(AuditLog.created_at >= start)
    end = _parse_time(end_date, end=True)
    if end is not None:
        # 只給日期時是「隔天 00:00 之前」，給完整時間時包含那一刻
        conds.append(AuditLog.created_at < end if len(end_date.strip()) == 10 else AuditLog.created_at <= end)
    return conds


# 試算表會把 = + - @ 開頭的格子當公式執行（例如在登入頁信箱欄輸入 =HYPERLINK(...)）
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value):
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    查詢審計日誌（僅限 Admin / Engineer）

    支援篩選條件:
    - action: 操作類型 (login_success, document_upload, ...)
    - resource_type: 資源類型 (auth, user, conversation, document, model)
    - user_id: 操作者 ID
    - search: 關鍵字搜尋 (搜尋 description / user_email)
    - start_date: 起始日期 (ISO 格式)
    - end_date: 結束日期 (ISO 格式)
    """
    conditions = _filters(current_user, action, resource_type, user_id, search, start_date, end_date)
    query = select(AuditLog).where(*conditions)
    count_query_base = select(func.count(AuditLog.id)).where(*conditions)

    # 取得總數
    total_result = await db.execute(count_query_base)
    total = total_result.scalar() or 0

    # 分頁排序
    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    return AuditLogListResponse(
        data=[AuditLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=page_count(total, page_size),
    )


@router.get("/export/csv")
async def export_audit_logs_csv(
    current_user: CurrentUser,
    db: DbSession,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    匯出審計日誌為 CSV 格式（僅限 Admin / Engineer）
    """
    logs = await _fetch_export_logs(
        db, current_user, action, resource_type, user_id, search, start_date, end_date
    )

    # 建立 CSV
    output = io.StringIO()
    # NOTE: 加入 BOM 讓 Excel 正確識別 UTF-8
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "ID", "時間", "操作", "資源類型", "資源ID",
        "操作者ID", "操作者Email", "描述", "IP位址", "User-Agent"
    ])

    for log in logs:
        writer.writerow([_csv_safe(v) for v in [
            log.id,
            log.created_at.isoformat() if log.created_at else "",
            log.action,
            log.resource_type,
            log.resource_id or "",
            log.user_id or "",
            log.user_email or "",
            log.description or "",
            log.ip_address or "",
            log.user_agent or "",
        ]])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=audit_logs.csv"
        },
    )


@router.get("/export/json")
async def export_audit_logs_json(
    current_user: CurrentUser,
    db: DbSession,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    匯出審計日誌為 JSON 格式（僅限 Admin / Engineer）
    """
    logs = await _fetch_export_logs(
        db, current_user, action, resource_type, user_id, search, start_date, end_date
    )

    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "tenant_id": log.tenant_id,
            "description": log.description,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
        })

    json_content = json.dumps(data, ensure_ascii=False, indent=2)

    return StreamingResponse(
        iter([json_content]),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=audit_logs.json"
        },
    )


async def _fetch_export_logs(
    db: DbSession,
    current_user,
    action: Optional[str],
    resource_type: Optional[str],
    user_id: Optional[str],
    search: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    max_rows: int = 5000,
):
    """內部共用：取得匯出用審計日誌資料（條件和清單完全一樣）"""
    conditions = _filters(current_user, action, resource_type, user_id, search, start_date, end_date)
    query = select(AuditLog).where(*conditions).order_by(desc(AuditLog.created_at)).limit(max_rows)
    result = await db.execute(query)
    return result.scalars().all()
