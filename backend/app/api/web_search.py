"""
對外搜尋 API

只有一個讀用途的端點：前端用它決定這個單位看不看得到連網相關的操作（每則回答下面的「連網重答」）。
真正執行搜尋走既有的訊息流程（messages.py / websocket.py；要不要查由 services/web_search_policy 決定，
services/web_search.py 是唯一出口）；管理者改政策沿用既有的
PUT /tenants/{tenant_id}（settings.web_search_mode：auto／ask／off），這裡不重複開一個端點。
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.tenant import Tenant
from app.services.web_search_policy import DEFAULT_MODE, mode_from_settings

router = APIRouter(prefix="/web-search", tags=["對外搜尋"])


@router.get("/policy")
async def get_policy(current_user: CurrentUser, db: DbSession):
    """
    這個單位的對外搜尋政策。
    mode：auto＝需要即時資訊時自動查、ask＝不自動查（回答下面可以按連網重答）、off＝完全不連外網。
    enabled：使用者這邊可不可以連網（系統有開、而且政策不是 off）。auto 留給舊版前端。
    """
    mode = "off"
    if settings.enable_web_search:
        mode = DEFAULT_MODE
        if current_user.effective_tenant_id:
            tenant = await db.get(Tenant, current_user.effective_tenant_id)
            if tenant:
                mode = mode_from_settings(tenant.settings)
    return {"enabled": mode != "off", "auto": mode == "auto", "mode": mode}
