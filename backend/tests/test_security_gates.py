"""
資安閘道管理（services/security_gates.py、/api/v1/admin/security/*）

  - 開關與門檻：檢查值、套用到 settings、只有工程師能改、改了寫稽核
  - 命中次數：規則那一關與語意比對、模型複查分得開（同一個稽核動作，靠 details.method）
  - 語意分數：只記兩個數字，留最近 SCORE_KEEP 筆
"""
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.time_utils import utc_now_naive
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import security_gates as sg
from app.services.audit_service import AuditAction


@pytest.fixture(autouse=True)
def _restore_settings():
    """每個測試結束把開關與門檻還原，不影響其他測試"""
    saved = {g.setting: getattr(settings, g.setting) for g in sg.GATES}
    block, review = settings.semantic_guard_block, settings.semantic_guard_review
    sg._reset_scores_for_tests()
    yield
    for k, v in saved.items():
        setattr(settings, k, v)
    settings.semantic_guard_block, settings.semantic_guard_review = block, review
    sg._reset_scores_for_tests()


class TestValidate:
    def test_unknown_gate_rejected(self):
        with pytest.raises(ValueError):
            sg.validate_update({"nope": True}, None, None)

    @pytest.mark.parametrize("block,review", [(0.5, 0.6), (0.5, 0.5), (1.2, 0.5), (0.8, 0)])
    def test_bad_thresholds_rejected(self, block, review):
        with pytest.raises(ValueError):
            sg.validate_update(None, block, review)

    def test_one_threshold_keeps_the_other(self):
        out = sg.validate_update(None, None, 0.6)
        assert out == {"semantic_block": round(settings.semantic_guard_block, 2), "semantic_review": 0.6}

    def test_apply_changes_settings(self):
        sg.save_update(sg.validate_update({"dlp": False}, 0.9, 0.4))
        assert settings.enable_dlp is False
        assert settings.semantic_guard_block == 0.9
        assert settings.semantic_guard_review == 0.4


class TestSavedFile:
    def test_only_known_keys_with_current_values(self, tmp_path, monkeypatch):
        """舊檔裡不認得的欄位丟掉；存的是目前套用中的值，不是檔案原本的內容"""
        monkeypatch.setattr(sg, "RUNTIME_DIR", tmp_path)
        monkeypatch.setattr(sg, "_testing", lambda: False)
        f = tmp_path / sg.GATES_FILE
        f.write_text('{"enabled": {"pii": "x", "nope": true}, "semantic_review": 0.3, "extra": "../../etc"}', encoding="utf-8")
        sg.save_update(sg.validate_update({"dlp": False}, None, None))
        import json
        saved = json.loads(f.read_text(encoding="utf-8"))
        assert saved == {
            "enabled": {"pii": bool(settings.enable_pii_masking), "dlp": False},
            "semantic_review": round(settings.semantic_guard_review, 2),
        }


class TestGateOf:
    def test_rule_vs_semantic_vs_judge(self):
        assert sg._gate_of(AuditAction.DLP_HIT, {"matched_terms_count": 1}) == "dlp"
        assert sg._gate_of(AuditAction.DLP_HIT, {"method": "語意比對"}) == "semantic"
        assert sg._gate_of(AuditAction.PROMPT_INJECTION_BLOCKED, {"method": "模型複查"}) == "llm_judge"
        assert sg._gate_of(AuditAction.PROMPT_INJECTION_BLOCKED, {"method": "模型複查失敗"}) == "llm_judge"
        assert sg._gate_of(AuditAction.PROMPT_INJECTION_BLOCKED, {"risk_level": "high"}) == "injection"
        assert sg._gate_of(AuditAction.PII_DETECTED, {}) == "pii"
        assert sg._gate_of(AuditAction.LOGIN_FAILED, {}) is None


class TestScores:
    def test_keeps_latest_only(self):
        for i in range(sg.SCORE_KEEP + 5):
            sg.record_score(i / 1000, 0.1)
        rows = sg.recent_scores()
        assert len(rows) == sg.SCORE_KEEP
        assert rows[-1][0] == round((sg.SCORE_KEEP + 4) / 1000, 3)


