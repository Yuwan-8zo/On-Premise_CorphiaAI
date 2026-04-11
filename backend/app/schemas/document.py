"""
文件 Schemas
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """文件回應 Schema"""
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: Optional[str] = None
    doc_metadata: Dict[str, Any] = {}
    created_at: datetime
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """文件列表回應"""
    data: List[DocumentResponse]
    total: int


class DocumentUploadResponse(BaseModel):
    """文件上傳回應"""
    id: str
    filename: str
    status: str
    message: str


class DocumentMetadataUpdate(BaseModel):
    """文件 metadata 更新"""
    doc_metadata: Dict[str, Any]
