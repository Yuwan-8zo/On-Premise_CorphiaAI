/**
 * 安全警示元件 (A1 + A2 差異化功能)
 *
 * 顯示 PII 遮罩警告和 Prompt Injection 偵測警告。
 * 這些是中小企業地端資安的核心差異化UI。
 */

import { useState } from 'react'

// ── PII 遮罩警告 ──────────────────────────────────────────────

interface PIIWarningProps {
    maskMap: Array<{
        original_preview: string
        masked: string
        type: string
        label: string
    }>
    message: string
}

export function PIIWarningBanner({ maskMap, message }: PIIWarningProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="rounded-xl border border-amber-300/50 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-sm p-3 mb-2 text-xs">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 w-full text-left"
            >
                <span className="text-amber-600 dark:text-amber-400 text-sm">🛡️</span>
                <span className="font-medium text-amber-700 dark:text-amber-300 flex-1">
                    {message}
                </span>
                <svg
                    className={`w-3 h-3 text-amber-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-amber-200/50 dark:border-amber-600/30 space-y-1">
                    {maskMap.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-amber-200/60 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 font-mono">
                                {item.label}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 font-mono">
                                {item.original_preview}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-amber-600 dark:text-amber-400 font-mono">
                                {item.masked}
                            </span>
                        </div>
                    ))}
                    <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-1">
                        送入 AI 模型的是遮罩後的內容，原始敏感資訊不會進入模型。
                    </p>
                </div>
            )}
        </div>
    )
}


// ── Prompt Injection 警告 ────────────────────────────────────

interface InjectionWarningProps {
    riskLevel: string
    matchedPatterns: string[]
    message: string
}

const RISK_COLORS: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    low: {
        border: 'border-blue-300/50 dark:border-blue-500/30',
        bg: 'bg-blue-50/80 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        icon: 'ℹ️',
    },
    medium: {
        border: 'border-orange-300/50 dark:border-orange-500/30',
        bg: 'bg-orange-50/80 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-300',
        icon: '⚠️',
    },
    high: {
        border: 'border-red-300/50 dark:border-red-500/30',
        bg: 'bg-red-50/80 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-300',
        icon: '🚨',
    },
}

export function InjectionWarningBanner({ riskLevel, matchedPatterns, message }: InjectionWarningProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const colors = RISK_COLORS[riskLevel] || RISK_COLORS.medium

    return (
        <div className={`rounded-xl border ${colors.border} ${colors.bg} backdrop-blur-sm p-3 mb-2 text-xs`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 w-full text-left"
            >
                <span className="text-sm">{colors.icon}</span>
                <span className={`font-medium ${colors.text} flex-1`}>
                    {message}
                </span>
                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider ${colors.text} ${colors.bg}`}>
                    {riskLevel}
                </span>
            </button>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                        偵測到的模式:
                    </p>
                    {matchedPatterns.map((pattern, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                            <span className={`font-mono ${colors.text}`}>
                                {pattern}
                            </span>
                        </div>
                    ))}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                        系統已自動清除危險標記（如 ChatML 標籤），並記錄此事件於審計日誌。
                    </p>
                </div>
            )}
        </div>
    )
}
