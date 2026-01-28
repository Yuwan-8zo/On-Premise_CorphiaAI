"""
對話 Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    """建立對話 Schema"""
    title: str = Field(default="新對話", max_length=255)
    model: str = Field(default="default", max_length=50)
    folder_id: Optional[str] = None
    settings: dict = Field(default_factory=dict)


class ConversationUpdate(BaseModel):
    """更新對話 Schema"""
    title: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=50)
    folder_id: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    settings: Optional[dict] = None


class ConversationResponse(BaseModel):
    """對話回應 Schema"""
    id: str
    title: str
    model: str
    message_count: int
    total_tokens: int
    is_pinned: bool
    is_archived: bool
    folder_id: Optional[str] = None
    settings: dict
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """對話列表回應"""
    data: List[ConversationResponse]
    total: int


class MessageSource(BaseModel):
    """訊息來源引用"""
    document_id: str
    document_name: str
    chunk_id: str
    content: str
    score: float


class MessageCreate(BaseModel):
    """建立訊息 Schema"""
    content: str = Field(..., min_length=1)
    use_rag: bool = True


class MessageResponse(BaseModel):
    """訊息回應 Schema"""
    id: str
    role: str
    content: str
    tokens: int
    sources: Optional[List[MessageSource]] = None
    rating: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    """對話請求 (WebSocket)"""
    message: str = Field(..., min_length=1)
    use_rag: bool = True
    temperature: Optional[float] = Field(None, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, ge=1, le=8192)


class ChatStreamResponse(BaseModel):
    """串流回應"""
    type: str  # stream / done / error
    content: Optional[str] = None
    message_id: Optional[str] = None
    sources: Optional[List[MessageSource]] = None
    usage: Optional[dict] = None
    error: Optional[str] = None
