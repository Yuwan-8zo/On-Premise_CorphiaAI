from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.services.model_manager import get_model_manager, refresh_models
from app.services.llm_service import get_llm_service

router = APIRouter(prefix="/models", tags=["Models"])

class SelectModelRequest(BaseModel):
    name: str

@router.get("")
async def get_all_models() -> Dict[str, Any]:
    manager = get_model_manager()
    return manager.to_dict()

@router.post("/refresh")
async def refresh_models_api() -> Dict[str, Any]:
    manager = get_model_manager()
    manager.scan_models()
    return manager.to_dict()

@router.post("/select")
async def select_model(request: SelectModelRequest) -> Dict[str, Any]:
    manager = get_model_manager()
    if manager.select_model(request.name):
        llm = get_llm_service()
        llm.reload_llama()
        return {"message": f"Successfully selected {request.name}", "current_model": request.name}
    raise HTTPException(status_code=404, detail="Model currently unavailable.")

@router.get("/status")
async def get_model_status() -> Dict[str, Any]:
    manager = get_model_manager()
    return {
        "loaded": manager.current_model is not None,
        "current_model": manager._current_model,
        "model_path": manager.current_model_path
    }
