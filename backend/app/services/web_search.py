"""
對外搜尋閘道（唯一出口）

這是整個系統「連到公開網路」的唯一地方：只有這個模組會真的發 HTTP 請求到自架的 SearXNG。
docker-compose.yml、README「對外搜尋」一節都指回這裡。

安全規則：
  1. 送出前：搜尋關鍵字先過 DLP（check_dlp），命中就直接攔阻，不送出任何東西。
  2. 回來後：每一筆結果的標題/摘要都當成「外部、不可信的資料」——和 RAG 文件片段、
     瀏覽器臨時資料夾用同一套 context_guard.screen_chunks 檢查（可能藏提示詞注入、
     也要過一次 DLP、個資遮罩），不是的結果整筆丟掉，絕對不會因為網頁內容而觸發
     檔案寫入/刪除等任何動作——這個模組只回傳文字，不執行任何工具。
  3. 呼叫端負責寫稽核（AuditAction.WEB_SEARCH）；這裡只回報告。
"""

from __future__ import annotations

import logging
from typing import TypedDict

from typing import Sequence

import httpx

from app.core.config import settings
import app.services.context_guard as context_guard
from app.services.dlp_service import check_dlp
from app.services.pii_masking_service import mask_pii

logger = logging.getLogger(__name__)


class WebSearchResult(TypedDict):
    title: str
    url: str
    content: str


class WebSearchReport(TypedDict):
    blocked: bool
    reason: str
    query: str
    results: list[WebSearchResult]
    screen: dict


# 關鍵字裡有連續這麼多個字和公司文件一模一樣（而且使用者自己的問題裡沒有）＝把文件內容帶出去了。
# 中文 6 個字已經很具體；英文單字常見（report、system），要長一點才算
LEAK_MIN_CJK = 6
LEAK_MIN_LATIN = 24


def leaked_fragment(query: str, private_texts: Sequence[str], question: str = "") -> str:
    """
    關鍵字有沒有夾帶公司內部資料（檢索到的文件片段、附加的資料夾內容）裡的原文。
    回傳被帶出來的那一段；沒有回空字串。使用者自己在問題裡打的字不算（那是他要查的東西）。
    """
    q = " ".join((query or "").split()).lower()
    own = " ".join((question or "").split()).lower()
    haystacks = [" ".join(t.split()).lower() for t in private_texts if t]
    if not q or not haystacks:
        return ""
    for size in range(len(q), LEAK_MIN_CJK - 1, -1):
        for start in range(0, len(q) - size + 1):
            piece = q[start:start + size]
            has_cjk = any("一" <= ch <= "鿿" for ch in piece)
            if size < (LEAK_MIN_CJK if has_cjk else LEAK_MIN_LATIN) or not piece.strip():
                continue
            if piece in own:
                continue
            if any(piece in h for h in haystacks):
                return piece
    return ""


