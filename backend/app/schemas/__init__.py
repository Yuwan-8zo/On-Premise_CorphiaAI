"""
Schemas 模組
"""

from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    PasswordChangeRequest,
)
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from app.schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    ConversationResponse,
    ConversationListResponse,
    MessageCreate,
    MessageResponse,
    MessageSource,
    ChatRequest,
    ChatStreamResponse,
)
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
)
from app.schemas.common import (
    ApiResponse,
    ErrorResponse,
    ErrorDetail,
    PaginationParams,
    Pagination,
    HealthResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "RefreshRequest",
    "RegisterRequest",
    "PasswordChangeRequest",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    # Conversation
    "ConversationCreate",
    "ConversationUpdate",
    "ConversationResponse",
    "ConversationListResponse",
    "MessageCreate",
    "MessageResponse",
    "MessageSource",
    "ChatRequest",
    "ChatStreamResponse",
    # Document
    "DocumentResponse",
    "DocumentListResponse",
    "DocumentUploadResponse",
    # Common
    "ApiResponse",
    "ErrorResponse",
    "ErrorDetail",
    "PaginationParams",
    "Pagination",
    "HealthResponse",
]
