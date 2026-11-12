"""
租戶 (Tenant) API 路由
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.query_utils import like_contains, page_count
from app.api.deps import RequireAdmin, RequireEngineer, get_db, Depends
from app.core.tenancy import DEFAULT_TENANT_ID, sees_all_tenants
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, TenantListResponse
from app.services.audit_service import write_audit_log, AuditAction, AuditResource
from app.core.request_utils import get_client_ip, get_user_agent
from app.api.deps import CurrentUser

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("", response_model=TenantListResponse)
async def list_tenants(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    """租戶列表：engineer 看全部，租戶管理員只看到自己的租戶"""

    query = select(Tenant)
    count_query = select(func.count(Tenant.id))
    if not sees_all_tenants(current_user):
        query = query.where(Tenant.id == current_user.effective_tenant_id)
        count_query = count_query.where(Tenant.id == current_user.effective_tenant_id)
    
    if search:
        # 跳脫 LIKE 萬用字元，避免使用者輸入的 % / _ 被當通配
        if len(search) > 128:
            raise HTTPException(status_code=400, detail="search 字串過長")
        search_filter = like_contains(search)
        query = query.where(
            Tenant.name.ilike(search_filter, escape="\\")
            | Tenant.slug.ilike(search_filter, escape="\\")
        )
        count_query = count_query.where(
            Tenant.name.ilike(search_filter, escape="\\")
            | Tenant.slug.ilike(search_filter, escape="\\")
        )
        
    total = (await db.execute(count_query)).scalar() or 0
    
    offset = (page - 1) * page_size
    query = query.order_by(Tenant.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    tenants = result.scalars().all()
    
    return TenantListResponse(
        data=[TenantResponse.model_validate(t) for t in tenants],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=page_count(total, page_size)
    )

@router.post("", response_model=TenantResponse)
async def create_tenant(
    data: TenantCreate,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _ = RequireEngineer
):
    """建立租戶（只有 engineer：租戶是整個系統層級的設定）"""
    
    # Check if slug exists
    existing = await db.execute(select(Tenant).where(Tenant.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="租戶識別碼 (slug) 已存在")
        
    new_tenant = Tenant(**data.model_dump())
    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)
    
    await write_audit_log(
        db=db,
        action=AuditAction.TENANT_CREATE,
        resource_type=AuditResource.SYSTEM,
        resource_id=new_tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.effective_tenant_id,
        description=f"建立新租戶: {new_tenant.name}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return TenantResponse.model_validate(new_tenant)

@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    data: TenantUpdate,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin
):
    """
    更新租戶：engineer 可以改任何租戶；租戶管理員只能改自己租戶的名稱等資料，
    不能停用／啟用（停用自己的租戶會把所有人鎖在外面）
    """
    everything = sees_all_tenants(current_user)
    if not everything and tenant_id != current_user.effective_tenant_id:
        raise HTTPException(status_code=404, detail="找不到此租戶")

    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="找不到此租戶")

    update_data = data.model_dump(exclude_unset=True)
    if "is_active" in update_data and update_data["is_active"] != tenant.is_active:
        if not everything:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有系統管理員能停用或啟用租戶")
        if tenant.id == DEFAULT_TENANT_ID and update_data["is_active"] is False:
            raise HTTPException(status_code=400, detail="無法停用預設租戶")
    if "slug" in update_data and update_data["slug"] != tenant.slug:
        existing = await db.execute(select(Tenant).where(Tenant.slug == update_data["slug"]))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="租戶識別碼 (slug) 已存在")
            
    for key, value in update_data.items():
        setattr(tenant, key, value)
        
    await db.commit()
    await db.refresh(tenant)
    
    await write_audit_log(
        db=db,
        action=AuditAction.TENANT_UPDATE,
        resource_type=AuditResource.SYSTEM,
        resource_id=tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.effective_tenant_id,
        description=f"更新租戶: {tenant.name}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return TenantResponse.model_validate(tenant)

@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _ = RequireEngineer
):
    """停用租戶（只有 engineer；不刪資料）"""

    if tenant_id == DEFAULT_TENANT_ID:
         raise HTTPException(status_code=400, detail="無法刪除預設租戶")
    
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="找不到此租戶")
        
    tenant.is_active = False # Soft delete
    await db.commit()
    
    await write_audit_log(
        db=db,
        action=AuditAction.TENANT_DELETE,
        resource_type=AuditResource.SYSTEM,
        resource_id=tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.effective_tenant_id,
        description=f"停用租戶: {tenant.name}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return {"message": "租戶已成功停用"}
