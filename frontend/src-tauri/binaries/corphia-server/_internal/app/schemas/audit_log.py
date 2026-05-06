"""
審計日誌 Schema
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """審計日誌回應"""
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    tenant_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    description: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """審計日誌列表回應"""
    data: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
