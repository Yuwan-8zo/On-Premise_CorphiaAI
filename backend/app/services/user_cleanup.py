"""
刪除使用者時，資料庫以外的東西也要清：

資料庫的資料（對話、訊息、文件紀錄）會跟著帳號一起刪掉（cascade），但磁碟上的檔案不會：
  - 這個人的對話附過的圖片（uploads/chat-images/<對話>/）
  - 這個人上傳的文件原始檔（只限系統自己上傳區裡的；連接資料夾的原始檔是公司的檔案，不能碰）
  - AI 幫這個人產出的檔案（generated/<使用者>/）
還在回答中的對話也要先停下來。

用法：刪帳號「之前」先 collect（那時資料還查得到），資料庫刪除成功「之後」再 remove。
"""
import logging
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.conversation import Conversation
from app.models.document import Document
from app.services import generation_registry
import app.services.chat_images as chat_images
from app.services.document_service import is_inside, remove_upload_file

logger = logging.getLogger(__name__)


@dataclass
class UserFiles:
    user_id: str
    conversation_ids: list[str] = field(default_factory=list)
    document_paths: list[str] = field(default_factory=list)


async def collect(db: AsyncSession, user_id: str) -> UserFiles:
    """記下這個人有哪些對話、哪些文件檔，並把還在回答中的對話停下來"""
    conversation_ids = list((await db.execute(select(Conversation.id).where(Conversation.user_id == user_id))).scalars())
    document_paths = [
        path for path in (await db.execute(select(Document.file_path).where(Document.uploaded_by == user_id))).scalars() if path
    ]
    for conversation_id in conversation_ids:
        await generation_registry.cancel(conversation_id)
    return UserFiles(user_id=str(user_id), conversation_ids=conversation_ids, document_paths=document_paths)


def remove(files: UserFiles) -> dict[str, int]:
    """清掉磁碟上的檔案；回傳各清了多少（寫進稽核紀錄用）。任何一項失敗都不影響其他項"""
    for conversation_id in files.conversation_ids:
        chat_images.delete_conversation_images(conversation_id)

    upload_dir = Path(settings.upload_directory)
    documents = sum(1 for path in files.document_paths if remove_upload_file(path, upload_dir))

    generated_root = Path(settings.generated_files_dir)
    generated = generated_root / files.user_id
    removed_generated = 0
    # 資料夾名稱就是使用者編號；確認真的在產出檔的資料夾裡面才刪
    if files.user_id and generated.is_dir() and is_inside(generated, generated_root) and generated.resolve() != generated_root.resolve():
        removed_generated = sum(1 for p in generated.rglob("*") if p.is_file())
        shutil.rmtree(generated, ignore_errors=True)

    counts = {"conversations": len(files.conversation_ids), "document_files": documents, "generated_files": removed_generated}
    logger.info(f"已清掉使用者 {files.user_id} 的檔案: {counts}")
    return counts