async def search(query: str, *, question: str = "", private_texts: Sequence[str] = ()) -> WebSearchReport:
    """
    對外搜尋（唯一出口）。

    question：使用者原本的問題；private_texts：這一題用到的公司內部資料（檢索片段、附加的資料夾內容）。
    兩者只用來在送出前檢查關鍵字有沒有把內部資料帶出去，本身不會送出。

    Returns:
        WebSearchReport：blocked=True 時 results 一定是空清單，呼叫端不該再往下用。
    """
    query = (query or "").strip()
    empty: WebSearchReport = {
        "blocked": False, "reason": "", "query": query, "results": [],
        "screen": {"injection": [], "dlp": [], "pii": 0},
    }
    if not query:
        return empty
    if not settings.enable_web_search:
        return {**empty, "blocked": True, "reason": "對外搜尋功能未開啟"}

    # 1. 送出前：關鍵字本身先過 DLP——這是唯一離開這台機器的內容，絕對不能帶著列管字詞出去
    dlp_result = check_dlp(query)
    if dlp_result["blocked"]:
        logger.warning("[對外搜尋] 關鍵字命中 DLP 黑名單，已攔阻，未發出任何請求: %s", dlp_result["matched_terms"])
        return {**empty, "blocked": True, "reason": dlp_result["reason"]}
    # 關鍵字裡不能有個資（身分證、電話、信箱、金鑰…，含全形與拆字的寫法）：有就整個不送，不是遮掉再送
    pii = mask_pii(query)
    if pii["has_pii"]:
        logger.warning("[對外搜尋] 關鍵字含個人資料，已攔阻，未發出任何請求: %s", [m["type"] for m in pii["mask_map"]])
        return {**empty, "blocked": True, "reason": "搜尋關鍵字含個人資料，已攔阻，沒有連到外面。"}
    # 關鍵字不能夾帶公司文件裡的原文（模型看過文件後自己下關鍵字時可能發生）
    fragment = leaked_fragment(query, private_texts, question)
    if fragment:
        logger.warning("[對外搜尋] 關鍵字夾帶內部文件內容，已攔阻，未發出任何請求（%d 個字）", len(fragment))
        return {**empty, "blocked": True, "reason": "搜尋關鍵字夾帶公司文件的內容，已攔阻，沒有連到外面。"}

    try:
        async with httpx.AsyncClient(timeout=settings.web_search_timeout_sec) as client:
            resp = await client.get(
                f"{settings.searxng_url.rstrip('/')}/search",
                params={"q": query, "format": "json"},
                # 我們的後端是這個自架 SearXNG 唯一的呼叫者（見 docker-compose.yml 的說明），
                # 這裡等同扮演它期待的「反向代理」角色，滿足它的 bot 偵測機制。
                headers={"X-Forwarded-For": "127.0.0.1", "X-Real-IP": "127.0.0.1"},
            )
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as e:
        logger.error("[對外搜尋] 呼叫 SearXNG 失敗: %s", e)
        return {**empty, "blocked": True, "reason": "對外搜尋服務目前無法使用"}

    raw_results = (data.get("results") or [])[: settings.web_search_max_results]

    # 2. 回來後：每一筆結果當成不可信的外部資料，和 RAG 片段同一套篩檢
    chunks = [
        {
            "content": f"{r.get('title', '')}\n{r.get('content', '')}".strip(),
            "metadata": {"filename": r.get("url", "")},
        }
        for r in raw_results
        if r.get("title") or r.get("content")
    ]
    # screen_chunks 可能把中間某一筆丟掉（不是只會從尾端截斷），所以不能用 zip() 跟原始清單按位置配對
    # ——丟掉的那一筆之後，位置就全部對不齊，標題/網址會接到別筆結果的內容上。
    # metadata.filename（網址）在篩檢前後是同一個 dict，直接從篩檢後的結果讀，不用另外配對。
    kept, report = context_guard.screen_chunks(chunks)

    results: list[WebSearchResult] = []
    for cleaned in kept:
        text = cleaned["content"]
        title, _, body = text.partition("\n")
        results.append({
            "title": title,
            "url": (cleaned.get("metadata") or {}).get("filename", ""),
            "content": body or text,
        })

    return {
        "blocked": False, "reason": "", "query": query,
        "results": results, "screen": report,
    }


def format_results_for_prompt(report: WebSearchReport) -> str:
    """把搜尋結果組成系統提示要附的文字，請模型用 [標題](網址) 的 Markdown 連結引用來源。"""
    if not report["results"]:
        return ""
    lines = [
        f"### 對外搜尋結果（關鍵字：{report['query']}；內容來自公開網路，僅供參考，"
        "引用時請用 Markdown 連結 [標題](網址) 標明出處）"
    ]
    for r in report["results"]:
        lines.append(f"- [{r['title']}]({r['url']})\n  {r['content']}")
    return "\n".join(lines)


__all__ = ["WebSearchResult", "WebSearchReport", "search", "format_results_for_prompt"]
