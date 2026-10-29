"""
把模型偶爾冒出的簡體字轉成正體字。

本地小模型即使系統提示要求正體中文，仍會零星吐出「帮助」「请」這類簡體字。
這裡只轉換「繁體字集（Big5）裡不存在的字」，所以「台灣」「干擾」「皇后」這些
正體用法不會被誤改；對照表來自 OpenCC（Apache-2.0），存成 s2t_chars.json。
逐字轉換，所以串流時每個片段各自轉換即可，與存進資料庫的全文結果一致。
"""
import json
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def _table() -> dict[int, str]:
    path = Path(__file__).with_name("s2t_chars.json")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return str.maketrans(data)


def to_traditional(text: str) -> str:
    if not text:
        return text
    return text.translate(_table())
