"""
API 共用的「依 ID 取資料，找不到（或沒有權限）就回 404」

權限規則跟著資料走：
  - 對話、訊息：只能拿自己的
  - 文件：同租戶
  - 使用者：同租戶（帳號沒有租戶＝default；engineer 看全部，規則在 core/tenancy）
不存在和沒權限都回 404，不透露資料是否存在
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenancy import scope_users
from app.models.conversation import Conversation
from app.models.document import Document
from app.models.folder import Folder
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


async def ensure_own_folder(db: AsyncSession, folder_id: str | None, user: User) -> None:
    """對話要放進的資料夾必須是自己的（沒指定資料夾就不檢查）"""
    if not folder_id:
        return
    result = await db.execute(select(Folder.id).where(Folder.id == folder_id, Folder.user_id == user.id))
    if result.scalar_one_or_none() is None:
        raise _not_found("資料夾不存在")


async def get_tenant_document(db: AsyncSession, document_id: str, user: User) -> Document:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == user.effective_tenant_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise _not_found("文件不存在")
    # 連接資料夾來的文件：角色要在那個資料夾允許的範圍裡（沒權限就當作不存在）
    from app.services.folder_access import can_read_folder_document
    from app.services.folder_indexer import is_folder_document

    if is_folder_document(document) and not await can_read_folder_document(db, user, document):
        raise _not_found("文件不存在")
    return document


def ensure_can_modify_document(user: User, document: Document) -> None:
    """修改設定、刪除文件：只有上傳者或管理員（admin／engineer）"""
    from app.services.folder_indexer import is_folder_document

    # 連接資料夾來的文件指向原本的檔案：從這裡刪除會把原檔刪掉，一律到後台「資料夾」管理
    if is_folder_document(document):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="這是連接資料夾裡的檔案，請到後台「資料夾」管理")
    if document.uploaded_by != user.id and not (user.is_admin or user.is_engineer):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無權修改此文件")


async def get_tenant_user(db: AsyncSession, user_id: str, current_user: User) -> User:
    result = await db.execute(scope_users(select(User).where(User.id == user_id), current_user))
    user = result.scalar_one_or_none()
    if user is None:
        raise _not_found("使用者不存在")
    return user


def ensure_can_manage(actor: User, target: User) -> None:
    """權限比對方低的不能管對方：租戶管理員不能修改、停用、刪除、踢出 engineer"""
    if target.is_engineer and not actor.is_engineer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="無法管理權限更高的帳號")
