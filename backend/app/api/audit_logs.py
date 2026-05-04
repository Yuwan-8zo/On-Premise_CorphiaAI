"""
審計日誌 API 路由

提供審計日誌查詢、篩選與匯出功能 (僅限 Admin/Engineer)
"""

import csv
import io
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, desc

from app.api.deps import CurrentUser, DbSession
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse, AuditLogListResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["審計日誌"])


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
    # 建立基礎查詢
    query = select(AuditLog)
    count_query_base = select(func.count(AuditLog.id))

    # 非 engineer 只能查看自己租戶的
    if current_user.role != "engineer":
        query = query.where(AuditLog.tenant_id == current_user.tenant_id)
        count_query_base = count_query_base.where(
            AuditLog.tenant_id == current_user.tenant_id
        )

    # 篩選條件
    if action:
        query = query.where(AuditLog.action == action)
        count_query_base = count_query_base.where(AuditLog.action == action)

    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query_base = count_query_base.where(
            AuditLog.resource_type == resource_type
        )

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query_base = count_query_base.where(AuditLog.user_id == user_id)

    if search:
        # FIX: 跳脫 % / _ / \，否則使用者輸入的萬用字元會被當 LIKE 通配
        if len(search) > 256:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="search 字串過長",
            )
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_filter = f"%{escaped}%"
        query = query.where(
            AuditLog.description.ilike(search_filter, escape="\\")
            | AuditLog.user_email.ilike(search_filter, escape="\\")
        )
        count_query_base = count_query_base.where(
            AuditLog.description.ilike(search_filter, escape="\\")
            | AuditLog.user_email.ilike(search_filter, escape="\\")
        )

    if start_date:
        # FIX: AuditLog.created_at 是 DateTime（不帶 timezone，naive UTC 儲存）。
        # 上一版誤用 to_aware_utc 變成 aware datetime，asyncpg 拿來跟 naive column
        # 比較直接 raise「can't subtract offset-naive and offset-aware datetimes」。
        # 改用 to_naive_utc：naive 字串視為 UTC、aware 字串轉到 UTC 後去掉 tzinfo。
        from datetime import datetime
        from app.core.time_utils import to_naive_utc

        try:
            start_dt = to_naive_utc(datetime.fromisoformat(start_date))
            if start_dt is not None:
                query = query.where(AuditLog.created_at >= start_dt)
                count_query_base = count_query_base.where(
                    AuditLog.created_at >= start_dt
                )
        except ValueError:
            pass

    if end_date:
        from datetime import datetime
        from app.core.time_utils import to_naive_utc

        try:
            end_dt = to_naive_utc(datetime.fromisoformat(end_date))
            if end_dt is not None:
                query = query.where(AuditLog.created_at <= end_dt)
                count_query_base = count_query_base.where(
                    AuditLog.created_at <= end_dt
                )
        except ValueError:
            pass

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
        total_pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get("/export/csv")
async def export_audit_logs_csv(
    current_user: CurrentUser,
    db: DbSession,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    匯出審計日誌為 CSV 格式（僅限 Admin / Engineer）
    """
    logs = await _fetch_export_logs(
        db, current_user, action, resource_type, start_date, end_date
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
        writer.writerow([
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
        ])

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
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    匯出審計日誌為 JSON 格式（僅限 Admin / Engineer）
    """
    logs = await _fetch_export_logs(
        db, current_user, action, resource_type, start_date, end_date
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
    start_date: Optional[str],
    end_date: Optional[str],
    max_rows: int = 5000,
):
    """內部共用：取得匯出用審計日誌資料"""
    query = select(AuditLog)

    if current_user.role != "engineer":
        query = query.where(AuditLog.tenant_id == current_user.tenant_id)

    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)

    if start_date:
        from datetime import datetime
        from app.core.time_utils import to_naive_utc
        try:
            sd = to_naive_utc(datetime.fromisoformat(start_date))
            if sd is not None:
                query = query.where(AuditLog.created_at >= sd)
        except ValueError:
            pass

    if end_date:
        from datetime import datetime
        from app.core.time_utils import to_naive_utc
        try:
            ed = to_naive_utc(datetime.fromisoformat(end_date))
            if ed is not None:
                query = query.where(AuditLog.created_at <= ed)
        except ValueError:
            pass

    query = query.order_by(desc(AuditLog.created_at)).limit(max_rows)

    result = await db.execute(query)
    return result.scalars().all()
