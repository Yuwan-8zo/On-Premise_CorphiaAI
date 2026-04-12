"""
API 模組
"""

from app.api.auth import router as auth_router
from app.api.conversations import router as conversations_router
from app.api.health import router as health_router
from app.api.documents import router as documents_router
from app.api.messages import router as messages_router
from app.api.websocket import router as websocket_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router
from app.api.audit_logs import router as audit_logs_router

__all__ = [
    "auth_router",
    "conversations_router",
    "health_router",
    "documents_router",
    "messages_router",
    "websocket_router",
    "users_router",
    "admin_router",
    "audit_logs_router",
]


