"""
文件 API
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, status, UploadFile, File, BackgroundTasks, Form, Request

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
from app.services.audit_service import (
    write_audit_log,
    AuditAction,
    AuditResource,
    get_client_ip,
    get_user_agent,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["文件"])


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    current_user: CurrentUser,
    db: DbSession,
    page: int = 1,
    page_size: int = 20,
    doc_status: Optional[str] = None,
):
    """取得文件列表"""
    # 建立查詢
    query = select(Document).where(
        Document.tenant_id == (current_user.tenant_id or "default")
    )
    
    if doc_status:
        query = query.where(Document.status == doc_status)
    
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
    request: Request,
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
        
    # 雙重驗證: MIME Type 與檔案簽章 (Magic Bytes)
    from app.core.file_validator import validate_file_signature
    file_bytes = await file.read(1024)
    await file.seek(0) # 重置讀取指標
    
    if not validate_file_signature(file_bytes, file.filename, file.content_type):
        logger.error(f"檔案上傳攔截: {file.filename} signature 驗證失敗")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支援的檔案類型，或檔案內容與副檔名不符"
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
            # SECURITY: folderName 來自前端，限制長度 + 拒絕控制字元
            # 不限制具體字元（讓使用者用中文 / emoji 命名），但要防 NULL byte 跟超長字串
            safe_folder = str(folderName).strip()[:128]
            if "\x00" in safe_folder:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="folderName 含非法字元",
                )
            document.doc_metadata = {"folderName": safe_folder, "isActive": True}
            # SQLAlchemy needs a commit to save the update
            await db.commit()
        
        # 背景處理文件
        background_tasks.add_task(
            process_document_task,
            document.id,
        )
        
        # 審計日誌
        await write_audit_log(
            db=db,
            action=AuditAction.DOCUMENT_UPLOAD,
            resource_type=AuditResource.DOCUMENT,
            resource_id=document.id,
            user_id=current_user.id,
            user_email=current_user.email,
            tenant_id=current_user.tenant_id or "default",
            description=f"上傳文件: {file.filename}",
            details={"filename": file.filename, "folder": folderName},
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
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
    request: Request = None,
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
    
    original_filename = document.original_filename
    
    doc_service = DocumentService(db)
    success = await doc_service.delete_document(document_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="刪除文件失敗"
        )
    
    # 審計日誌
    await write_audit_log(
        db=db,
        action=AuditAction.DOCUMENT_DELETE,
        resource_type=AuditResource.DOCUMENT,
        resource_id=document_id,
        user_id=current_user.id,
        user_email=current_user.email,
        tenant_id=current_user.tenant_id or "default",
        description=f"刪除文件: {original_filename}",
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else None,
    )

