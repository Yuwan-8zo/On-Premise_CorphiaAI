/**
 * 思考過程區塊（只有支援推理的模型，如 Qwen3、gpt-oss，才會有內容）
 *
 * 行為跟 Claude 的 extended thinking 一樣：
 *   - 模型還在想、正式回答還沒開始出現文字時：整段展開顯示，標題帶呼吸動畫「思考中…」
 *   - 正式回答一開始出現文字：自動收合成一行「已完成思考」，使用者可以點開回顧
 *   - 使用者手動點開／收合過之後，不會再被自動收合蓋過去（尊重操作）
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from '@/components/snow/icons'

interface ThinkingBlockProps {
    reasoning: string
    /** 正式回答是否已經開始出現文字：是的話自動收合一次 */
    collapsedByDefault: boolean
    /** 模型是否還在輸出思考內容（還沒進到正式回答） */
    isThinking: boolean
}

export default function ThinkingBlock({ reasoning, collapsedByDefault, isThinking }: ThinkingBlockProps) {
    const { t } = useTranslation()
    const [expanded, setExpanded] = useState(!collapsedByDefault)
    const userToggled = useRef(false)
    const contentRef = useRef<HTMLDivElement | null>(null)

    // 正式回答開始出現文字的那一刻，自動收合一次；使用者自己展開／收合過之後就不再干預
    useEffect(() => {
        if (collapsedByDefault && !userToggled.current) {
            setExpanded(false)
        }
    }, [collapsedByDefault])

    // 思考中、而且是展開狀態時，每次新文字進來都捲到最下面，讓使用者看得到最新一句
    useEffect(() => {
        if (isThinking && expanded && contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
    }, [reasoning, isThinking, expanded])

    if (!reasoning) return null

    return (
        <div className="mb-3">
            <button
                onClick={() => {
                    userToggled.current = true
                    setExpanded((v) => !v)
                }}
                className="flex items-center gap-1.5 text-text-muted text-[length:var(--fs-13)] hover:text-text-secondary transition-colors select-none"
            >
                <span className={isThinking ? 'animate-pulse' : ''}>
                    {isThinking ? t('ui.chat.thinking') : t('ui.chat.thoughtProcess')}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
                <div
                    ref={contentRef}
                    className="mt-1.5 pl-3 border-l-2 border-[var(--paper-line)] text-text-muted text-[length:var(--fs-13)] whitespace-pre-wrap leading-relaxed selectable-text max-h-[40vh] overflow-y-auto scrollbar-none"
                >
                    {reasoning}
                </div>
            )}
        </div>
    )
}
