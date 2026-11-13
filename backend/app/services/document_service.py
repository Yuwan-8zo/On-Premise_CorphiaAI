"""
文件服務模組

處理文件上傳、解析、分塊和向量化
"""

import logging
import os
import uuid
from pathlib import Path
from typing import BinaryIO, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
import app.services.text_extract as text_extract
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)


# 原始檔名在資料庫的欄位長度（documents.original_filename）
ORIGINAL_FILENAME_MAX = 255


def is_inside(path: Path, folder: Path) -> bool:
    """path 是不是在 folder 裡面（先解析成實際路徑，「..」或連結繞不出去）"""
    try:
        path.resolve().relative_to(folder.resolve())
        return True
    except (ValueError, OSError):
        return False


def remove_upload_file(file_path: Optional[str], upload_dir: Path) -> bool:
    """
    刪掉一份上傳的檔案；只有在系統自己的上傳區裡才刪，回傳有沒有刪。
    文件紀錄的 file_path 不一定在上傳區：連接資料夾的文件指向公司資料夾裡的原始檔，那些不是系統的檔案。
    """
    if not file_path:
        return False
    path = Path(file_path)
    if not is_inside(path, upload_dir) or not path.is_file():
        return False
    try:
        path.unlink()
        return True
    except OSError as e:
        logger.warning(f"刪除上傳檔失敗 {path.name}: {e}")
        return False


def clean_original_filename(filename: str) -> str:
    """
    使用者上傳的檔名整理成可以安全存、安全顯示的樣子：
      - 只留最後一段（「../../x.txt」或帶磁碟路徑的檔名 → x.txt）；磁碟上的檔名本來就另外用隨機編號，這裡是顯示用的名字
      - 去掉控制字元（含 NUL）
      - 太長就裁短、保留副檔名（以前超過 255 個字會讓資料庫報錯，回 500 而且留下孤兒檔案）
    """
    name = (filename or "").replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in name if ch.isprintable()).strip()
    if not name:
        name = "未命名"
    elif name.startswith(".") and name.count(".") == 1:
        # 只有副檔名（「.txt」）：補一個名字
        name = f"未命名{name}"
    suffix = Path(name).suffix
    if len(name) > ORIGINAL_FILENAME_MAX:
        suffix = suffix[:20]
        name = name[: ORIGINAL_FILENAME_MAX - len(suffix)].rstrip() + suffix
    return name


