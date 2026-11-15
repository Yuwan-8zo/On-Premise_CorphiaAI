"""
租戶範圍：「這個人看得到哪些資料」的共用規則，各 API 不要自己寫 tenant_id 比對。

規則：
  - 帳號沒有指定租戶（tenant_id 為空）＝ default 租戶（和 User.effective_tenant_id 一致）
  - engineer（系統管理員）看得到所有租戶
  - 其他人只看得到自己租戶
  - 稽核紀錄同一條規則：tenant_id 為空（登入失敗等還不知道是誰的事件、沒有租戶的帳號）算 default
"""
from typing import Any, Optional

from sqlalchemy import func

DEFAULT_TENANT_ID = "default"


async def tenant_is_active(db: Any, user: Any) -> bool:
    """使用者所屬的租戶有沒有被停用（租戶不存在也當作可用，交給其他流程自我修復）"""
    from sqlalchemy import select

    from app.models.tenant import Tenant

    active = (await db.execute(select(Tenant.is_active).where(Tenant.id == user.effective_tenant_id))).scalar_one_or_none()
    return active is not False


def tenant_of(column: Any):
    """欄位的實際租戶（空的視為 default），給 SQL 比對用"""
    return func.coalesce(column, DEFAULT_TENANT_ID)


def sees_all_tenants(viewer: Any) -> bool:
    return getattr(viewer, "is_engineer", False)


def user_scope(viewer: Any):
    """使用者清單的範圍條件；engineer 回 None（不限制）"""
    from app.models.user import User

    if sees_all_tenants(viewer):
        return None
    return tenant_of(User.tenant_id) == viewer.effective_tenant_id


def scope_users(query: Any, viewer: Any):
    """把使用者查詢限制在 viewer 看得到的範圍"""
    cond = user_scope(viewer)
    return query if cond is None else query.where(cond)


def same_tenant(viewer: Any, tenant_id: Optional[str]) -> bool:
    """viewer 能不能看這個租戶的資料（tenant_id 空的視為 default）"""
    return sees_all_tenants(viewer) or (tenant_id or DEFAULT_TENANT_ID) == viewer.effective_tenant_id


def audit_scope(viewer: Any):
    """稽核紀錄的範圍條件；engineer 回 None（不限制）"""
    from app.models.audit_log import AuditLog

    if sees_all_tenants(viewer):
        return None
    return tenant_of(AuditLog.tenant_id) == viewer.effective_tenant_id


def scope_audit(query: Any, viewer: Any):
    cond = audit_scope(viewer)
    return query if cond is None else query.where(cond)
