"""
B1: 使用者每日訊息配額服務

在每次發送訊息前檢查當天使用量是否已超過 daily_message_limit。
- limit = 0 → 無限制（方便 Engineer / Admin 測試用）
- 計數範圍為 UTC 日期（00:00 ~ 23:59:59）
"""

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.time_utils import utc_now_naive
from app.models.user import User
from app.models.message import Message, MessageRole

logger = logging.getLogger(__name__)


@dataclass
class QuotaCheckResult:
    """配額檢查結果"""
    allowed: bool
    daily_limit: int
    used_today: int
    remaining: int
    message: str = ""


async def check_user_quota(db: AsyncSession, user_id: str) -> QuotaCheckResult:
    """
    檢查使用者今日訊息配額

    Args:
        db: 資料庫 session
        user_id: 使用者 ID

    Returns:
        QuotaCheckResult: 配額檢查結果
    """
    # 取得使用者設定
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        return QuotaCheckResult(
            allowed=False,
            daily_limit=0,
            used_today=0,
            remaining=0,
            message="使用者不存在",
        )

    limit = user.daily_message_limit

    # limit = 0 表示無限制
    if limit == 0:
        return QuotaCheckResult(
            allowed=True,
            daily_limit=0,
            used_today=0,
            remaining=-1,  # -1 代表無限
            message="",
        )

    # 計算今日（UTC）已發送的使用者訊息數
    now = utc_now_naive()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    count_result = await db.execute(
        select(func.count(Message.id))
        .join(
            # 只計算該使用者自己 conversation 裡的 user 訊息
            # 透過 conversation 表取得 user_id 對照
            Message.conversation,
        )
        .where(
            Message.role == MessageRole.USER.value,
            Message.created_at >= today_start,
            Message.conversation.has(user_id=user_id),
        )
    )
    used_today = count_result.scalar() or 0
    remaining = max(0, limit - used_today)

    if used_today >= limit:
        logger.warning(
            f"使用者 {user_id} 已達到每日配額上限: {used_today}/{limit}"
        )
        return QuotaCheckResult(
            allowed=False,
            daily_limit=limit,
            used_today=used_today,
            remaining=0,
            message=f"您已達到今日訊息上限（{limit} 則），請明日再試。",
        )

    return QuotaCheckResult(
        allowed=True,
        daily_limit=limit,
        used_today=used_today,
        remaining=remaining,
        message="",
    )
