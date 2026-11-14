"""
稽核紀錄防竄改鏈 (audit_chain.py)

每一筆稽核紀錄寫入時，把「上一筆的雜湊＋這一筆的全部欄位」算成 SHA-256，存成這一筆的雜湊，
一筆接一筆串起來（和訊息的雜湊鏈同一個做法，見 hash_chain_service.py）。
有人直接改資料庫裡任何一筆的內容、或刪掉中間一筆，重算時就對不上，verify_chain 會指出是哪一筆。

做不到的（寫在報告的研究限制）：
  - 刪掉「最後幾筆」：鏈本身看不出來少了尾巴。對策是定期把 verify_chain 回報的最新編號與雜湊
    抄到系統外（錨點），之後比對；本函式回傳的 head 就是給這個用的。
  - 擁有資料庫完整寫入權限的人把整條鏈重算一遍：同上，靠系統外的錨點才擋得住。
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time_utils import utc_now_naive
from app.models.audit_log import AuditLog

GENESIS = "GENESIS"
# 同一時間只能有一個寫入者接鏈（PostgreSQL 交易層級的鎖，交易結束自動放開）
_LOCK_KEY = 0x0A0D17C4A1
# 驗證時一次讀幾筆（紀錄很多時不要一次全部載入記憶體）
VERIFY_BATCH = 2000


def normalize_details(details: Optional[dict]) -> dict:
    """先轉成純 JSON 的樣子再存：存進資料庫、讀回來之後算出來的雜湊才會和寫入時一樣"""
    return json.loads(json.dumps(details or {}, ensure_ascii=False, default=str))


def compute_entry_hash(prev_hash: str, seq: int, log: AuditLog) -> str:
    fields: list[Any] = [
        prev_hash, seq, log.created_at.isoformat() if log.created_at else "",
        log.action, log.resource_type, log.resource_id, log.user_id, log.user_email, log.tenant_id,
        log.description, json.dumps(log.details or {}, ensure_ascii=False, sort_keys=True),
        log.ip_address, log.user_agent,
    ]
    payload = "\x1f".join("" if f is None else str(f) for f in fields)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def stamp(db: AsyncSession, log: AuditLog) -> None:
    """接到鏈的尾巴（要在同一個交易裡 commit；commit 之後鎖才放開，下一筆才接得上）"""
    await db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_KEY})
    last = (await db.execute(
        select(AuditLog.chain_seq, AuditLog.entry_hash)
        .where(AuditLog.chain_seq.isnot(None))
        .order_by(AuditLog.chain_seq.desc()).limit(1)
    )).first()
    seq = (last.chain_seq + 1) if last else 1
    prev = last.entry_hash if last else GENESIS
    if log.created_at is None:
        log.created_at = utc_now_naive()
    log.details = normalize_details(log.details)
    log.chain_seq = seq
    log.prev_hash = prev
    log.entry_hash = compute_entry_hash(prev, seq, log)


async def verify_chain(db: AsyncSession) -> dict:
    """
    從頭驗證整條鏈。回傳：
      valid      整條鏈對不對
      checked    驗了幾筆
      broken_at  第一個出問題的編號（valid 時是 None）
      problem    出了什麼問題：「內容被改過」「中間少了紀錄」「前後接不上」
      head       最新一筆的編號與雜湊（抄到系統外當錨點）
    """
    expected_seq, expected_prev, checked = 1, GENESIS, 0
    head = None
    after = 0
    while True:
        rows = (await db.execute(
            select(AuditLog).where(AuditLog.chain_seq.isnot(None), AuditLog.chain_seq > after)
            .order_by(AuditLog.chain_seq).limit(VERIFY_BATCH)
            .execution_options(populate_existing=True)  # 一律重讀資料庫，不用記憶體裡的舊值
        )).scalars().all()
        if not rows:
            break
        for log in rows:
            problem = None
            if log.chain_seq != expected_seq:
                problem = "中間少了紀錄"
            elif log.prev_hash != expected_prev:
                problem = "前後接不上"
            elif compute_entry_hash(log.prev_hash, log.chain_seq, log) != log.entry_hash:
                problem = "內容被改過"
            if problem:
                return {"valid": False, "checked": checked, "broken_at": expected_seq if problem == "中間少了紀錄" else log.chain_seq,
                        "broken_id": log.id, "problem": problem, "head": head}
            checked += 1
            head = {"seq": log.chain_seq, "hash": log.entry_hash, "at": log.created_at.isoformat() if log.created_at else None}
            expected_seq, expected_prev = log.chain_seq + 1, log.entry_hash
        after = rows[-1].chain_seq
    return {"valid": True, "checked": checked, "broken_at": None, "broken_id": None, "problem": None, "head": head}


__all__ = ["stamp", "verify_chain", "compute_entry_hash", "normalize_details", "GENESIS"]
