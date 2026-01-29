"""
èªè? API
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

router = APIRouter(prefix="/auth", tags=["èªè?"])


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    ä½¿ç”¨?…ç™»??
    
    - **email**: ?»å??µä»¶
    - **password**: å¯†ç¢¼
    """
    # ?¥è©¢ä½¿ç”¨??
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="å¸³è??–å?ç¢¼éŒ¯èª?
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="å¸³è?å·²å???
        )
    
    # ?´æ–°?€å¾Œç™»?¥æ???
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    
    # å»ºç? Token
    token_data = {"sub": user.id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=30 * 60  # 30 ?†é?
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    ä½¿ç”¨?…è¨»??
    
    - **email**: ?»å??µä»¶
    - **password**: å¯†ç¢¼
    - **name**: é¡¯ç¤º?ç¨±
    - **tenant_slug**: ç§Ÿæˆ¶è­˜åˆ¥ç¢?(?¯é¸)
    """
    # æª¢æŸ¥ Email ?¯å¦å·²å???
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="æ­?Email å·²è¢«è¨»å?"
        )
    
    # ?¥è©¢ç§Ÿæˆ¶
    tenant_id = None
    if request.tenant_slug:
        result = await db.execute(
            select(Tenant).where(Tenant.slug == request.tenant_slug)
        )
        tenant = result.scalar_one_or_none()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ç§Ÿæˆ¶ä¸å???
            )
        tenant_id = tenant.id
    else:
        # ä½¿ç”¨?è¨­ç§Ÿæˆ¶
        result = await db.execute(
            select(Tenant).where(Tenant.slug == "default")
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            tenant_id = tenant.id
    
    # å»ºç?ä½¿ç”¨??
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
    """?·æ–° Access Token"""
    payload = decode_token(request.refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="?¡æ???Refresh Token"
        )
    
    user_id = payload.get("sub")
    
    # ?¥è©¢ä½¿ç”¨??
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ä½¿ç”¨?…ä?å­˜åœ¨?–å·²?œç”¨"
        )
    
    # å»ºç???Token
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
    """?–å??¶å?ä½¿ç”¨?…è?è¨?""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: CurrentUser):
    """
    ä½¿ç”¨?…ç™»??
    
    NOTE: JWT ?¡ç??‹ï?å¯¦é??»å‡º?€?±å?ç«¯æ???Token
    """
    return {"message": "?»å‡º?å?"}
