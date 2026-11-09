from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from app.api.deps import CurrentUser, RequireAdmin
from app.services.model_manager import get_model_manager
from app.services.llm_service import get_llm_service

# 查看與切換模型需要登入（所有角色都可切換）；重新掃描模型目錄只開放管理員與工程師
router = APIRouter(prefix="/models", tags=["Models"])

class SelectModelRequest(BaseModel):
    name: str

@router.get("")
async def get_all_models(current_user: CurrentUser) -> Dict[str, Any]:
    manager = get_model_manager()
    return manager.to_dict()

@router.post("/refresh", dependencies=[RequireAdmin])
async def refresh_models_api() -> Dict[str, Any]:
    manager = get_model_manager()
    manager.scan_models()
    # 重要：models list 變動後，必須同步重載 LLM，否則會卡在啟動時的模擬模式
    llm = get_llm_service()
    llm.reload_llama()
    await llm.initialize()
    return manager.to_dict()

@router.post("/select")
async def select_model(request: SelectModelRequest, current_user: CurrentUser) -> Dict[str, Any]:
    manager = get_model_manager()
    if manager.select_model(request.name):
        llm = get_llm_service()
        llm.reload_llama()
        await llm.initialize()
        return {"message": f"Successfully selected {request.name}", "current_model": request.name}
    raise HTTPException(status_code=404, detail="Model currently unavailable.")

@router.get("/status")
async def get_model_status(current_user: CurrentUser) -> Dict[str, Any]:
    manager = get_model_manager()
    llm = get_llm_service()
    return {
        # model manager 是否有選到模型（檔案層級）
        "loaded": manager.current_model is not None,
        "current_model": manager._current_model,
        "model_path": manager.current_model_path,
        # 真實推論層級：llama-cpp 是否成功掛載（避免 UI 誤以為已載入但其實仍是模擬）
        "llama_cpp_loaded": bool(getattr(llm, "use_llama_cpp", False) and getattr(llm, "_llama_instance", None)),
    }
