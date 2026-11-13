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
from typing import Optional, TypedDict

import httpx

from app.core.config import settings
from app.services import context_guard
from app.services.dlp_service import check_dlp

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


async def search(query: str) -> WebSearchReport:
    """
    對外搜尋（唯一出口）。

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
    kept, report = context_guard.screen_chunks(chunks)

    results: list[WebSearchResult] = []
    for original, cleaned in zip(
        [r for r in raw_results if r.get("title") or r.get("content")], kept
    ):
        text = cleaned["content"]
        title, _, body = text.partition("\n")
        results.append({
            "title": title or original.get("title", ""),
            "url": original.get("url", ""),
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
