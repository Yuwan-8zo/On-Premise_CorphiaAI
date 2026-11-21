"""
使用者體驗量測（Web Vitals）：每個人實際用的時候，畫面多快出來、按下去多快有反應、版面有沒有亂跳

前端用 Google 開源的 web-vitals 量，送回這台主機（見 api/vitals.py），後台「總覽」看統計。
只記數字：哪一個指標、數值、好壞等級、哪一頁（路徑，不含對話編號）、哪種裝置；
不記是誰、不記任何對話內容。保留 RETENTION_DAYS 天，舊的自動刪掉。
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# 保留多久（天）
RETENTION_DAYS = 30


class WebVital(Base):
    __tablename__ = "web_vitals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # 所屬組織（管理員只看自己組織的；工程師看全部）
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    # LCP／INP／CLS／FCP／TTFB
    name: Mapped[str] = mapped_column(String(8), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    # good／needs-improvement／poor（web-vitals 依 Google 門檻判的）
    rating: Mapped[str] = mapped_column(String(20), nullable=False)
    # 哪一頁：/、/admin、/login…（前端已去掉對話編號等個別資料）
    page: Mapped[str] = mapped_column(String(40), nullable=False)
    # mobile／tablet／desktop（依畫面寬度）
    device: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False, index=True)
