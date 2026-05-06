"""
Prompt Injection / RAG 投毒偵測服務

差異化功能 A2：檢測使用者輸入或上傳文件中是否包含
「ignore previous instructions」等 prompt injection 攻擊模式。

設計原則：
- 多層偵測：關鍵字匹配 + 結構分析
- 異常事件寫入審計日誌，管理員可檢視
- 不阻斷使用者（僅警告 + 記錄），避免誤殺正常內容
"""

import re
import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class InjectionCheckResult(TypedDict):
    """Injection 偵測結果"""
    is_suspicious: bool
    risk_level: str  # "none" | "low" | "medium" | "high"
    matched_patterns: list[str]
    sanitized_text: str


# ── Prompt Injection 偵測模式 ──────────────────────────────────

_INJECTION_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    # 指令覆寫類
    (
        "忽略先前的指示",
        re.compile(
            r'(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|earlier|original)\s+(?:instructions?|prompts?|rules?|guidelines?|constraints?)',
            re.IGNORECASE
        ),
        "high",
    ),
    (
        "角色扮演覆寫",
        re.compile(
            r'(?:you\s+are\s+now|act\s+as|pretend\s+(?:to\s+be|you\s+are)|role\s*play\s+as|switch\s+(?:to|into)\s+(?:a\s+)?(?:new\s+)?(?:role|persona|character))',
            re.IGNORECASE
        ),
        "medium",
    ),
    (
        "系統提示洩漏",
        re.compile(
            r'(?:reveal|show|display|output|print|repeat|echo)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|original\s+(?:prompt|instructions?))',
            re.IGNORECASE
        ),
        "high",
    ),
    # 中文變體（簡繁兼容）
    (
        "忽略先前指令(中文)",
        re.compile(
            r'(?:忽略|無視|无视|跳過|跳过|不要管|覆蓋|覆盖|取消|清除|遺忘|遗忘)'
            r'.{0,30}(?:之前|先前|以上|原本|預設|预设|前面)'
            r'.{0,30}(?:指令|指示|規則|规则|限制|提示|設定|设定)'
        ),
        "high",
    ),
    (
        "系統提示洩漏(中文)",
        re.compile(
            r'(?:顯示|显示|輸出|输出|告訴我|告诉我|重複|重复|洩漏|泄漏|揭露|展示|印出)'
            r'.{0,30}(?:系統|系统|原始|內部|内部)'
            r'.{0,30}(?:提示|指令|prompt)'
        ),
        "high",
    ),
    # 越獄變體（繁體常見：脫獄、衝破、突破、解除）
    (
        "越獄/脫獄變體(中文)",
        re.compile(
            r'(?:越獄|越狱|脫獄|脱狱|破解|衝破|冲破|突破|解除).{0,20}'
            r'(?:限制|限定|束縛|束缚|安全|規則|规则|防護|防护|管制)'
        ),
        "high",
    ),
    # 角色扮演覆寫（中文）
    (
        "角色扮演覆寫(中文)",
        re.compile(
            r'(?:你現在是|你现在是|假裝你是|假装你是|扮演|請扮演|请扮演|從現在開始你是|从现在开始你是)'
            r'.{0,40}(?:不受限|無限制|无限制|沒有規則|没有规则|無道德|无道德|無倫理|无伦理)'
        ),
        "medium",
    ),
    # Markdown / HTML injection
    (
        "Markdown圖片注入",
        re.compile(r'!\[.*?\]\(https?://.*?\)'),
        "medium",
    ),
    # 分隔符欺騙（試圖模仿 ChatML 結構）
    (
        "ChatML標籤注入",
        re.compile(r'<\|im_(?:start|end)\|>|<<SYS>>|<</SYS>>|\[INST\]|\[/INST\]'),
        "high",
    ),
    # DAN / jailbreak 關鍵模式
    (
        "DAN模式啟動",
        re.compile(
            r'(?:DAN\s+mode|Do\s+Anything\s+Now|enable\s+developer\s+mode|unlock\s+restrictions)',
            re.IGNORECASE
        ),
        "high",
    ),
]


def check_prompt_injection(text: str) -> InjectionCheckResult:
    """
    檢查文字是否包含 prompt injection 攻擊模式

    Args:
        text: 使用者輸入文字

    Returns:
        InjectionCheckResult: 偵測結果
    """
    matched_patterns: list[str] = []
    max_risk = "none"
    risk_order = {"none": 0, "low": 1, "medium": 2, "high": 3}

    for pattern_name, pattern, risk_level in _INJECTION_PATTERNS:
        if pattern.search(text):
            matched_patterns.append(pattern_name)
            if risk_order.get(risk_level, 0) > risk_order.get(max_risk, 0):
                max_risk = risk_level

    is_suspicious = len(matched_patterns) > 0

    # 清理：移除 ChatML 標籤（最危險的注入）
    sanitized_text = text
    if is_suspicious:
        sanitized_text = re.sub(
            r'<\|im_(?:start|end)\|>|<<SYS>>|<</SYS>>|\[INST\]|\[/INST\]',
            '[BLOCKED]',
            sanitized_text
        )

    if is_suspicious:
        logger.warning(
            f"[Prompt Guard] 偵測到可疑輸入 (risk={max_risk}): {matched_patterns}"
        )

    return InjectionCheckResult(
        is_suspicious=is_suspicious,
        risk_level=max_risk,
        matched_patterns=matched_patterns,
        sanitized_text=sanitized_text,
    )


def check_document_injection(text: str) -> InjectionCheckResult:
    """
    檢查上傳文件內容是否包含 RAG 投毒攻擊模式
    （與 prompt injection 相同模式，但閾值更嚴格）

    Args:
        text: 文件內容

    Returns:
        InjectionCheckResult: 偵測結果
    """
    result = check_prompt_injection(text)

    # 文件中出現任何 injection 模式都視為 high risk
    if result["is_suspicious"]:
        result["risk_level"] = "high"
        logger.warning(f"[RAG 投毒偵測] 文件中發現可疑內容: {result['matched_patterns']}")

    return result
