"""
?‡ä»¶?å?æ¨¡ç?

?•ç??‡ä»¶ä¸Šå‚³?è§£?ã€å?å¡Šå??‘é???
"""

import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, BinaryIO

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)


class DocumentService:
    """?‡ä»¶?•ç??å?"""
    
    # ?¯æ´?„æ?æ¡ˆé???
    SUPPORTED_TYPES = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".txt": "text/plain",
        ".md": "text/markdown",
    }
    
    # ?†å?è¨­å?
    CHUNK_SIZE = 500  # å­—å???
    CHUNK_OVERLAP = 50  # ?ç?å­—å???
    
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
        ä¸Šå‚³ä¸¦å„²å­˜æ?ä»?
        
        Args:
            file: æª”æ??©ä»¶
            filename: ?Ÿå?æª”å?
            tenant_id: ç§Ÿæˆ¶ ID
            user_id: ä¸Šå‚³??ID
            
        Returns:
            Document: ?‡ä»¶è¨˜é?
        """
        # æª¢æŸ¥æª”æ?é¡å?
        ext = Path(filename).suffix.lower()
        if ext not in self.SUPPORTED_TYPES:
            raise ValueError(f"ä¸æ”¯?´ç?æª”æ?é¡å?: {ext}")
        
        # ?Ÿæ??¯ä?æª”å?
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = self.upload_dir / tenant_id / unique_filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # ?²å?æª”æ?
        content = file.read()
        file_size = len(content)
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        # å»ºç?è³‡æ?åº«è???
        document = Document(
            tenant_id=tenant_id,
            uploaded_by=user_id,
            filename=unique_filename,
            original_filename=filename,
            file_type=ext[1:],  # ç§»é™¤é»è?
            file_size=file_size,
            file_path=str(file_path),
            status=DocumentStatus.PENDING.value,
        )
        
        self.db.add(document)
        await self.db.commit()
        await self.db.refresh(document)
        
        logger.info(f"å·²ä??³æ?ä»? {filename} -> {unique_filename}")
        
        return document
    
    async def process_document(self, document_id: str) -> bool:
        """
        ?•ç??‡ä»¶ï¼šè§£?ã€å?å¡Šã€å??å?
        
        Args:
            document_id: ?‡ä»¶ ID
            
        Returns:
            bool: ?¯å¦?å?
        """
        # ?–å??‡ä»¶è¨˜é?
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document is None:
            logger.error(f"?‡ä»¶ä¸å??? {document_id}")
            return False
        
        # ?´æ–°?€??
        document.status = DocumentStatus.PROCESSING.value
        await self.db.commit()
        
        try:
            # è§???‡ä»¶?§å®¹
            content = await self._parse_document(document)
            
            if not content:
                raise ValueError("?¡æ?è§???‡ä»¶?§å®¹")
            
            # ?†å?
            chunks = self._chunk_text(content)
            
            # ?²å??†å??°è??™åº«
            for i, chunk_content in enumerate(chunks):
                chunk = DocumentChunk(
                    document_id=document.id,
                    chunk_index=i,
                    content=chunk_content,
                    chunk_metadata={
                        "filename": document.original_filename,
                        "tenant_id": document.tenant_id,
                    }
                )
                self.db.add(chunk)
            
            # ?°å??°å??å„²å­?
            rag_service = get_rag_service()
            await rag_service.add_document(
                doc_id=document.id,
                chunks=chunks,
                metadatas=[{
                    "filename": document.original_filename,
                    "tenant_id": document.tenant_id,
                    "chunk_index": i,
                } for i in range(len(chunks))]
            )
            
            # ?´æ–°?‡ä»¶?€??
            document.status = DocumentStatus.COMPLETED.value
            document.chunk_count = len(chunks)
            document.processed_at = datetime.utcnow()
            
            await self.db.commit()
            
            logger.info(f"?‡ä»¶?•ç?å®Œæ?: {document.original_filename}ï¼Œå…± {len(chunks)} ?‹å?å¡?)
            return True
            
        except Exception as e:
            logger.error(f"?‡ä»¶?•ç?å¤±æ?: {e}")
            document.status = DocumentStatus.FAILED.value
            document.error_message = str(e)
            await self.db.commit()
            return False
    
    async def _parse_document(self, document: Document) -> str:
        """è§???‡ä»¶?§å®¹"""
        file_path = Path(document.file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"æª”æ?ä¸å??? {file_path}")
        
        ext = document.file_type.lower()
        
        if ext in ["txt", "md"]:
            return await self._parse_text_file(file_path)
        elif ext == "pdf":
            return await self._parse_pdf(file_path)
        elif ext in ["docx", "doc"]:
            return await self._parse_word(file_path)
        elif ext in ["xlsx", "xls"]:
            return await self._parse_excel(file_path)
        else:
            raise ValueError(f"ä¸æ”¯?´ç?æª”æ?é¡å?: {ext}")
    
    async def _parse_text_file(self, file_path: Path) -> str:
        """è§??ç´”æ?å­—æ?æ¡?""
        import chardet
        
        with open(file_path, "rb") as f:
            raw_data = f.read()
        
        # ?µæ¸¬ç·¨ç¢¼
        detected = chardet.detect(raw_data)
        encoding = detected.get("encoding", "utf-8")
        
        return raw_data.decode(encoding, errors="ignore")
    
    async def _parse_pdf(self, file_path: Path) -> str:
        """è§?? PDF æª”æ?"""
        try:
            from PyPDF2 import PdfReader
            
            reader = PdfReader(str(file_path))
            text_parts = []
            
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            
            return "\n\n".join(text_parts)
            
        except ImportError:
            logger.warning("PyPDF2 ?ªå?è£ï??¡æ?è§?? PDF")
            raise
    
    async def _parse_word(self, file_path: Path) -> str:
        """è§?? Word æª”æ?"""
        try:
            from docx import Document as DocxDocument
            
            doc = DocxDocument(str(file_path))
            text_parts = []
            
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)
            
            return "\n\n".join(text_parts)
            
        except ImportError:
            logger.warning("python-docx ?ªå?è£ï??¡æ?è§?? Word")
            raise
    
    async def _parse_excel(self, file_path: Path) -> str:
        """è§?? Excel æª”æ?"""
        try:
            from openpyxl import load_workbook
            
            wb = load_workbook(str(file_path), data_only=True)
            text_parts = []
            
            for sheet in wb.worksheets:
                sheet_text = f"### {sheet.title}\n"
                for row in sheet.iter_rows(values_only=True):
                    row_text = " | ".join(str(cell) if cell else "" for cell in row)
                    if row_text.strip():
                        sheet_text += row_text + "\n"
                text_parts.append(sheet_text)
            
            return "\n\n".join(text_parts)
            
        except ImportError:
            logger.warning("openpyxl ?ªå?è£ï??¡æ?è§?? Excel")
            raise
    
    def _chunk_text(self, text: str) -> list[str]:
        """
        å°‡æ?å­—å?å¡?
        
        Args:
            text: ?Ÿå??‡å?
            
        Returns:
            list[str]: ?†å??—è¡¨
        """
        chunks = []
        
        # ?ˆæ?æ®µè½?†å‰²
        paragraphs = text.split("\n\n")
        
        current_chunk = ""
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # å¦‚æ?æ®µè½?¬èº«è¶…é? chunk sizeï¼Œé?è¦é€²ä?æ­¥å???
            if len(para) > self.CHUNK_SIZE:
                # ?ˆä?å­˜ç•¶?ç´¯ç©ç? chunk
                if current_chunk:
                    chunks.append(current_chunk)
                    current_chunk = ""
                
                # ?†å‰²?·æ®µ??
                words = para.split()
                temp_chunk = ""
                for word in words:
                    if len(temp_chunk) + len(word) + 1 > self.CHUNK_SIZE:
                        if temp_chunk:
                            chunks.append(temp_chunk)
                        temp_chunk = word
                    else:
                        temp_chunk = temp_chunk + " " + word if temp_chunk else word
                
                if temp_chunk:
                    current_chunk = temp_chunk
            else:
                # ?—è©¦?ˆä½µæ®µè½
                if len(current_chunk) + len(para) + 2 > self.CHUNK_SIZE:
                    if current_chunk:
                        chunks.append(current_chunk)
                    current_chunk = para
                else:
                    current_chunk = current_chunk + "\n\n" + para if current_chunk else para
        
        # ? å…¥?€å¾Œä???chunk
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    async def delete_document(self, document_id: str) -> bool:
        """
        ?ªé™¤?‡ä»¶
        
        Args:
            document_id: ?‡ä»¶ ID
            
        Returns:
            bool: ?¯å¦?å?
        """
        result = await self.db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        
        if document is None:
            return False
        
        try:
            # ?ªé™¤æª”æ?
            file_path = Path(document.file_path)
            if file_path.exists():
                os.remove(file_path)
            
            # ?ªé™¤?‘é??²å?
            rag_service = get_rag_service()
            await rag_service.delete_document(document_id)
            
            # ?ªé™¤è³‡æ?åº«è???
            await self.db.delete(document)
            await self.db.commit()
            
            logger.info(f"å·²åˆª?¤æ?ä»? {document.original_filename}")
            return True
            
        except Exception as e:
            logger.error(f"?ªé™¤?‡ä»¶å¤±æ?: {e}")
            return False
