"""
API 依賴注入模組
"""

from typing import Annotated, Optional
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import decode_token
from app.core.time_utils import to_aware_utc
from app.models.user import User, UserRole
from app.services.token_service import is_token_blacklisted


# HTTP Bearer 認證
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """
    取得當前登入使用者

    驗證流程:
    1. 解碼 Token 並驗證簽章
    2. 檢查 Token 類型 (必須為 access)
    3. 檢查 Token 是否在黑名單中（已被撤銷）
    4. 查詢使用者並確認帳號狀態
    5. 檢查 Token 是否在使用者 token_revoked_at 之前發放
    
    Args:
        credentials: Bearer Token
        db: 資料庫 Session
        
    Returns:
        User: 當前使用者
        
    Raises:
        HTTPException: Token 無效或使用者不存在
    """
    token = credentials.credentials
    
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的認證憑證",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 檢查 Token 類型
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無效的 Token 類型",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 缺少使用者資訊",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 檢查 Token 是否在黑名單中（登出撤銷 / 管理員強制踢出）
    jti = payload.get("jti")
    if jti:
        is_blacklisted = await is_token_blacklisted(db, jti)
        if is_blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token 已被撤銷",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # 查詢使用者
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="使用者不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="使用者帳號已停用"
        )
    
    # 檢查 Token 是否在使用者 token_revoked_at 之前發放
    # （管理員強制撤銷所有 Token 時設定的時間戳）
    #
    # FIX: 原本用 .replace(tzinfo=timezone.utc) 在「DB 已是 aware datetime」的環境
    # 會丟掉真實時區資訊（例如 PostgreSQL TIMESTAMP WITH TIME ZONE 拉回來是 +08:00
    # 直接 replace 成 UTC 等於把時間「平移」8 小時，比對結果錯）。
    # 改用 to_aware_utc() 統一處理：naive 視為 UTC 補 tzinfo，aware 直接 astimezone(UTC)。
    if user.token_revoked_at:
        token_iat = payload.get("iat")
        if token_iat:
            token_issued_at = datetime.fromtimestamp(token_iat, tz=timezone.utc)
            revoked_at_utc = to_aware_utc(user.token_revoked_at)
            if revoked_at_utc and token_issued_at < revoked_at_utc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token 已被撤銷，請重新登入",
                    headers={"WWW-Authenticate": "Bearer"},
                )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """取得當前活躍使用者"""
    return current_user


def require_role(*roles: UserRole):
    """
    角色權限檢查裝飾器
    
    Args:
        roles: 允許的角色列表
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role not in [role.value for role in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="權限不足"
            )
        return current_user
    
    return role_checker


# 預設依賴
RequireEngineer = Depends(require_role(UserRole.ENGINEER))
RequireAdmin = Depends(require_role(UserRole.ENGINEER, UserRole.ADMIN))
RequireUser = Depends(require_role(UserRole.ENGINEER, UserRole.ADMIN, UserRole.USER))


# 類型別名
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
