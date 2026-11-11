"""
API 共用的「依 ID 取資料，找不到（或沒有權限）就回 404」

權限規則跟著資料走：
  - 對話、訊息：只能拿自己的
  - 文件：同租戶
  - 使用者：同租戶
不存在和沒權限都回 404，不透露資料是否存在
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.document import Document
from app.models.message import Message
from app.models.user import User


def _not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


async def get_own_conversation(db: AsyncSession, conversation_id: str, user: User) -> Conversation:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise _not_found("對話不存在")
    return conversation


async def get_own_message(db: AsyncSession, message_id: str, user: User) -> Message:
    result = await db.execute(
        select(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Message.id == message_id, Conversation.user_id == user.id)
    )
    message = result.scalar_one_or_none()
    if message is None:
        raise _not_found("訊息不存在")
    return message


async def get_tenant_document(db: AsyncSession, document_id: str, user: User) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == user.effective_tenant_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise _not_found("文件不存在")
    return document


async def get_tenant_user(db: AsyncSession, user_id: str, current_user: User) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise _not_found("使用者不存在")
    return user
