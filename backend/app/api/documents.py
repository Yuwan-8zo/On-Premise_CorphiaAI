"""
文件 API
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, UploadFile, File, BackgroundTasks, Form

from sqlalchemy import select, func

from app.api.deps import CurrentUser, DbSession
from app.models.document import Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
    DocumentMetadataUpdate,
)
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["文件"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: CurrentUser,
    db: DbSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
):
    """取得文件列表"""
    # 建立查詢
    query = select(Document).where(
        Document.tenant_id == (current_user.tenant_id or "default")
    )
    
    if status:
        query = query.where(Document.status == status)
    
    # 計算總數
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar()
    
    # 分頁
    query = query.order_by(Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    return DocumentListResponse(
        data=[DocumentResponse.model_validate(d) for d in documents],
        total=total,
    )


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folderName: Optional[str] = Form(None),
):
    """
    上傳文件
    
    支援格式: PDF, Word, Excel, TXT, Markdown
    """
    # 檢查檔案
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少檔案名稱"
        )
    
    # 上傳
    doc_service = DocumentService(db)
    
    try:
        document = await doc_service.upload_document(
            file=file.file,
            filename=file.filename,
            tenant_id=current_user.tenant_id or "default",
            user_id=current_user.id,
        )
        
        if folderName:
            document.doc_metadata = {"folderName": folderName, "isActive": True}
            # SQLAlchemy needs a commit to save the update
            await db.commit()
        
        # 背景處理文件
        background_tasks.add_task(
            process_document_task,
            document.id,
        )
        
        return DocumentUploadResponse(
            id=document.id,
            filename=document.original_filename,
            status=document.status,
            message="文件已上傳，正在處理中"
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"文件上傳失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="文件上傳失敗"
        )


async def process_document_task(document_id: str):
    """背景任務：處理文件"""
    from app.core.database import async_session_maker
    
    async with async_session_maker() as db:
        doc_service = DocumentService(db)
        await doc_service.process_document(document_id)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """取得文件詳情"""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == (current_user.tenant_id or "default"),
        )
    )
    document = result.scalar_one_or_none()
    
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
    
    return DocumentResponse.model_validate(document)


@router.patch("/{document_id}/metadata", response_model=DocumentResponse)
async def update_document_metadata(
    document_id: str,
    request: DocumentMetadataUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """更新文件 metadata (如啟用/停用 RAG 參考)"""
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == (current_user.tenant_id or "default"),
        )
    )
    document = result.scalar_one_or_none()
    
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
        
    document.doc_metadata = request.doc_metadata
    await db.commit()
    await db.refresh(document)
    
    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """刪除文件"""
    # 檢查權限
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.tenant_id == (current_user.tenant_id or "default"),
        )
    )
    document = result.scalar_one_or_none()
    
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
    
    # 只有上傳者或管理員可以刪除
    if document.uploaded_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="無權刪除此文件"
        )
    
    doc_service = DocumentService(db)
    success = await doc_service.delete_document(document_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="刪除文件失敗"
        )
