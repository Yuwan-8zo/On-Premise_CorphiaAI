"""
對外搜尋 API

只有一個讀用途的端點：前端用它決定「這一題要不要先跟使用者確認搜尋關鍵字再送出」。
真正執行搜尋走既有的訊息流程（messages.py / websocket.py 帶 web_search: true，
由 services/web_search.py 當唯一出口）；管理者要不要把「自動搜尋」打開，沿用既有的
PUT /tenants/{tenant_id}（settings.web_search_auto），這裡不重複開一個端點。
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.tenant import Tenant

router = APIRouter(prefix="/web-search", tags=["對外搜尋"])


@router.get("/policy")
async def get_policy(current_user: CurrentUser, db: DbSession):
    """這個租戶看不看得到搜尋功能、要不要每次先問使用者才搜"""
    auto = False
    if settings.enable_web_search and current_user.effective_tenant_id:
        tenant = await db.get(Tenant, current_user.effective_tenant_id)
        if tenant:
            auto = bool((tenant.settings or {}).get("web_search_auto", False))
    return {"enabled": settings.enable_web_search, "auto": auto}
