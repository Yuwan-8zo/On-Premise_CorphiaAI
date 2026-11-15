from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.core.request_utils import get_client_ip
from app.services.audit_service import AuditAction, AuditResource, write_audit_log
from app.services.model_manager import get_model_manager
from app.services.llm_service import get_llm_service
from app.services.model_preference import get_user_model, set_user_model

# 查看與切換模型需要登入；每個人切換的是「自己」用的模型（不影響其他人）。重新掃描模型目錄只開放管理員與工程師
router = APIRouter(prefix="/models", tags=["Models"])

class SelectModelRequest(BaseModel):
    name: str

@router.get("")
async def get_all_models(current_user: CurrentUser, db: DbSession) -> Dict[str, Any]:
    """模型清單；current_model 是「這個人」目前用的模型（自己選的，沒選過就是系統預設）"""
    data = get_model_manager().to_dict()
    data["current_model"] = await get_user_model(db, current_user.id)
    return data

@router.post("/refresh")
async def refresh_models_api(current_user: AdminUser, db: DbSession, request: Request) -> Dict[str, Any]:
    manager = get_model_manager()
    manager.scan_models()
    # 重要：models list 變動後，必須同步重載 LLM，否則會卡在啟動時的模擬模式
    llm = get_llm_service()
    llm.reload_llama()
    await llm.initialize()
    await write_audit_log(
        db=db, action=AuditAction.MODEL_REFRESH, resource_type=AuditResource.MODEL,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description="重新掃描模型資料夾", details={"count": len(manager.available_models)},
        ip_address=get_client_ip(request),
    )
    return manager.to_dict()

@router.post("/select")
async def select_model(
    body: SelectModelRequest, current_user: CurrentUser, db: DbSession, request: Request
) -> Dict[str, Any]:
    """
    切換「自己」用的模型：只記在這個人的設定，不改系統預設、不影響其他人。
    模型還沒載入時這裡先載入（之後留在記憶體），送出問題時就不用再等。
    """
    manager = get_model_manager()
    info = manager.get_model(body.name)
    if info is None:
        raise HTTPException(status_code=404, detail="Model currently unavailable.")
    if body.name == await get_user_model(db, current_user.id):
        return {"message": f"Already using {body.name}", "current_model": body.name}

    llm = get_llm_service()
    if llm.use_llama_cpp:
        try:
            await llm._ensure_loaded(info.name, info.path)
        except Exception as e:
            raise HTTPException(status_code=503, detail="模型載入失敗，請稍後再試") from e
    await set_user_model(db, current_user.id, body.name)
    await write_audit_log(
        db=db, action=AuditAction.MODEL_SELECT, resource_type=AuditResource.MODEL,
        user_id=current_user.id, user_email=current_user.email, tenant_id=current_user.effective_tenant_id,
        description=f"切換自己的模型: {body.name}", details={"model": body.name},
        ip_address=get_client_ip(request),
    )
    return {"message": f"Successfully selected {body.name}", "current_model": body.name}

@router.get("/status")
async def get_model_status(current_user: CurrentUser, db: DbSession) -> Dict[str, Any]:
    manager = get_model_manager()
    llm = get_llm_service()
    mine = await get_user_model(db, current_user.id)
    info = manager.get_model(mine) if mine else None
    return {
        # 這個人用的模型（自己選的，沒選過就是系統預設）
        "loaded": info is not None,
        "current_model": mine,
        "model_path": info.path if info else None,
        # 真實推論層級：llama-cpp 是否成功掛載（避免 UI 誤以為已載入但其實仍是模擬）
        "llama_cpp_loaded": bool(getattr(llm, "use_llama_cpp", False) and getattr(llm, "_llama_instance", None)),
    }
