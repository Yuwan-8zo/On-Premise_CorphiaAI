/**
 * AI 這一題自己做了哪些步驟（查文件、連外網、計算、看時間）
 *
 *   - 正在做：最後一行顯示「正在查文件…」帶呼吸動畫
 *   - 做完：收成一行「用了 2 個步驟」，點開看每一步做了什麼、有沒有成功
 *
 * 目的是讓使用者看得到 AI 動過什麼（尤其是有沒有連外網），不是黑盒子。資料存在訊息上，重新整理後還在。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, ChevronDown, Clock, FileText, Gauge, Globe } from '@/components/snow/icons'
import type { IconProps } from '@/components/snow/icons'
import type { MessageStep } from '@/types/chat'

/** 每種工具的圖示；沒列到的（之後新增的工具）用通用的 */
const TOOL_ICONS: Record<string, React.ComponentType<IconProps>> = {
    search_documents: FileText,
    web_search: Globe,
    calculate: Gauge,
    current_time: Clock,
}

interface StepsBlockProps {
    steps: MessageStep[]
    /** 正在用哪個工具（串流期間才有） */
    working?: string
}

export default function StepsBlock({ steps, working }: StepsBlockProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    if (!steps.length && !working) return null
    const text = 'text-text-muted text-[length:var(--fs-13)]'
    const WorkingIcon = working ? TOOL_ICONS[working] ?? Gauge : null

    return (
        <div className="mb-3">
            {steps.length > 0 && (
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className={`flex items-center gap-1.5 ${text} hover:text-text-secondary transition-colors select-none`}
                >
                    <span>{t('ui.chat.steps.count', { n: steps.length })}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>
            )}
            {open && (
                <ol className={`mt-1.5 pl-3 border-l-2 border-[var(--paper-line)] flex flex-col gap-1.5 ${text}`}>
                    {steps.map((step, i) => {
                        const Icon = TOOL_ICONS[step.tool] ?? Gauge
                        return (
                            <li key={i} className="flex items-start gap-2 min-w-0">
                                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span className="min-w-0 break-words selectable-text">{step.summary}</span>
                                {step.ok
                                    ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--ink-green)]" aria-label={t('ui.chat.steps.ok')} />
                                    : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--danger-ink)]" aria-label={t('ui.chat.steps.failed')} />}
                            </li>
                        )
                    })}
                </ol>
            )}
            {working && WorkingIcon && (
                <div className={`flex items-center gap-2 ${text} ${steps.length ? 'mt-1.5' : ''} animate-pulse`} role="status">
                    <WorkingIcon className="w-4 h-4 flex-shrink-0" />
                    <span>{t(`ui.chat.steps.working.${working}`, t('ui.chat.steps.working.other'))}</span>
                </div>
            )}
        </div>
    )
}
