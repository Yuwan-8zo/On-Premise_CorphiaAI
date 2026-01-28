"""
文件處理服務

負責文件上傳、文字提取與分塊
"""

import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import chardet
from fastapi import UploadFile, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk


class Chunk(BaseModel):
    """文件分塊資料結構"""
    content: str
    metadata: dict


class DocumentService:
    """文件服務"""
    
    def __init__(self):
        # 確保上傳目錄存在
        os.makedirs(settings.upload_directory, exist_ok=True)
    
    async def save_upload_file(self, file: UploadFile, tenant_id: str) -> str:
        """
        儲存上傳的檔案
        
        Args:
            file: 上傳檔案物件
            tenant_id: 租戶 ID (用於目錄隔離)
            
        Returns:
            str: 檔案儲存路徑
        """
        # 檢查檔案大小 (簡易檢查，實際應在中間件或 Nginx 處理)
        # file.file.seek(0, 2)
        # size = file.file.tell()
        # file.file.seek(0)
        
        # 建立租戶目錄
        tenant_dir = Path(settings.upload_directory) / tenant_id
        tenant_dir.mkdir(parents=True, exist_ok=True)
        
        # 產生安全檔名
        safe_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = tenant_dir / safe_filename
        
        try:
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            return str(file_path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"檔案儲存失敗: {str(e)}"
            )
    
    async def extract_text(self, file_path: str, file_type: str) -> str:
        """
        從檔案提取文字
        
        Args:
            file_path: 檔案路徑
            file_type: 檔案類型 (MIME type or extension)
            
        Returns:
            str: 提取的文字內容
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"檔案不存在: {file_path}")
            
        ext = path.suffix.lower()
        
        try:
            if ext == ".txt" or ext == ".md":
                return self._read_text_file(path)
            elif ext == ".pdf":
                # 需要安裝 pypdf
                from pypdf import PdfReader
                reader = PdfReader(str(path))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text
            elif ext == ".docx":
                # 需要安裝 python-docx
                from docx import Document as DocxDocument
                doc = DocxDocument(str(path))
                return "\n".join([para.text for para in doc.paragraphs])
            else:
                raise ValueError(f"不支援的檔案格式: {ext}")
        except Exception as e:
            raise RuntimeError(f"文字提取失敗: {str(e)}")
    
    def _read_text_file(self, path: Path) -> str:
        """讀取純文字檔案，自動偵測編碼"""
        # 讀取部分內容偵測編碼
        with path.open("rb") as f:
            raw = f.read(10000)
        
        result = chardet.detect(raw)
        encoding = result["encoding"] or "utf-8"
        
        try:
            with path.open("r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            # 失敗時嘗試常見編碼
            for enc in ["utf-8", "big5", "cp950", "gbk", "latin-1"]:
                if enc == encoding:
                    continue
                try:
                    with path.open("r", encoding=enc) as f:
                        return f.read()
                except UnicodeDecodeError:
                    continue
            raise
            
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[Chunk]:
        """
        將文字分塊
        
        Args:
            text: 原始文字
            chunk_size: 分塊大小 (字元數)
            overlap: 重疊大小
            
        Returns:
            List[Chunk]: 分塊列表
        """
        if not text:
            return []
            
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = start + chunk_size
            
            # 如果不是最後一塊，嘗試在句點或換行處斷開
            if end < text_len:
                # 在 end 附近尋找可斷開的符號
                search_end = min(end + 50, text_len)
                found_split = False
                
                for split_char in ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? "]:
                    # 從預定結束點往前找
                    pos = text.rfind(split_char, start, search_end)
                    if pos != -1 and pos > start + chunk_size // 2:
                        end = pos + len(split_char)
                        found_split = True
                        break
                
                if not found_split:
                    # 強制斷開
                    pass
            
            chunk_content = text[start:end].strip()
            if chunk_content:
                chunks.append(Chunk(
                    content=chunk_content,
                    metadata={
                        "start_char": start,
                        "end_char": start + len(chunk_content),
                        "length": len(chunk_content)
                    }
                ))
            
            start = end - overlap
            
        return chunks
    
    def delete_file(self, file_path: str) -> bool:
        """刪除實體檔案"""
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
            return False
        except Exception:
            return False


# 單例
document_service = DocumentService()
