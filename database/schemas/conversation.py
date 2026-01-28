"""
å°è©± Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    """å»ºç?å°è©± Schema"""
    title: str = Field(default="?°å?è©?, max_length=255)
    model: str = Field(default="default", max_length=50)
    folder_id: Optional[str] = None
    settings: dict = Field(default_factory=dict)


class ConversationUpdate(BaseModel):
    """?´æ–°å°è©± Schema"""
    title: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=50)
    folder_id: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    settings: Optional[dict] = None


class ConversationResponse(BaseModel):
    """å°è©±?æ? Schema"""
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
    """å°è©±?—è¡¨?æ?"""
    data: List[ConversationResponse]
    total: int


class MessageSource(BaseModel):
    """è¨Šæ¯ä¾†æ?å¼•ç”¨"""
    document_id: str
    document_name: str
    chunk_id: str
    content: str
    score: float


class MessageCreate(BaseModel):
    """å»ºç?è¨Šæ¯ Schema"""
    content: str = Field(..., min_length=1)
    use_rag: bool = True


class MessageResponse(BaseModel):
    """è¨Šæ¯?æ? Schema"""
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
    """å°è©±è«‹æ? (WebSocket)"""
    message: str = Field(..., min_length=1)
    use_rag: bool = True
    temperature: Optional[float] = Field(None, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, ge=1, le=8192)


class ChatStreamResponse(BaseModel):
    """ä¸²æ??æ?"""
    type: str  # stream / done / error
    content: Optional[str] = None
    message_id: Optional[str] = None
    sources: Optional[List[MessageSource]] = None
    usage: Optional[dict] = None
    error: Optional[str] = None
