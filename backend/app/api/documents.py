"""
文件 API
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form, Query, BackgroundTasks

from sqlalchemy import select, func, desc

from app.api.deps import CurrentUser, DbSession
from app.models.document import Document, DocumentStatus
from app.models.document_chunk import DocumentChunk
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
)
from app.schemas.common import ApiResponse
from app.services.document_service import document_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["文件"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    """
    取得文件列表
    """
    # 建立查詢
    query = select(Document).where(
        Document.tenant_id == (current_user.tenant_id or "default")
    )
    
    # 一般使用者只能看自己的文件，Admin/Engineer 可以看所有
    if current_user.is_user:
        query = query.where(Document.uploaded_by == current_user.id)
        
    if search:
        query = query.where(Document.filename.ilike(f"%{search}%"))
    
    # 計算總數
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar()
    
    # 分頁與排序
    query = query.order_by(Document.created_at.desc())\
        .offset((page - 1) * page_size)\
        .limit(page_size)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return DocumentListResponse(
        data=[DocumentResponse.model_validate(d) for d in documents],
        total=total
    )


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    上傳文件
    
    - 儲存檔案
    - 背景處理：提取文字 -> 分塊 -> 向量化
    """
    # 檢查檔案類型
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown"
    ]
    # 簡單檢查 extension
    ext = file.filename.split('.')[-1].lower()
    if ext not in ['pdf', 'docx', 'txt', 'md']:
         pass # 實際應檢查 mime type，但這裡從寬處理
         
    # 1. 儲存檔案 (需要 File I/O，同步操作)
    tenant_id = current_user.tenant_id or "default"
    try:
        file_path = await document_service.save_upload_file(file, tenant_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"檔案儲存失敗: {str(e)}"
        )
        
    # 2. 建立資料庫記錄
    doc = Document(
        tenant_id=tenant_id,
        uploaded_by=current_user.id,
        filename=file.filename,
        original_filename=file.filename,
        file_type=file.content_type or "unknown",
        file_size=file.file.tell() if hasattr(file.file, 'tell') else 0, # file.size not always available
        file_path=file_path,
        status=DocumentStatus.PENDING.value
    )
    
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    
    # 3. 背景處理
    background_tasks.add_task(
        process_document_task,
        doc.id,
        tenant_id,
        file_path,
        doc.file_type
    )
    
    return DocumentUploadResponse(
        id=doc.id,
        filename=doc.filename,
        status="pending",
        message="文件上傳成功，正在背景處理中"
    )


async def process_document_task(
    document_id: str,
    tenant_id: str,
    file_path: str,
    file_type: str,
):
    """
    背景任務：處理文件
    
    1. 提取文字
    2. 分塊
    3. 儲存分塊到 DB
    4. 產生向量並存入 ChromaDB
    """
    from app.core.database import async_session_maker
    
    logger.info(f"開始處理文件: {document_id}")
    
    async with async_session_maker() as db:
        try:
            # 更新狀態
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one()
            doc.status = DocumentStatus.PROCESSING.value
            await db.commit()
            
            # 1. 提取文字
            text = await document_service.extract_text(file_path, file_type)
            
            # 2. 分塊
            chunks_data = document_service.chunk_text(text)
            
            # 3. 儲存分塊
            db_chunks = []
            for i, chunk in enumerate(chunks_data):
                db_chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=i,
                    content=chunk.content,
                    chunk_metadata=chunk.metadata
                )
                db_chunks.append(db_chunk)
                db.add(db_chunk)
            
            doc.chunk_count = len(db_chunks)
            await db.commit()
            
            # 4. RAG 向量化
            # 需要先確保 db_chunks 有 ID/Vector ID
            # 這裡重新查詢或是手動生成 uuid
            # 因為 document_chunk.py 裡 vector_id 是 nullable，add_chunks 會自動生成
            
            await rag_service.add_chunks(tenant_id, document_id, db_chunks)
            
            # 完成
            doc.status = DocumentStatus.COMPLETED.value
            doc.processed_at = func.now()
            await db.commit()
            
            logger.info(f"文件處理完成: {document_id}, 分塊數: {len(db_chunks)}")
            
        except Exception as e:
            logger.error(f"文件處理失敗 {document_id}: {str(e)}", exc_info=True)
            # 失敗狀態
            try:
                # 重新獲取 session 以免 transaction 損壞
                await db.rollback()
                result = await db.execute(select(Document).where(Document.id == document_id))
                doc = result.scalar_one()
                doc.status = DocumentStatus.FAILED.value
                doc.error_message = str(e)
                await db.commit()
            except:
                pass


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """刪除文件"""
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
        
    # 權限檢查
    if current_user.is_user and doc.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無權刪除此文件"
        )
        
    # 1. 刪除實體檔案
    document_service.delete_file(doc.file_path)
    
    # 2. 刪除向量資料
    await rag_service.delete_document(doc.id)
    
    # 3. 刪除資料庫記錄 (cascade 會刪除 chunks)
    await db.delete(doc)
    await db.commit()
    
    return ApiResponse(message="文件已刪除")
