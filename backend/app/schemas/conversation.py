"""
對話 Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.jsonb import SafeJsonDict


class ConversationCreate(BaseModel):
    """建立對話 Schema"""
    title: str = Field(default="新對話", max_length=255)
    model: str = Field(default="default", max_length=50)
    folder_id: Optional[str] = None
    settings: SafeJsonDict = Field(default_factory=dict)


class ConversationUpdate(BaseModel):
    """更新對話 Schema"""
    title: Optional[str] = Field(None, max_length=255)
    model: Optional[str] = Field(None, max_length=50)
    folder_id: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    settings: SafeJsonDict = None


class ConversationResponse(BaseModel):
    """對話回應 Schema"""
    id: str
    tenant_id: str
    user_id: str
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
    
    model_config = ConfigDict(from_attributes=True)


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
    web_search: bool = False


class MessageUpdate(BaseModel):
    """更新訊息 Schema"""
    content: str = Field(..., min_length=1)


class MessageAttachment(BaseModel):
    """AI 產出的檔案（下載：GET /files/{id}/download）"""
    id: str
    filename: str
    kind: str
    size: int


class MessageResponse(BaseModel):
    """訊息回應 Schema"""
    id: str
    role: str
    content: str
    tokens: int
    sources: Optional[List[MessageSource]] = None
    # AI 產出的檔案；只有本人讀自己的對話時才帶（分享頁不帶，別人下載不了）
    attachments: Optional[List[MessageAttachment]] = None
    rating: Optional[int] = None
    content_hash: Optional[str] = None
    prev_hash: Optional[str] = None
    # 模型的思考過程（只有會推理的模型才有）；分享頁不帶
    reasoning: Optional[str] = None
    # 這一則回答連外網查了什麼：{"query", "sources": [{"title", "url"}]}；沒連是 None
    web_search: Optional[dict] = None
    # AI 這一題自己做了哪些步驟（用了哪些工具）
    steps: Optional[list] = None
    # 對話分支：這個位置的所有版本（照寫入順序，包含自己）；只有一版時是只含自己的清單或空的
    parent_id: Optional[str] = None
    version_ids: list[str] = []
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SharedConversationResponse(BaseModel):
    """分享頁：對話＋全部訊息（唯讀）"""
    conversation: ConversationResponse
    messages: List[MessageResponse]
    owner_name: str
    is_owner: bool


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
