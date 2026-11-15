/**
 * AI 思考狀態指示器
 *
 * 在 AI 串流回應開始前（message.content 為空時），依目前實際情境顯示文字：
 *   - phase='thinking'   → 「思考中...」（剛送出、後端還沒回任何 event）
 *   - phase='retrieving' → 「檢索知識庫...」（RAG 啟用，已等候一小段時間）
 *   - phase='generating' → 「生成回應中...」（sources 已回，LLM 正要產生 tokens）
 *
 * 文字會配上脈動點點，整體跟著當前 phase 切換時帶 fade-in 動畫。
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formatElapsed } from '@/lib/formatElapsed'

export type ThinkingPhase = 'thinking' | 'retrieving' | 'generating'

interface AIThinkingIndicatorProps {
    /** 當前實際狀況。由上層（MessageBubble）依 message.sources 等資訊決定。 */
    phase?: ThinkingPhase
    /** 是否使用 RAG（一般聊天無檢索流程，不要顯示「檢索」狀態） */
    ragEnabled?: boolean
    /** 後端已找到文件段落、模型正在讀：等待說明才提「閱讀文件」 */
    readingDocs?: boolean
    /** 正在製作檔案（docx／xlsx／pptx）：標題改成「正在製作 Word 文件」，不走思考／檢索那幾個階段 */
    making?: string
}

const AIThinkingIndicator = ({ phase = 'thinking', ragEnabled = false, readingDocs = false, making }: AIThinkingIndicatorProps) => {
    const { t } = useTranslation()

    // RAG 模式下，已過 ~1.2 秒仍處於 thinking 階段，自動進到 retrieving，讓使用者感覺有進度
    const [autoRetrieving, setAutoRetrieving] = useState(false)
    useEffect(() => {
        if (!ragEnabled || phase !== 'thinking') {
            setAutoRetrieving(false)
            return
        }
        const id = setTimeout(() => setAutoRetrieving(true), 1200)
        return () => clearTimeout(id)
    }, [ragEnabled, phase])

    const effectivePhase: ThinkingPhase =
        phase === 'thinking' && autoRetrieving ? 'retrieving' : phase

    const phaseLabels: Record<ThinkingPhase, string> = {
        thinking: t('chat.phase.thinking', { defaultValue: '思考中' }),
        retrieving: t('chat.phase.retrieving', { defaultValue: '檢索知識庫中' }),
        generating: t('chat.phase.generating', { defaultValue: '生成回應中' }),
    }

    // phase 切換時做一次 fade transition
    const [displayPhase, setDisplayPhase] = useState<ThinkingPhase>(effectivePhase)
    const [fading, setFading] = useState(false)
    const phaseRef = useRef(effectivePhase)
    useEffect(() => {
        if (effectivePhase === phaseRef.current) return
        setFading(true)
        const id = setTimeout(() => {
            phaseRef.current = effectivePhase
            setDisplayPhase(effectivePhase)
            setFading(false)
        }, 220)
        return () => clearTimeout(id)
    }, [effectivePhase])

    // 純 CPU 跑 7B 讀完文件要一兩分鐘；顯示已等待秒數，避免看起來像當機
    const [elapsed, setElapsed] = useState(0)
    useEffect(() => {
        const start = Date.now()
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
        return () => clearInterval(id)
    }, [])

    return (
        <div className="flex flex-col py-1 select-none">
            <span
                className="text-[length:var(--fs-14)] font-medium text-text-secondary tracking-wide transition-opacity duration-200"
                style={{ opacity: fading ? 0 : 1 }}
            >
                {making ? t(`ui.chat.fileMaking.${making}`, { defaultValue: t('ui.chat.fileMaking.file') }) : phaseLabels[displayPhase]}
                <DotEllipsis />
                {elapsed >= 3 && (
                    <span className="ml-1 text-text-muted font-normal tabular-nums">{t('ui.thinking.waited', { time: formatElapsed(elapsed, t) })}</span>
                )}
            </span>
            {/* 製作檔案：一開始就說明要等多久（不用等 15 秒才出現） */}
            {(making || elapsed >= 15) && (
                <span className="mt-1 text-[length:var(--fs-12)] text-text-muted">
                    {making
                        ? t('ui.chat.fileMakingHint')
                        : readingDocs
                          ? t('ui.thinking.localRag')
                          : t('ui.thinking.local')}
                </span>
            )}
        </div>
    )
}

/**
 * 動態滾動省略號（.  →  ..  →  ...  →  .  循環）
 */
const DotEllipsis = () => {
    const [dots, setDots] = useState(1)

    useEffect(() => {
        const id = setInterval(() => {
            setDots((prev) => (prev % 3) + 1)
        }, 420)
        return () => clearInterval(id)
    }, [])

    return (
        <span className="inline-block w-5 text-left">
            {'.'.repeat(dots)}
        </span>
    )
}

export default AIThinkingIndicator
