"""
使用者 API
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query, Request
from sqlalchemy import select, func

from app.api.lookups import ensure_can_manage, get_tenant_user
from app.core.query_utils import like_contains, page_count
from app.core.tenancy import scope_users
from app.api.deps import CurrentUser, DbSession, AdminUser
from app.models.user import User, UserRole
from app.schemas.user import AdminUserUpdate, UserResponse, UserUpdate, UserListResponse, UserCreate
from app.core.time_utils import utc_now_naive
from app.core.security import get_password_hash
from app.services.audit_service import write_audit_log, AuditAction, AuditResource
from app.core.request_utils import get_client_ip, get_user_agent
from app.services import user_cleanup

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: AdminUser,
    db: DbSession,
    request: Request = None,
):
    """
    建立使用者（僅 admin/engineer 可用；engineer 帳號只有 engineer 能建立）
    """
    if data.role == UserRole.ENGINEER and not current_user.is_engineer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無法建立權限更高的帳號")

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="信箱已被註冊"
        )
    
    new_user = User(
        email=data.email,
        name=data.name,
        password_hash=get_password_hash(data.password),
        role=data.role.value,
        tenant_id=current_user.effective_tenant_id,
        is_active=data.is_active,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    await write_audit_log(
        db=db,
        action=AuditAction.USER_CREATE,
        resource_type=AuditResource.USER,
        resource_id=new_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"管理員建立使用者: {new_user.email}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )
    
    return UserResponse.model_validate(new_user)


@router.get("", response_model=UserListResponse)
async def list_users(
    current_user: AdminUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """
    列出使用者（僅 admin/engineer 可用）
    """
    # 建立查詢（範圍：自己租戶，帳號沒有租戶算 default；engineer 看全部）
    query = scope_users(select(User), current_user)
    count_query = scope_users(select(func.count(User.id)), current_user)
    
    # 篩選條件
    if search:
        # 跳脫 LIKE 萬用字元 + 限長度
        # NOTE: 不要在這裡再 import HTTPException —— top-level 已經 import，
        # 在 function 內部重 import 會讓 HTTPException 變成整個 function 的
        # local，導致前面 line 91 的 raise HTTPException 變成
        # UnboundLocalError（ruff F823 抓到的真實 bug）
        if len(search) > 128:
            raise HTTPException(status_code=400, detail="search 字串過長")
        search_filter = like_contains(search)
        query = query.where(
            User.name.ilike(search_filter, escape="\\")
            | User.email.ilike(search_filter, escape="\\")
        )
        count_query = count_query.where(
            User.name.ilike(search_filter, escape="\\")
            | User.email.ilike(search_filter, escape="\\")
        )
    
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)
        count_query = count_query.where(User.is_active == is_active)
    
    # 取得總數
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 分頁
    offset = (page - 1) * page_size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return UserListResponse(
        data=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=page_count(total, page_size)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user(current_user: CurrentUser):
    """
    取得當前使用者資訊
    """
    return UserResponse.model_validate(current_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    取得指定使用者資訊：自己的，或管理員查看同租戶的
    """
    if user_id != str(current_user.id) and not (current_user.is_admin or current_user.is_engineer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="權限不足")
    user = await get_tenant_user(db, user_id, current_user)
    
    return UserResponse.model_validate(user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    更新當前使用者資訊（僅限 name / avatar_url，不允許自改 is_active 鎖死自己）
    """
    update_data = data.model_dump(exclude_unset=True)

    # SECURITY FIX: 移除使用者不該改自己的欄位
    # is_active 是 admin 才能改的（停用帳號），使用者自己不該能設 is_active=False 把自己鎖出去
    # role 在 UserUpdate schema 已經沒這欄，但保險起見也擋（防未來 schema 增加）
    SELF_ALLOWED_FIELDS = {"name", "avatar_url"}
    update_data = {k: v for k, v in update_data.items() if k in SELF_ALLOWED_FIELDS}

    if not update_data:
        return UserResponse.model_validate(current_user)

    # 更新資料
    for key, value in update_data.items():
        setattr(current_user, key, value)

    await db.commit()
    await db.refresh(current_user)
    
    return UserResponse.model_validate(current_user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: AdminUserUpdate,
    current_user: AdminUser,
    db: DbSession,
    request: Request = None,
):
    """
    更新指定使用者資訊（僅 admin 可用）：名稱、頭像、啟用、角色、重設密碼
    - 不能改自己的角色、不能停用自己
    - 只有 engineer 能把人設成 engineer、能管 engineer
    - 重設密碼後，那個人所有裝置的登入失效
    """
    # 取得使用者
    user = await get_tenant_user(db, user_id, current_user)
    ensure_can_manage(current_user, user)

    update_data = data.model_dump(exclude_unset=True, exclude_none=True)
    is_self = user.id == current_user.id
    # 不能停用自己（會把自己鎖在外面）
    if is_self and update_data.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="無法停用自己的帳號")

    new_role = update_data.pop("role", None)
    if new_role is not None and new_role.value != user.role:
        if is_self:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="無法變更自己的角色")
        if new_role == UserRole.ENGINEER and not current_user.is_engineer:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無法設定權限更高的角色")
        user.role = new_role.value
        update_data["role"] = new_role.value

    new_password = update_data.pop("password", None)
    if new_password:
        user.password_hash = get_password_hash(new_password)
        user.token_revoked_at = utc_now_naive()
        update_data["password"] = "***"

    # 其他欄位（名稱、頭像、啟用）
    for key in ("name", "avatar_url", "is_active"):
        if key in update_data:
            setattr(user, key, update_data[key])
    
    await db.commit()
    await db.refresh(user)
    
    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.USER_UPDATE,
        resource_type=AuditResource.USER,
        resource_id=user_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"管理員更新使用者: {user.email}",
        details={"updated_fields": list(update_data.keys())},
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )
    
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: AdminUser,
    db: DbSession,
    request: Request = None,
):
    """
    刪除使用者（僅 admin 可用）
    """
    # 不能刪除自己
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法刪除自己的帳號"
        )
    
    # 取得使用者
    user = await get_tenant_user(db, user_id, current_user)
    ensure_can_manage(current_user, user)
    
    # 實際刪除使用者 (硬刪除)，這會觸發 cascade 刪除該使用者的所有關聯資料 (對話、文件等)
    # 磁碟上的東西（對話附的圖片、上傳的文件檔、AI 產出的檔案）不會跟著資料庫一起刪：先記下來，資料庫刪成功後再清
    files = await user_cleanup.collect(db, user_id)
    await db.delete(user)
    await db.commit()
    user_cleanup.remove(files)
    
    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.USER_DELETE,
        resource_type=AuditResource.USER,
        resource_id=user_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"管理員刪除使用者: {user.email}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )
    
    return {"message": "使用者已永久刪除"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: str,
    current_user: AdminUser,
    db: DbSession,
    request: Request = None,
):
    """
    啟用使用者（僅 admin 可用）
    """
    user = await get_tenant_user(db, user_id, current_user)
    ensure_can_manage(current_user, user)
    
    user.is_active = True
    await db.commit()
    
    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.USER_ACTIVATE,
        resource_type=AuditResource.USER,
        resource_id=user_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"管理員啟用使用者: {user.email}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )
    
    return {"message": "使用者已啟用"}


@router.post("/{user_id}/force-logout")
async def force_logout_user(
    user_id: str,
    current_user: AdminUser,
    db: DbSession,
    request: Request = None,
):
    """
    強制踢出使用者（僅 admin 可用）

    撤銷該使用者所有已發放的 Token，使其立即被強制登出。
    """
    # 不能踢出自己
    if user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="無法強制踢出自己"
        )

    # 取得使用者
    user = await get_tenant_user(db, user_id, current_user)
    ensure_can_manage(current_user, user)

    # 撤銷所有 Token
    from app.services.token_service import revoke_all_user_tokens
    await revoke_all_user_tokens(
        db=db,
        user_id=user_id,
        reason="admin_force_logout",
        revoked_by=current_user.id,
    )

    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.USER_FORCE_LOGOUT,
        resource_type=AuditResource.USER,
        resource_id=user_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"管理員強制踢出使用者: {user.email}",
        details={"target_user_email": user.email},
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )

    return {"message": f"已強制踢出使用者 {user.email}"}

