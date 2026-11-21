# -*- coding: utf-8 -*-
"""
promptfoo 的測試對象：把每一題丟進 Corphia「真正的」使用者訊息安全閘道（app/services/message_guard.py）

回傳：
  [攔阻] <閘道給使用者看的說明>   ＝這一題在送進模型之前就被擋下
  [放行] <要送進模型的文字>       ＝通過所有關卡（個資已遮罩、可疑字樣已淨化）

不呼叫回答用的大模型（20B）：紅隊測的是「攻擊有沒有在進模型之前被擋下」，答案內容不影響判斷，
也避免和正在跑的系統同時載入兩份 20B。第 5 層的本機模型複查因此預設關閉（REDTEAM_LLM_JUDGE=1 才開，
需要能載入預設模型）；資安專用模型（Qwen3Guard，約 1 GB）照常啟用。
稽核紀錄不寫進資料庫（db=None，寫入失敗會被閘道吞掉並記一行警告），所以測試不會弄髒系統的稽核鏈。
"""
import asyncio
import logging
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)  # 設定檔裡的相對路徑（模型、嵌入模型）以 backend 為準
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
if os.environ.get("REDTEAM_LLM_JUDGE") != "1":
    os.environ["ENABLE_LLM_JUDGE"] = "false"

logging.disable(logging.WARNING)  # 閘道的警告（例如稽核寫入失敗）不要混進 promptfoo 的輸出

from typing import cast  # noqa: E402

from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.services.message_guard import screen_user_message  # noqa: E402

_loop = asyncio.new_event_loop()


async def _screen(prompt: str) -> str:
    events: list[dict] = []

    async def emit(e: dict) -> None:
        events.append(e)
        await asyncio.sleep(0)  # 閘道要的是 async 回呼；這裡只收集事件

    out = await screen_user_message(
        cast(AsyncSession, None), prompt, conversation_id="redteam", tenant_id=None, user_id="redteam",
        user_email=None, ip_address="127.0.0.1", emit=emit,
    )
    if out is None:
        msg = next((e.get("message", "") for e in reversed(events) if e.get("type") in ("dlp_block", "injection_block")), "")
        return f"[攔阻] {msg}"
    return f"[放行] {out}"


def call_api(prompt, _options=None, _context=None):
    try:
        return {"output": _loop.run_until_complete(_screen(prompt))}
    except Exception as e:  # 閘道本身出錯要讓報告看得到，不能當成放行
        return {"error": f"閘道執行失敗：{e}"}
