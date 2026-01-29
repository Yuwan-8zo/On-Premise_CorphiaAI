"""
Ê®°Â?ÁÆ°Á? API

?ê‰?Ê®°Â??óË°®?ÅÂ??õ„ÄÅÁ??ãÊü•Ë©¢Á??üËÉΩ
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional

from app.api.deps import CurrentUser
from app.services.model_manager import get_model_manager, refresh_models

router = APIRouter(prefix="/models", tags=["models"])


# Schemas
class ModelItem(BaseModel):
    """Ê®°Â??ÖÁõÆ"""
    name: str
    filename: str
    size_gb: float
    quantization: Optional[str]
    last_modified: str
    is_current: bool = False


class ModelListResponse(BaseModel):
    """Ê®°Â??óË°®?ûÊ?"""
    models_dir: str
    current_model: Optional[str]
    models: List[ModelItem]


class SelectModelRequest(BaseModel):
    """?∏Ê?Ê®°Â?Ë´ãÊ?"""
    name: str


class ModelStatusResponse(BaseModel):
    """Ê®°Â??Ä?ãÂ???""
    loaded: bool
    current_model: Optional[str]
    model_path: Optional[str]


@router.get("", response_model=ModelListResponse)
async def list_models(current_user: CurrentUser):
    """
    ?óÂá∫?Ä?âÂèØ?®Ê®°??
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
    ?çÊñ∞?ÉÊ?Ê®°Â??ÆÈ?
    """
    # ??admin ??engineer ?ØÂü∑Ë°?
    if current_user.role not in ["admin", "engineer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ê¨äÈ?‰∏çË∂≥"
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
    ?∏Ê?Ë¶Å‰Ωø?®Á?Ê®°Â?
    """
    # ??admin ??engineer ?ØÂ??õÊ®°??
    if current_user.role not in ["admin", "engineer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ê¨äÈ?‰∏çË∂≥"
        )
    
    manager = get_model_manager()
    
    if not manager.select_model(request.name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ê®°Â?‰∏çÂ??? {request.name}"
        )
    
    # TODO: ?ôË£°?Ø‰ª•Ëß∏Áôº LLM ?çÂ??çÊñ∞ËºâÂÖ•Ê®°Â?
    
    return {
        "message": f"Â∑≤ÈÅ∏?áÊ®°?? {request.name}",
        "current_model": request.name,
    }


@router.get("/status", response_model=ModelStatusResponse)
async def get_model_status(current_user: CurrentUser):
    """
    ?ñÂ??ÆÂ?Ê®°Â??Ä??
    """
    manager = get_model_manager()
    model = manager.current_model
    
    return ModelStatusResponse(
        loaded=model is not None,
        current_model=model.name if model else None,
        model_path=model.path if model else None,
    )
