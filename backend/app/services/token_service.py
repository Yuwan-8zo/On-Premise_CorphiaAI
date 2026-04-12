"""
Token 黑名單服務模組

提供 Token 撤銷、黑名單查詢、過期清理等功能。
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.token_blacklist import TokenBlacklist

logger = logging.getLogger(__name__)


async def add_token_to_blacklist(
    db: AsyncSession,
    jti: str,
    user_id: str,
    token_type: str = "access",
    expires_at: Optional[datetime] = None,
    reason: str = "logout",
    revoked_by: Optional[str] = None,
) -> TokenBlacklist:
    """
    將 Token 加入黑名單

    Args:
        db: 資料庫 Session
        jti: Token 的唯一識別碼 (JWT ID)
        user_id: 被撤銷 Token 的使用者 ID
        token_type: Token 類型 (access / refresh)
        expires_at: Token 過期時間
        reason: 撤銷原因
        revoked_by: 撤銷者 ID (管理員踢出時)

    Returns:
        TokenBlacklist: 新建立的黑名單記錄
    """
    # 如果未提供過期時間，使用 24 小時後
    if expires_at is None:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    blacklist_entry = TokenBlacklist(
        jti=jti,
        user_id=user_id,
        token_type=token_type,
        expires_at=expires_at,
        reason=reason,
        revoked_by=revoked_by,
    )

    db.add(blacklist_entry)

    try:
        await db.commit()
        logger.info(
            f"Token 已加入黑名單: jti={jti}, user={user_id}, "
            f"type={token_type}, reason={reason}"
        )
    except Exception as e:
        logger.error(f"Token 黑名單寫入失敗: {e}")
        await db.rollback()

    return blacklist_entry


async def is_token_blacklisted(
    db: AsyncSession,
    jti: str,
) -> bool:
    """
    檢查 Token 是否在黑名單中

    Args:
        db: 資料庫 Session
        jti: Token 的唯一識別碼

    Returns:
        bool: Token 是否已被撤銷
    """
    result = await db.execute(
        select(TokenBlacklist.id).where(TokenBlacklist.jti == jti)
    )
    return result.scalar_one_or_none() is not None


async def revoke_all_user_tokens(
    db: AsyncSession,
    user_id: str,
    reason: str = "admin_force_logout",
    revoked_by: Optional[str] = None,
) -> int:
    """
    撤銷指定使用者的所有有效 Token

    實作方式：在使用者表中記錄 token_revoked_at 時間戳，
    所有在此時間之前發放的 Token 都會被視為無效。

    由於我們無法查詢到所有已發放的 JWT（無狀態），
    這裡透過在黑名單中加入一筆特殊記錄來標記。

    Args:
        db: 資料庫 Session
        user_id: 使用者 ID
        reason: 撤銷原因
        revoked_by: 撤銷者 ID

    Returns:
        int: 操作結果 (1 = 成功)
    """
    from app.models.user import User

    # 更新使用者的 token_revoked_at 欄位
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user:
        user.token_revoked_at = datetime.now(timezone.utc)
        await db.commit()
        logger.info(
            f"已撤銷使用者所有 Token: user={user_id}, "
            f"reason={reason}, revoked_by={revoked_by}"
        )
        return 1

    return 0


async def cleanup_expired_blacklist(db: AsyncSession) -> int:
    """
    清理過期的黑名單記錄

    Token 過期後，黑名單記錄已無意義，可定期清理節省空間。

    Args:
        db: 資料庫 Session

    Returns:
        int: 清理的記錄數量
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(TokenBlacklist).where(TokenBlacklist.expires_at < now)
    )
    await db.commit()
    count = result.rowcount
    if count > 0:
        logger.info(f"已清理 {count} 筆過期的黑名單記錄")
    return count
