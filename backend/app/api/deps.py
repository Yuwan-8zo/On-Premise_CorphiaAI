"""
API ‰æùË≥¥Ê≥®ÂÖ•Ê®°Á?
"""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.connection import get_db
from app.core.security import decode_token
from database.models.user import User, UserRole


# HTTP Bearer Ë™çË?
security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> User:
    """
    ?ñÂ??∂Â??ªÂÖ•‰ΩøÁî®??
    
    Args:
        credentials: Bearer Token
        db: Ë≥áÊ?Â∫?Session
        
    Returns:
        User: ?∂Â?‰ΩøÁî®??
        
    Raises:
        HTTPException: Token ?°Ê??ñ‰Ωø?®ËÄÖ‰?Â≠òÂú®
    """
    token = credentials.credentials
    
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="?°Ê??ÑË?Ë≠âÊ?Ë≠?,
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Ê™¢Êü• Token È°ûÂ?
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="?°Ê???Token È°ûÂ?",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Áº∫Â?‰ΩøÁî®?ÖË?Ë®?,
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # ?•Ë©¢‰ΩøÁî®??
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="‰ΩøÁî®?Ö‰?Â≠òÂú®",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="‰ΩøÁî®?ÖÂ∏≥?üÂ∑≤?úÁî®"
        )
    
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """?ñÂ??∂Â?Ê¥ªË?‰ΩøÁî®??""
    return current_user


def require_role(*roles: UserRole):
    """
    ËßíËâ≤Ê¨äÈ?Ê™¢Êü•Ë£ùÈ£æ??
    
    Args:
        roles: ?ÅË®±?ÑË??≤Â?Ë°?
    """
    async def role_checker(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role not in [role.value for role in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ê¨äÈ?‰∏çË∂≥"
            )
        return current_user
    
    return role_checker


# ?êË®≠‰æùË≥¥
RequireEngineer = Depends(require_role(UserRole.ENGINEER))
RequireAdmin = Depends(require_role(UserRole.ENGINEER, UserRole.ADMIN))
RequireUser = Depends(require_role(UserRole.ENGINEER, UserRole.ADMIN, UserRole.USER))


# È°ûÂ??•Â?
CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