class TestApi:
    async def test_user_forbidden(self, async_client: AsyncClient, test_user: User, user_auth_headers: dict):
        r = await async_client.get("/api/v1/admin/security/gates", headers=user_auth_headers)
        assert r.status_code == 403

    async def test_admin_reads_but_cannot_edit(self, async_client: AsyncClient, test_admin: User, admin_auth_headers: dict):
        r = await async_client.get("/api/v1/admin/security/gates", headers=admin_auth_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["can_edit"] is False
        assert [g["key"] for g in data["gates"]] == [g.key for g in sg.GATES]
        r = await async_client.put("/api/v1/admin/security/gates", headers=admin_auth_headers, json={"enabled": {"dlp": False}})
        assert r.status_code == 403
        assert settings.enable_dlp is True

    async def test_engineer_toggles_and_is_audited(
        self, async_client: AsyncClient, db_session: AsyncSession, test_engineer: User, engineer_auth_headers: dict,
    ):
        r = await async_client.put(
            "/api/v1/admin/security/gates", headers=engineer_auth_headers,
            json={"enabled": {"pii": False}, "semantic_block": 0.85, "semantic_review": 0.55},
        )
        assert r.status_code == 200, r.text
        data = r.json()["data"]
        assert data["enabled"]["pii"] is False
        assert (data["semantic_block"], data["semantic_review"]) == (0.85, 0.55)
        assert settings.enable_pii_masking is False
        log = (await db_session.execute(
            select(AuditLog).where(AuditLog.action == AuditAction.SECURITY_SETTING_UPDATE)
        )).scalars().all()[-1]
        assert log.details["changes"] == {"pii": False, "semantic_block": 0.85, "semantic_review": 0.55}

    async def test_engineer_bad_threshold_400(self, async_client: AsyncClient, test_engineer: User, engineer_auth_headers: dict):
        r = await async_client.put(
            "/api/v1/admin/security/gates", headers=engineer_auth_headers,
            json={"semantic_block": 0.4, "semantic_review": 0.6},
        )
        assert r.status_code == 400

    async def test_hits_counted_per_gate(
        self, async_client: AsyncClient, db_session: AsyncSession, test_engineer: User, engineer_auth_headers: dict,
    ):
        # 同一個測試資料庫裡其他測試也會留下稽核紀錄：先記下原本的數字，只比較增加多少
        async def read():
            r = await async_client.get("/api/v1/admin/security/gates", headers=engineer_auth_headers)
            return {g["key"]: g for g in r.json()["data"]["gates"]}
        base = await read()
        now = utc_now_naive()
        rows = [
            (AuditAction.DLP_HIT, {"matched_terms_count": 1}, now),
            (AuditAction.DLP_HIT, {"method": "語意比對", "score": 0.9}, now),
            (AuditAction.PROMPT_INJECTION_BLOCKED, {"method": "模型複查", "score": 0.6}, now),
            (AuditAction.PII_DETECTED, {}, now - timedelta(days=9)),   # 前一段
        ]
        for action, details, at in rows:
            db_session.add(AuditLog(action=action, resource_type="conversation", details=details, created_at=at))
        await db_session.commit()
        gates = await read()

        def grew(key, field="hits"):
            return gates[key][field] - base[key][field]
        assert grew("dlp") == 1
        assert grew("semantic") == 1
        assert grew("llm_judge") == 1
        assert grew("pii") == 0 and grew("pii", "previous") == 1
        assert gates["dlp"]["daily"][-1] - base["dlp"]["daily"][-1] == 1
        assert gates["context"]["counted"] is False and "hits" not in gates["context"]

    async def test_semantic_scores_endpoint(self, async_client: AsyncClient, test_admin: User, admin_auth_headers: dict):
        sg.record_score(0.72, 0.4)
        r = await async_client.get("/api/v1/admin/security/semantic-scores", headers=admin_auth_headers)
        assert r.status_code == 200
        assert r.json()["data"]["scores"][-1] == [0.72, 0.4]
