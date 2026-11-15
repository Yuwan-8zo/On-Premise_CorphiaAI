"""
連接資料夾：管理員把伺服器上的資料夾（或公司 NAS 的共用資料夾）接給 AI 讀

不複製檔案，只記路徑；之後由掃描程式建立索引（見 services/folder_source.py）。
誰能用：同租戶裡，角色在 allowed_roles 裡的人。
AI 能不能寫：write_mode
  read_only  只能讀
  output     可以在資料夾裡的「AI 產出」子資料夾建立新檔（不用問）
  approve    也可以修改原本的檔案，但每次都要使用者按同意，並先備份舊版
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class FolderWriteMode:
    READ_ONLY = "read_only"
    OUTPUT = "output"
    APPROVE = "approve"
    ALL = (READ_ONLY, OUTPUT, APPROVE)


class FolderStatus:
    """pending＝還沒建立索引；scanning＝建立中；ready＝可以用；error＝路徑不見或讀不到"""
    PENDING = "pending"
    SCANNING = "scanning"
    READY = "ready"
    ERROR = "error"


class ConnectedFolder(TimestampMixin, Base):
    __tablename__ = "connected_folders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 伺服器上的完整路徑（已解析過捷徑，一律存正規化後的樣子）
    path: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    allowed_roles: Mapped[list] = mapped_column(JSON, default=lambda: ["user", "admin"])
    write_mode: Mapped[str] = mapped_column(String(20), default=FolderWriteMode.OUTPUT)
    include_subfolders: Mapped[bool] = mapped_column(Boolean, default=True)
    # 多久檢查一次有沒有檔案新增、修改、刪除（分鐘）
    scan_interval_min: Mapped[int] = mapped_column(Integer, default=10)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # 狀態（掃描程式更新）
    status: Mapped[str] = mapped_column(String(20), default=FolderStatus.PENDING)
    file_count: Mapped[int] = mapped_column(Integer, default=0)
    total_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    last_scan_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<ConnectedFolder(id={self.id}, name={self.name}, path={self.path})>"
