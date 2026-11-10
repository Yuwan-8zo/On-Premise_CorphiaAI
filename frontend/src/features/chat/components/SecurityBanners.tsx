/**
 * 安全警示元件 (A1 + A2 差異化功能)
 *
 * 顯示 PII 遮罩警告和 Prompt Injection 偵測警告。
 * 這些是中小企業地端資安的核心差異化UI。
 */

import { ChevronDown } from '@/components/snow/icons'
import { useState } from 'react'
import MaterialIcon from '@/components/icons/MaterialIcon'

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
        <div className="glass-chip rounded-[18px] p-3 mb-2 text-xs">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 w-full text-left"
            >
                <MaterialIcon name="security" size={18} className="text-amber-600 dark:text-amber-300" aria-hidden />
                <span className="font-medium text-amber-700 dark:text-amber-300 flex-1">
                    {message}
                </span>
                <ChevronDown className={`w-3 h-3 text-amber-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[var(--paper-line)] space-y-1">
                    {maskMap.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded-[6px] bg-amber-500/15 text-amber-700 dark:text-amber-300 tabular-nums">
                                {item.label}
                            </span>
                            <span className="text-text-secondary tabular-nums">
                                {item.original_preview}
                            </span>
                            <span className="text-text-muted">→</span>
                            <span className="text-amber-600 dark:text-amber-300 tabular-nums">
                                {item.masked}
                            </span>
                        </div>
                    ))}
                    <p className="text-[11px] text-amber-700/70 dark:text-amber-300/70 mt-1">
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

// 各風險等級對應的 Material Symbols 圖示與顏色 token
const RISK_COLORS: Record<string, { border: string; bg: string; text: string; icon: string }> = {
    low: {
        border: '',
        bg: '',
        text: 'text-text-secondary',
        icon: 'info',
    },
    medium: {
        border: '',
        bg: '',
        text: 'text-orange-700 dark:text-orange-300',
        icon: 'warning',
    },
    high: {
        border: '',
        bg: '',
        text: 'text-red-700 dark:text-red-400',
        icon: 'crisis_alert',
    },
}

export function InjectionWarningBanner({ riskLevel, matchedPatterns, message }: InjectionWarningProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const colors = RISK_COLORS[riskLevel] || RISK_COLORS.medium

    return (
        <div className={`glass-chip rounded-[18px] p-3 mb-2 text-xs`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 w-full text-left"
            >
                <MaterialIcon name={colors.icon} size={18} className={colors.text} aria-hidden />
                <span className={`font-medium ${colors.text} flex-1`}>
                    {message}
                </span>
                <span className={`px-1.5 py-0.5 rounded tabular-nums text-[12px] ${colors.text} ${colors.bg}`}>
                    {riskLevel}
                </span>
            </button>

            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                    <p className="text-[11px] text-text-secondary mb-1">
                        偵測到的模式:
                    </p>
                    {matchedPatterns.map((pattern, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" />
                            <span className={`tabular-nums ${colors.text}`}>
                                {pattern}
                            </span>
                        </div>
                    ))}
                    <p className="text-[10px] text-text-muted mt-2">
                        系統已自動清除危險標記（如 ChatML 標籤），並記錄此事件於審計日誌。
                    </p>
                </div>
            )}
        </div>
    )
}
