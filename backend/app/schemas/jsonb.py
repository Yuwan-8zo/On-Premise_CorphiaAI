"""
JSONB 欄位驗證器

PostgreSQL 的 JSONB 欄位（如 settings / preferences / doc_metadata / chunk_metadata）
在模型中常被宣告為 `Mapped[dict]`，理論上可以塞入任意結構，
但這在安全與資料品質上都有風險：
  - 攻擊者若能透過 API 寫入，可能塞入大型 payload 撐爆 DB。
  - 使用 .get() 讀取時若型別意外為 list / None，容易 AttributeError。

這個模組定義一套「安全 JSON dict」驗證規則：
  1. 必須是 dict（不接受 list / str / None 以外的型別）。
  2. 鍵必須是 str，且長度受限。
  3. 遞迴深度受限，避免無限巢狀造成 DoS。
  4. 值型別白名單：str / int / float / bool / None / dict / list。
  5. 序列化後的 JSON 字串有上限。

使用方式（在 schemas 中）：

    from app.schemas.jsonb import SafeJsonDict, validate_safe_json_dict

    class TenantUpdate(BaseModel):
        settings: Optional[SafeJsonDict] = None
        # 或用 validator：
        # settings: Optional[Dict[str, Any]] = None
        # @field_validator("settings")
        # @classmethod
        # def _v(cls, v):
        #     return validate_safe_json_dict(v, context="tenant.settings")
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Annotated

from pydantic import AfterValidator

# ── 規則常數 ─────────────────────────────────────────────────
_MAX_DEPTH = 8                # 最多允許的巢狀深度
_MAX_KEY_LENGTH = 128         # 鍵最大字元數
_MAX_STRING_LENGTH = 8 * 1024  # 單個字串值最大字元數 (8 KB)
_MAX_ITEMS = 512              # 單層 dict/list 最多項目數
_MAX_JSON_BYTES = 64 * 1024   # 整個 JSON 序列化後的最大 bytes (64 KB)

_ALLOWED_SCALAR_TYPES = (str, int, float, bool, type(None))


def _validate_node(node: Any, depth: int, path: str) -> None:
    """遞迴檢查節點。"""
    if depth > _MAX_DEPTH:
        raise ValueError(f"JSON 巢狀深度超過上限 ({_MAX_DEPTH}) at {path}")

    if isinstance(node, dict):
        if len(node) > _MAX_ITEMS:
            raise ValueError(f"JSON dict 項目數超過上限 ({_MAX_ITEMS}) at {path}")
        for k, v in node.items():
            if not isinstance(k, str):
                raise ValueError(f"JSON dict 的鍵必須是字串 at {path}")
            if len(k) > _MAX_KEY_LENGTH:
                raise ValueError(f"JSON 鍵 '{k[:20]}...' 過長 (max={_MAX_KEY_LENGTH})")
            _validate_node(v, depth + 1, f"{path}.{k}")
        return

    if isinstance(node, list):
        if len(node) > _MAX_ITEMS:
            raise ValueError(f"JSON list 項目數超過上限 ({_MAX_ITEMS}) at {path}")
        for i, v in enumerate(node):
            _validate_node(v, depth + 1, f"{path}[{i}]")
        return

    if isinstance(node, str):
        if len(node) > _MAX_STRING_LENGTH:
            raise ValueError(
                f"JSON 字串值過長 (max={_MAX_STRING_LENGTH}) at {path}"
            )
        return

    if isinstance(node, _ALLOWED_SCALAR_TYPES):
        return

    raise ValueError(
        f"JSON 值型別不被允許: {type(node).__name__} at {path}"
    )


def validate_safe_json_dict(
    value: Optional[Dict[str, Any]],
    *,
    context: str = "json",
) -> Optional[Dict[str, Any]]:
    """驗證一個 JSONB 欄位內容是否符合安全規則。

    Args:
        value: 欲驗證的 dict，可為 None
        context: 給錯誤訊息用的來源描述，例如 "tenant.settings"

    Returns:
        原樣返回 value（None 或 dict）。

    Raises:
        ValueError: 不符合規則。
    """
    if value is None:
        return None

    if not isinstance(value, dict):
        raise ValueError(f"{context} 必須是 JSON 物件 (dict)")

    _validate_node(value, depth=1, path=context)

    # 檢查序列化大小
    try:
        payload = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError) as e:
        raise ValueError(f"{context} 無法序列化為 JSON: {e}") from e

    if len(payload.encode("utf-8")) > _MAX_JSON_BYTES:
        raise ValueError(
            f"{context} 序列化後大小超過上限 ({_MAX_JSON_BYTES} bytes)"
        )

    return value


def _safe_json_dict_after(v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return validate_safe_json_dict(v, context="jsonb")


# Pydantic v2 Annotated 型別：直接在 schema 使用 `settings: SafeJsonDict`
SafeJsonDict = Annotated[
    Optional[Dict[str, Any]],
    AfterValidator(_safe_json_dict_after),
]


__all__ = [
    "SafeJsonDict",
    "validate_safe_json_dict",
]
