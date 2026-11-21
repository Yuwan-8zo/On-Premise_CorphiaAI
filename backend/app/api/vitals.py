"""
使用者體驗量測 API（Web Vitals）

  POST /vitals          登入的使用者回報這次使用量到的數字（一次最多 MAX_BATCH 筆）
  GET  /vitals/summary  管理員看近 N 天的統計：每個指標的第 75 百分位數（Google 判斷網站好壞用的就是 p75）、
                        好／待改善／差各幾筆，並分手機、平板、電腦

只收數字，不收任何對話內容或使用者資訊（模型說明見 models/web_vital.py）。
"""

from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select

from app.api.deps import AdminUser, CurrentUser, DbSession
from app.core.time_utils import utc_now_naive
from app.models.web_vital import RETENTION_DAYS, WebVital

router = APIRouter(prefix="/vitals", tags=["使用者體驗"])

METRICS = ("LCP", "INP", "CLS", "FCP", "TTFB")
MAX_BATCH = 20


class VitalIn(BaseModel):
    name: Literal["LCP", "INP", "CLS", "FCP", "TTFB"]
    # 時間類是毫秒、CLS 是沒有單位的分數；超過 10 分鐘的數字一定是量錯，不收
    value: float = Field(ge=0, le=600_000)
    rating: Literal["good", "needs-improvement", "poor"]
    # 只收「路徑的第一段」這種乾淨的值（前端已經去掉對話編號）
    page: str = Field(max_length=40, pattern=r"^/[a-z0-9_-]*$")
    device: Literal["mobile", "tablet", "desktop"]


class VitalsBatch(BaseModel):
    items: list[VitalIn] = Field(min_length=1, max_length=MAX_BATCH)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def report_vitals(body: VitalsBatch, current_user: CurrentUser, db: DbSession) -> None:
    """記下這次使用量到的數字；順便把超過保留期限的舊資料刪掉"""
    db.add_all(
        WebVital(tenant_id=current_user.tenant_id, name=v.name, value=v.value, rating=v.rating, page=v.page, device=v.device)
        for v in body.items
    )
    await db.execute(delete(WebVital).where(WebVital.created_at < utc_now_naive() - timedelta(days=RETENTION_DAYS)))
    await db.commit()


def _p75(value) -> float | None:
    return round(float(value), 4) if value is not None else None


def _empty_metric() -> dict:
    return {"count": 0, "p75": None, "ratings": {"good": 0, "needs-improvement": 0, "poor": 0}, "devices": {}}


@router.get("/summary")
async def vitals_summary(
    current_user: AdminUser, db: DbSession, days: Annotated[int, Query(ge=1, le=RETENTION_DAYS)] = 7,
) -> dict:
    """近 days 天：每個指標的 p75、筆數、好壞分布，以及各裝置的 p75"""
    scope = [WebVital.created_at >= utc_now_naive() - timedelta(days=days)]
    if not current_user.is_engineer:
        scope.append(WebVital.tenant_id == current_user.tenant_id)
    p75 = func.percentile_cont(0.75).within_group(WebVital.value)

    async def grouped(by: list, *aggregates):
        """依 by 這幾欄分組，回傳 (分組欄…, 統計值…) 的列"""
        return (await db.execute(select(*by, *aggregates).where(*scope).group_by(*by))).all()

    metrics = {m: _empty_metric() for m in METRICS}
    for name, count, value in await grouped([WebVital.name], func.count(), p75):
        if name in metrics:
            metrics[name].update(count=count, p75=_p75(value))
    for name, rating, count in await grouped([WebVital.name, WebVital.rating], func.count()):
        if rating in metrics.get(name, {}).get("ratings", {}):
            metrics[name]["ratings"][rating] = count
    for name, device, count, value in await grouped([WebVital.name, WebVital.device], func.count(), p75):
        if name in metrics:
            metrics[name]["devices"][device] = {"count": count, "p75": _p75(value)}
    return {"days": days, "metrics": metrics}
