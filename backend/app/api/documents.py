"""
?á‰ª∂ API
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, UploadFile, File, BackgroundTasks

from sqlalchemy import select, func

from app.api.deps import CurrentUser, DbSession
from database.models.document import Document
from database.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUploadResponse,
)
from app.services.document_service import DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["?á‰ª∂"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: CurrentUser,
    db: DbSession,
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
):
    """?ñÂ??á‰ª∂?óË°®"""
    # Âª∫Á??•Ë©¢
    query = select(Document).where(
        Document.tenant_id == (current_user.tenant_id or "default")
    )
    
    if status:
        query = query.where(Document.status == status)
    
    # Ë®àÁ?Á∏ΩÊï∏
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar()
    
    # ?ÜÈ?
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
):
    """
    ‰∏äÂÇ≥?á‰ª∂
    
    ?ØÊè¥?ºÂ?: PDF, Word, Excel, TXT, Markdown
    """
    # Ê™¢Êü•Ê™îÊ?
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Áº∫Â?Ê™îÊ??çÁ®±"
        )
    
    # ‰∏äÂÇ≥
    doc_service = DocumentService(db)
    
    try:
        document = await doc_service.upload_document(
            file=file.file,
            filename=file.filename,
            tenant_id=current_user.tenant_id or "default",
            user_id=current_user.id,
        )
        
        # ?åÊôØ?ïÁ??á‰ª∂
        background_tasks.add_task(
            process_document_task,
            document.id,
        )
        
        return DocumentUploadResponse(
            id=document.id,
            filename=document.original_filename,
            status=document.status,
            message="?á‰ª∂Â∑≤‰??≥Ô?Ê≠?ú®?ïÁ?‰∏?
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"?á‰ª∂‰∏äÂÇ≥Â§±Ê?: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="?á‰ª∂‰∏äÂÇ≥Â§±Ê?"
        )


async def process_document_task(document_id: str):
    """?åÊôØ‰ªªÂ?ÔºöË??ÜÊ?‰ª?""
    from database.connection import async_session_maker
    
    async with async_session_maker() as db:
        doc_service = DocumentService(db)
        await doc_service.process_document(document_id)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """?ñÂ??á‰ª∂Ë©≥Ê?"""
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
            detail="?á‰ª∂‰∏çÂ???
        )
    
    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """?™Èô§?á‰ª∂"""
    # Ê™¢Êü•Ê¨äÈ?
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
            detail="?á‰ª∂‰∏çÂ???
        )
    
    # ?™Ê?‰∏äÂÇ≥?ÖÊ?ÁÆ°Á??°ÂèØ‰ª•Âà™??
    if document.uploaded_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="?°Ê??™Èô§Ê≠§Ê?‰ª?
        )
    
    doc_service = DocumentService(db)
    success = await doc_service.delete_document(document_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="?™Èô§?á‰ª∂Â§±Ê?"
        )
