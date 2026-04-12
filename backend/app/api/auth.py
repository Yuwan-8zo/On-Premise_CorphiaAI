"""
認證 API
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
)
from app.schemas.user import UserResponse
from app.api.deps import CurrentUser
from app.services.audit_service import (
    write_audit_log,
    AuditAction,
    AuditResource,
    get_client_ip,
    get_user_agent,
)
from app.services.token_service import add_token_to_blacklist

# Bearer 安全方案（用於取得原始 Token）
bearer_scheme = HTTPBearer()

router = APIRouter(prefix="/auth", tags=["認證"])


@router.post("/login", response_model=LoginResponse)
async def login(
    request_body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    使用者登入

    - **email**: 電子郵件
    - **password**: 密碼
    """
    client_ip = get_client_ip(request)
    ua = get_user_agent(request)

    # 查詢使用者
    result = await db.execute(
        select(User).where(User.email == request_body.email)
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(request_body.password, user.password_hash):
        # 登入失敗審計
        await write_audit_log(
            db=db,
            action=AuditAction.LOGIN_FAILED,
            resource_type=AuditResource.AUTH,
            user_email=request_body.email,
            description=f"登入失敗: {request_body.email}",
            details={"reason": "帳號或密碼錯誤"},
            ip_address=client_ip,
            user_agent=ua,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤"
        )

    if not user.is_active:
        # 帳號停用審計
        await write_audit_log(
            db=db,
            action=AuditAction.LOGIN_FAILED,
            resource_type=AuditResource.AUTH,
            user_id=user.id,
            user_email=user.email,
            tenant_id=user.tenant_id,
            description=f"登入失敗 (帳號已停用): {user.email}",
            details={"reason": "帳號已停用"},
            ip_address=client_ip,
            user_agent=ua,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="帳號已停用"
        )

    # 更新最後登入時間
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # 建立 Token
    token_data = {"sub": user.id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # 登入成功審計
    await write_audit_log(
        db=db,
        action=AuditAction.LOGIN_SUCCESS,
        resource_type=AuditResource.AUTH,
        user_id=user.id,
        user_email=user.email,
        tenant_id=user.tenant_id,
        description=f"使用者登入成功: {user.email}",
        ip_address=client_ip,
        user_agent=ua,
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60  # 30 分鐘
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request_body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    使用者註冊

    - **email**: 電子郵件
    - **password**: 密碼
    - **name**: 顯示名稱
    - **tenant_slug**: 租戶識別碼 (可選)
    """
    client_ip = get_client_ip(request)
    ua = get_user_agent(request)

    # 檢查 Email 是否已存在
    result = await db.execute(
        select(User).where(User.email == request_body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此 Email 已被註冊"
        )

    # 查詢租戶
    tenant_id = None
    if request_body.tenant_slug:
        result = await db.execute(
            select(Tenant).where(Tenant.slug == request_body.tenant_slug)
        )
        tenant = result.scalar_one_or_none()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="租戶不存在"
            )
        tenant_id = tenant.id
    else:
        # 使用預設租戶
        result = await db.execute(
            select(Tenant).where(Tenant.slug == "default")
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            tenant_id = tenant.id

    # 建立使用者（name 未提供時使用 email 前綴作為預設名稱）
    display_name = request_body.name or request_body.email.split("@")[0]
    user = User(
        email=request_body.email,
        password_hash=get_password_hash(request_body.password),
        name=display_name,
        tenant_id=tenant_id,
        role="user"
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 註冊審計
    await write_audit_log(
        db=db,
        action=AuditAction.REGISTER,
        resource_type=AuditResource.AUTH,
        resource_id=user.id,
        user_id=user.id,
        user_email=user.email,
        tenant_id=user.tenant_id,
        description=f"新使用者註冊: {user.email}",
        ip_address=client_ip,
        user_agent=ua,
    )

    return UserResponse.model_validate(user)


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request_body: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """刷新 Access Token（舊的 Refresh Token 同時被撤銷）"""
    payload = decode_token(request_body.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的 Refresh Token"
        )

    # 檢查 Refresh Token 是否已被撤銷
    old_jti = payload.get("jti")
    if old_jti:
        from app.services.token_service import is_token_blacklisted
        is_blacklisted = await is_token_blacklisted(db, old_jti)
        if is_blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh Token 已被撤銷"
            )

    user_id = payload.get("sub")

    # 查詢使用者
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="使用者不存在或已停用"
        )

    # 撤銷舊的 Refresh Token（防止重複使用）
    if old_jti:
        old_exp = payload.get("exp")
        expires_at = datetime.fromtimestamp(old_exp, tz=timezone.utc) if old_exp else None
        await add_token_to_blacklist(
            db=db,
            jti=old_jti,
            user_id=user_id,
            token_type="refresh",
            expires_at=expires_at,
            reason="token_refresh",
        )

    # 建立新 Token
    token_data = {"sub": user.id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Token 刷新審計
    await write_audit_log(
        db=db,
        action=AuditAction.TOKEN_REFRESH,
        resource_type=AuditResource.AUTH,
        user_id=user.id,
        user_email=user.email,
        tenant_id=user.tenant_id,
        description=f"Token 刷新: {user.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser):
    """取得當前使用者資訊"""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(
    current_user: CurrentUser,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    使用者登出

    將當前 Access Token 加入黑名單，使其立即失效。
    """
    # 解碼 Token 取得 JTI
    token = credentials.credentials
    payload = decode_token(token)

    if payload and payload.get("jti"):
        jti = payload["jti"]
        exp = payload.get("exp")
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None

        # 加入黑名單
        await add_token_to_blacklist(
            db=db,
            jti=jti,
            user_id=current_user.id,
            token_type="access",
            expires_at=expires_at,
            reason="logout",
        )

    # 登出審計
    await write_audit_log(
        db=db,
        action=AuditAction.LOGOUT,
        resource_type=AuditResource.AUTH,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id,
        description=f"使用者登出: {current_user.email}",
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    return {"message": "登出成功"}
