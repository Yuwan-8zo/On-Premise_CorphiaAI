"""稽核動作都要有畫面上的名稱：後端新增動作卻忘了翻譯，管理後台會顯示英文代號、還會擠到隔壁欄"""
import re
from pathlib import Path

import pytest

from app.services.audit_service import AuditAction

LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "locales"


def _actions() -> set[str]:
    return {v for k, v in vars(AuditAction).items() if k.isupper() and isinstance(v, str)}


@pytest.mark.parametrize("locale", ["zh-TW", "en-US", "ja-JP"])
def test_every_audit_action_has_a_label(locale):
    path = LOCALES / f"{locale}.ts"
    if not path.exists():
        pytest.skip("沒有前端原始碼（只部署後端）")
    text = path.read_text(encoding="utf-8")
    start = text.index("actionTypes: {")
    block = text[start:text.index("}", start)]
    labelled = set(re.findall(r"(\w+):", block))
    assert _actions() - labelled == set()
