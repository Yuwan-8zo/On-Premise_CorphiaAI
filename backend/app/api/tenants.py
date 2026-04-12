"""
租戶 (Tenant) API 路由
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import RequireAdmin, get_db, Depends
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, TenantListResponse
from app.services.audit_service import write_audit_log, AuditAction, AuditResource, get_client_ip, get_user_agent
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
    """取得所有租戶列表 (僅限管理員)"""
    
    query = select(Tenant)
    count_query = select(func.count(Tenant.id))
    
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Tenant.name.ilike(search_filter)) | (Tenant.slug.ilike(search_filter))
        )
        count_query = count_query.where(
            (Tenant.name.ilike(search_filter)) | (Tenant.slug.ilike(search_filter))
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
        total_pages=(total + page_size - 1) // page_size
    )

@router.post("", response_model=TenantResponse)
async def create_tenant(
    data: TenantCreate,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _ = RequireAdmin
):
    """建立租戶 (僅限管理員)"""
    
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
        action="tenant_create",
        resource_type=AuditResource.SYSTEM,
        resource_id=new_tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
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
    """更新租戶 (僅限管理員)"""
    
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="找不到此租戶")
        
    update_data = data.model_dump(exclude_unset=True)
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
        action="tenant_update",
        resource_type=AuditResource.SYSTEM,
        resource_id=tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
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
    _ = RequireAdmin
):
    """刪除或停用租戶 (僅限管理員)"""
    
    if tenant_id == "default":
         raise HTTPException(status_code=400, detail="無法刪除預設租戶")
    
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="找不到此租戶")
        
    tenant.is_active = False # Soft delete
    await db.commit()
    
    await write_audit_log(
        db=db,
        action="tenant_delete",
        resource_type=AuditResource.SYSTEM,
        resource_id=tenant.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
        description=f"停用租戶: {tenant.name}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request)
    )
    
    return {"message": "租戶已成功停用"}
