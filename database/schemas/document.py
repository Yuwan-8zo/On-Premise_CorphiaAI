"""
?‡ä»¶ Schemas
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """?‡ä»¶?žæ? Schema"""
    id: str
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    error_message: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """?‡ä»¶?—è¡¨?žæ?"""
    data: List[DocumentResponse]
    total: int


class DocumentUploadResponse(BaseModel):
    """?‡ä»¶ä¸Šå‚³?žæ?"""
    id: str
    filename: str
    status: str
    message: str
