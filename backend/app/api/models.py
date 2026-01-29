"""
模型管理 API

提供模型列表、切換、狀態查詢等功能
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional

from app.api.deps import CurrentUser
from app.services.model_manager import get_model_manager, refresh_models

router = APIRouter(prefix="/models", tags=["models"])


# Schemas
class ModelItem(BaseModel):
    """模型項目"""
    name: str
    filename: str
    size_gb: float
    quantization: Optional[str]
    last_modified: str
    is_current: bool = False


class ModelListResponse(BaseModel):
    """模型列表回應"""
    models_dir: str
    current_model: Optional[str]
    models: List[ModelItem]


class SelectModelRequest(BaseModel):
    """選擇模型請求"""
    name: str


class ModelStatusResponse(BaseModel):
    """模型狀態回應"""
    loaded: bool
    current_model: Optional[str]
    model_path: Optional[str]


@router.get("", response_model=ModelListResponse)
async def list_models(current_user: CurrentUser):
    """
    列出所有可用模型
    """
    manager = get_model_manager()
    current = manager._current_model
    
    models = [
        ModelItem(
            name=m.name,
            filename=m.filename,
            size_gb=round(m.size_gb, 2),
            quantization=m.quantization,
            last_modified=m.last_modified.isoformat(),
            is_current=(m.name == current),
        )
        for m in manager.available_models
    ]
    
    return ModelListResponse(
        models_dir=str(manager.models_dir),
        current_model=current,
        models=models,
    )


@router.post("/refresh", response_model=ModelListResponse)
async def refresh_model_list(current_user: CurrentUser):
    """
    重新掃描模型目錄
    """
    # 僅 admin 和 engineer 可執行
    if current_user.role not in ["admin", "engineer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    refresh_models()
    manager = get_model_manager()
    current = manager._current_model
    
    models = [
        ModelItem(
            name=m.name,
            filename=m.filename,
            size_gb=round(m.size_gb, 2),
            quantization=m.quantization,
            last_modified=m.last_modified.isoformat(),
            is_current=(m.name == current),
        )
        for m in manager.available_models
    ]
    
    return ModelListResponse(
        models_dir=str(manager.models_dir),
        current_model=current,
        models=models,
    )


@router.post("/select")
async def select_model(
    request: SelectModelRequest,
    current_user: CurrentUser,
):
    """
    選擇要使用的模型
    """
    # 僅 admin 和 engineer 可切換模型
    if current_user.role not in ["admin", "engineer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="權限不足"
        )
    
    manager = get_model_manager()
    
    if not manager.select_model(request.name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模型不存在: {request.name}"
        )
    
    # TODO: 這裡可以觸發 LLM 服務重新載入模型
    
    return {
        "message": f"已選擇模型: {request.name}",
        "current_model": request.name,
    }


@router.get("/status", response_model=ModelStatusResponse)
async def get_model_status(current_user: CurrentUser):
    """
    取得目前模型狀態
    """
    manager = get_model_manager()
    model = manager.current_model
    
    return ModelStatusResponse(
        loaded=model is not None,
        current_model=model.name if model else None,
        model_path=model.path if model else None,
    )