class DocumentService:
    """文件處理服務"""
    
    # 支援的檔案類型（唯一來源在 text_extract.py，連接資料夾、瀏覽器臨時資料夾也看這份）
    SUPPORTED_TYPES = text_extract.SUPPORTED_TYPES
    
    # 分塊設定
    CHUNK_SIZE = 500  # 字元數
    CHUNK_OVERLAP = 50  # 重疊字元數
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.upload_directory)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def upload_document(
        self,
        file: BinaryIO,
        filename: str,
        tenant_id: str,
        user_id: str,
    ) -> Document:
        """
        上傳並儲存文件

        支援版本化：同一租戶內重新上傳相同原始檔名的文件時，
        舊版會被標記 superseded_by → 新版 ID，新版 version 自動遞增。
        
        Args:
            file: 檔案物件
            filename: 原始檔名
            tenant_id: 租戶 ID
            user_id: 上傳者 ID
            
        Returns:
            Document: 文件記錄
        """
        # 檔名只留最後一段、去掉控制字元、裁到資料庫放得下的長度（見 clean_original_filename）
        filename = clean_original_filename(filename)

        # 檢查檔案類型
        ext = Path(filename).suffix.lower()
        if ext not in self.SUPPORTED_TYPES:
            raise ValueError(f"不支援的檔案類型: {ext}")

        # .ppt（舊版二進位 PowerPoint）python-pptx 不支援，
        # 在這邊就早期拒絕並給清楚的訊息，比讓 process_document 在背景失敗好。
        # .doc 同理 —— python-docx 可讀但不穩定，先擋掉建議轉新版。
        if ext == ".ppt":
            raise ValueError(
                "舊版 .ppt 格式不支援解析，請另存為 .pptx 後再上傳"
            )
        if ext == ".doc":
            raise ValueError(
                "舊版 .doc 格式解析不穩定，請另存為 .docx 後再上傳"
            )
        if ext == ".xls":
            raise ValueError(
                "舊版 .xls 格式不支援解析，請另存為 .xlsx 後再上傳"
            )
        
        # 生成唯一檔名
        # SECURITY: tenant_id 直接拼進路徑可能造成路徑遍歷（attacker tenant_id="../../etc"）
        # 用 uuid + 過濾保險：tenant_id 必須是合法 slug（英數 + dash/底線）
        import re
        safe_tenant_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(tenant_id or "default"))
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = self.upload_dir / safe_tenant_id / unique_filename
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # 儲存檔案
        content = file.read()
        file_size = len(content)

        # FIX: 加上實際檔案大小驗證，避免 middleware 漏接的 chunked 上傳
        # （middleware 只看 Content-Length header，chunked encoding 可能繞過）
        from app.core.config import settings
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if file_size > max_bytes:
            raise ValueError(
                f"檔案大小 {file_size} bytes 超過上限 {max_bytes} bytes "
                f"({settings.max_upload_size_mb} MB)"
            )
        if file_size == 0:
            raise ValueError("空檔案無法上傳")

        try:
            with open(file_path, "wb") as f:
                f.write(content)
            # FIX: 寫入後驗證磁碟上實際大小，磁碟滿 / 權限不足 / SSD 失敗時
            # write() 不會 raise 但寫入量可能 < len(content)
            actual_size = file_path.stat().st_size
            if actual_size != file_size:
                # 清理不完整的檔案，避免留下殭屍
                try:
                    file_path.unlink()
                except OSError:
                    pass
                raise IOError(
                    f"檔案寫入不完整：預期 {file_size} bytes，實際 {actual_size} bytes "
                    "（磁碟可能已滿或權限不足）"
                )
        except OSError as e:
            # 磁碟相關 IO 錯誤，往上 raise 讓上層返回 500
            raise IOError(f"檔案儲存失敗：{e}") from e
        
        # B3: 查詢同名舊版本（同一租戶、同原始檔名、尚未被取代的最新版）
        prev_result = await self.db.execute(
            select(Document)
            .where(
                Document.tenant_id == tenant_id,
                Document.original_filename == filename,
                Document.superseded_by.is_(None),  # 只找「當前版本」
            )
            .order_by(Document.version.desc())
            .limit(1)
        )
        prev_doc = prev_result.scalar_one_or_none()
        new_version = (prev_doc.version + 1) if prev_doc else 1
        
        # 建立資料庫記錄
        document = Document(
            tenant_id=tenant_id,
            uploaded_by=user_id,
            filename=unique_filename,
            original_filename=filename,
            file_type=ext[1:],  # 移除點號
            file_size=file_size,
            file_path=str(file_path),
            status=DocumentStatus.PENDING.value,
            version=new_version,
        )
        
        self.db.add(document)
        try:
            await self.db.commit()
        except Exception:
            # 資料列沒寫成：剛存的檔案不能留在磁碟上當孤兒
            await self.db.rollback()
            try:
                file_path.unlink()
            except OSError:
                pass
            raise
        await self.db.refresh(document)
        
        # B3: 標記舊版被取代
        if prev_doc:
            prev_doc.superseded_by = document.id
            await self.db.commit()
            logger.info(
                f"文件版本更新: {filename} v{prev_doc.version} → v{new_version}"
            )
        
        logger.info(f"已上傳文件: {filename} → {unique_filename} (v{new_version})")
        
        return document
    
    async def process_document(self, document_id: str) -> bool:
        """
        處理文件：解析、分塊、向量化
        
        Args:
            document_id: 文件 ID
            
        Returns:
            bool: 是否成功
        """
        # 取得文件記錄
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document is None:
            logger.error(f"文件不存在: {document_id}")
            return False
        
        # 更新狀態
        document.status = DocumentStatus.PROCESSING.value
        await self.db.commit()
        
        try:
            # 解析文件內容
            content = await self._parse_document(document)
            
            if not content:
                raise ValueError("無法解析文件內容")
            
            # 分塊
            chunks = self._chunk_text(content)
            
            rag_service = get_rag_service()
            
            # 儲存分塊到資料庫
            # FIX: chunk_metadata 補上 chunk_index / total_chunks，
            # 前端「檢視來源」可定位到「文件第幾段」、做精準引用。
            # （chunk_index column 本來就有，但只看 column 沒看 metadata 的下游也能拿到。）
            total_chunks = len(chunks)

            # PERF: 批次向量化，避免每個 chunk 都單獨 encode（thread 切換 + Python overhead 很高）
            # 若批次 API 不可用或失敗，fallback 回逐段 get_embedding（保持行為相容）。
            embeddings: list[list[float]] | None = None
            try:
                get_embeddings = getattr(rag_service, "get_embeddings", None)
                if callable(get_embeddings):
                    embeddings = await get_embeddings(chunks, batch_size=32)
            except Exception as e:
                logger.warning(f"批次 embedding 失敗，fallback 逐段 encode: {e}")
                embeddings = None

            for i, chunk_content in enumerate(chunks):
                embedding = embeddings[i] if embeddings is not None else await rag_service.get_embedding(chunk_content)

                chunk = DocumentChunk(
                    document_id=document.id,
                    chunk_index=i,
                    content=chunk_content,
                    embedding=embedding,
                    chunk_metadata={
                        "filename": document.original_filename,
                        "tenant_id": document.tenant_id,
                        "chunk_index": i,
                        "total_chunks": total_chunks,
                        # 約略字元數（給前端顯示「第 X 段（含 N 字）」用，不必精算）
                        "char_count": len(chunk_content),
                    },
                )
                self.db.add(chunk)

            # 更新文件狀態
            document.status = DocumentStatus.COMPLETED.value
            document.chunk_count = total_chunks
            # NOTE: 使用 naive UTC，與系統其他地方保持一致
            from app.core.time_utils import utc_now_naive
            document.processed_at = utc_now_naive()

            await self.db.commit()
            
            logger.info(f"文件處理完成: {document.original_filename}，共 {len(chunks)} 個分塊")
            return True
            
        except Exception as e:
            logger.error(f"文件處理失敗: {e}")
            document.status = DocumentStatus.FAILED.value
            document.error_message = str(e)
            await self.db.commit()
            return False
    
    async def _parse_document(self, document: Document) -> str:
        """解析文件內容（實際解析邏輯在 services/text_extract.py，伺服器資料夾、瀏覽器臨時資料夾也共用同一份）"""
        file_path = Path(document.file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"檔案不存在: {file_path}")

        return await text_extract.extract_text(file_path, document.file_type.lower())


    def _chunk_text(self, text: str) -> list[str]:
        """
        將文字分塊
        
        ISSUE-03 修正：使用字元數切割，支援中文文本（中文無空白分隔詞）。
        
        Args:
            text: 原始文字
            
        Returns:
            list[str]: 分塊列表
        """
        chunks = []
        
        # 先按段落分割
        paragraphs = text.split("\n\n")
        
        current_chunk = ""
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # 如果段落本身超過 chunk size，需要進一步分割
            if len(para) > self.CHUNK_SIZE:
                # 先保存當前累積的 chunk
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                
                # ISSUE-03 修正：使用字元切割，而非 split()（空白斷詞對中文無效）
                # 以 CHUNK_SIZE 個字元為單位切割，加入 CHUNK_OVERLAP 字元的重疊避免語意截斷
                start = 0
                while start < len(para):
                    end = min(start + self.CHUNK_SIZE, len(para))
                    chunk_part = para[start:end]
                    if chunk_part.strip():
                        chunks.append(chunk_part)
                    # 下一段起點往回退 CHUNK_OVERLAP 個字元，保留語意連貫性
                    start = end - self.CHUNK_OVERLAP if end < len(para) else end
            else:
                # 嘗試合併段落
                if len(current_chunk) + len(para) + 2 > self.CHUNK_SIZE:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = para
                else:
                    current_chunk = current_chunk + "\n\n" + para if current_chunk else para
        
        # 加入最後一個 chunk
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def delete_document(self, document_id: str) -> bool:
        """
        刪除文件
        
        Args:
            document_id: 文件 ID
            
        Returns:
            bool: 是否成功
        """
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document is None:
            return False
        
        try:
            # 刪除檔案：只刪系統自己上傳區裡的那一份。
            # 連接資料夾來的文件，file_path 指向公司資料夾裡的原始檔——那是使用者的檔案，絕對不能刪
            remove_upload_file(document.file_path, self.upload_dir)
            
            # 由於 DocumentChunk 設定了 CASCADE，刪除 Document 時會一併從資料庫刪除所有向量分塊
            
            # 刪除資料庫記錄
            await self.db.delete(document)
            await self.db.commit()
            
            logger.info(f"已刪除文件: {document.original_filename}")
            return True
            
        except Exception as e:
            logger.error(f"刪除文件失敗: {e}")
            return False
