"""使用者體驗量測（Web Vitals）：回報、驗證、統計、權限、只存數字"""
from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import delete, select

from app.core.time_utils import utc_now_naive
from app.models.web_vital import RETENTION_DAYS, WebVital


def _item(name="LCP", value=1800.0, rating="good", page="/", device="desktop"):
    return {"name": name, "value": value, "rating": rating, "page": page, "device": device}


async def test_report_saves_numbers_only(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    r = await async_client.post("/api/v1/vitals", json={"items": [_item(), _item("INP", 120, page="/admin", device="mobile")]}, headers=user_auth_headers)
    assert r.status_code == 204
    rows = (await db_session.execute(select(WebVital))).scalars().all()
    assert {("LCP", "/", "desktop"), ("INP", "/admin", "mobile")} <= {(v.name, v.page, v.device) for v in rows}
    # 只記組織，不記是誰
    assert all(v.tenant_id == test_user.tenant_id for v in rows)
    assert not hasattr(WebVital, "user_id")


async def test_report_requires_login(async_client: AsyncClient):
    r = await async_client.post("/api/v1/vitals", json={"items": [_item()]})
    assert r.status_code in (401, 403)


async def test_report_rejects_bad_values(async_client: AsyncClient, user_auth_headers):
    bad = [
        _item(name="XSS"),                 # 不認得的指標
        _item(value=-1),                   # 負數
        _item(value=10_000_000),           # 不合理的大數字
        _item(rating="great"),             # 不認得的等級
        _item(page="/c/123e4567?x=1"),     # 路徑裡有對話編號、查詢字串
        _item(device="tv"),
    ]
    for item in bad:
        r = await async_client.post("/api/v1/vitals", json={"items": [item]}, headers=user_auth_headers)
        assert r.status_code == 422, item
    too_many = {"items": [_item()] * 21}
    assert (await async_client.post("/api/v1/vitals", json=too_many, headers=user_auth_headers)).status_code == 422


async def test_summary_is_admin_only(async_client: AsyncClient, user_auth_headers):
    r = await async_client.get("/api/v1/vitals/summary", headers=user_auth_headers)
    assert r.status_code == 403


async def test_summary_p75_and_ratings(async_client: AsyncClient, db_session, user_auth_headers, admin_auth_headers):
    # 測試資料庫裡可能有前面測試留下的量測：先清空，統計才算得準
    await db_session.execute(delete(WebVital))
    await db_session.commit()
    items = [_item("INP", v, "good" if v <= 200 else "poor", device="mobile") for v in (100, 150, 180, 400)]
    assert (await async_client.post("/api/v1/vitals", json={"items": items}, headers=user_auth_headers)).status_code == 204
    r = await async_client.get("/api/v1/vitals/summary?days=7", headers=admin_auth_headers)
    assert r.status_code == 200
    inp = r.json()["metrics"]["INP"]
    assert inp["count"] == 4
    # 100、150、180、400 的第 75 百分位數（線性內插）＝ 180 + 0.25 × 220 ＝ 235
    assert abs(inp["p75"] - 235) < 0.01
    assert inp["ratings"] == {"good": 3, "needs-improvement": 0, "poor": 1}
    assert inp["devices"]["mobile"]["count"] == 4
    assert r.json()["metrics"]["CLS"]["count"] == 0


async def test_old_rows_are_pruned(async_client: AsyncClient, db_session, test_user, user_auth_headers):
    old = WebVital(tenant_id=test_user.tenant_id, name="LCP", value=1.0, rating="good", page="/old", device="desktop",
                   created_at=utc_now_naive() - timedelta(days=RETENTION_DAYS + 1))
    db_session.add(old)
    await db_session.commit()
    old_id = old.id
    await async_client.post("/api/v1/vitals", json={"items": [_item(page="/new")]}, headers=user_auth_headers)
    db_session.expire_all()
    ids = {v.id for v in (await db_session.execute(select(WebVital))).scalars().all()}
    pages = {v.page for v in (await db_session.execute(select(WebVital))).scalars().all()}
    assert old_id not in ids          # 超過保留期限的刪掉了
    assert "/new" in pages            # 新的有存
