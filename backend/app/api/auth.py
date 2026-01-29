"""
認證 API
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
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

router = APIRouter(prefix="/auth", tags=["認證"])


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    使用者登入
    
    - **email**: 電子郵件
    - **password**: 密碼
    """
    # 查詢使用者
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="帳號或密碼錯誤"
        )
    
    if not user.is_active:
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
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60  # 30 分鐘
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    使用者註冊
    
    - **email**: 電子郵件
    - **password**: 密碼
    - **name**: 顯示名稱
    - **tenant_slug**: 租戶識別碼 (可選)
    """
    # 檢查 Email 是否已存在
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="此 Email 已被註冊"
        )
    
    # 查詢租戶
    tenant_id = None
    if request.tenant_slug:
        result = await db.execute(
            select(Tenant).where(Tenant.slug == request.tenant_slug)
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
    
    # 建立使用者
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.name,
        tenant_id=tenant_id,
        role="user"
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """刷新 Access Token"""
    payload = decode_token(request.refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的 Refresh Token"
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
    
    # 建立新 Token
    token_data = {"sub": user.id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
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
async def logout(current_user: CurrentUser):
    """
    使用者登出
    
    NOTE: JWT 無狀態，實際登出需由前端清除 Token
    """
    return {"message": "登出成功"}
