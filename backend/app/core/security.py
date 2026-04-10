"""
安全性模組

JWT Token 與密碼處理
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any

from jose import jwt, JWTError
import bcrypt

from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    驗證密碼
    
    Args:
        plain_password: 明文密碼
        hashed_password: 雜湊密碼
        
    Returns:
        bool: 密碼是否正確
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    取得密碼雜湊值
    
    Args:
        password: 明文密碼
        
    Returns:
        str: 雜湊後的密碼
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    建立 Access Token
    
    Args:
        data: Token 資料
        expires_delta: 過期時間差
        
    Returns:
        str: JWT Token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_expire_minutes
        )
    
    to_encode.update({"exp": expire, "type": "access"})
    
    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm
    )


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    建立 Refresh Token
    
    Args:
        data: Token 資料
        expires_delta: 過期時間差
        
    Returns:
        str: JWT Refresh Token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.jwt_refresh_expire_days
        )
    
    to_encode.update({"exp": expire, "type": "refresh"})
    
    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.jwt_algorithm
    )


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """
    解碼 Token
    
    Args:
        token: JWT Token
        
    Returns:
        Optional[dict]: Token 資料，解碼失敗回傳 None
    """
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None
