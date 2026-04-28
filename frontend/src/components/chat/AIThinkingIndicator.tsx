/**
 * AI 思考狀態指示器
 *
 * 在 AI 串流回應開始前（message.content 為空時），
 * 循環顯示 Processing → Analyzing → Thinking → Generating 等狀態提示，
 * 並附帶動畫點點（dot pulse）與進度條效果。
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** 每個步驟顯示的時間（ms） */
const STEP_DURATION = 1800

const AIThinkingIndicator = () => {
    const { t } = useTranslation()

    // 從 i18n 取得步驟陣列，fallback 到英文預設值
    const steps = t('chat.thinkingSteps', { returnObjects: true }) as string[]
    const safeSteps: string[] = Array.isArray(steps) && steps.length > 0
        ? steps
        : ['Processing', 'Analyzing', 'Thinking', 'Generating']

    const [currentStep, setCurrentStep] = useState(0)
    const [isExiting, setIsExiting] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const advance = () => {
            // 觸發淡出動畫
            setIsExiting(true)
            timerRef.current = setTimeout(() => {
                setCurrentStep((prev) => (prev + 1) % safeSteps.length)
                setIsExiting(false)
            }, 300) // 與 CSS transition 同步
        }

        const intervalId = setInterval(advance, STEP_DURATION)
        return () => {
            clearInterval(intervalId)
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [safeSteps.length])

    return (
        <div className="flex flex-col gap-2 py-1 select-none">
            {/* 主狀態列 */}
            <div className="flex items-center gap-2.5">
                {/* 步驟文字（淡入淡出） */}
                <span
                    className="text-[14px] font-medium text-text-secondary tracking-wide transition-opacity duration-300"
                    style={{ opacity: isExiting ? 0 : 1 }}
                >
                    {safeSteps[currentStep]}
                    {/* 滾動省略號 */}
                    <DotEllipsis />
                </span>
            </div>

            {/* 進度條 */}
            <div className="ml-[28px] h-[2px] w-40 rounded-full bg-bg-elevated overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--color-ios-accent-light))] to-transparent"
                    style={{
                        width: '45%',
                        animation: 'thinking-slide 1.4s ease-in-out infinite',
                    }}
                />
            </div>

            {/* 全域 keyframe 注入（僅首次掛載） */}
            <style>{`
                @keyframes thinking-slide {
                    0%   { transform: translateX(-100%); opacity: 0.4; }
                    50%  { transform: translateX(100%);  opacity: 1; }
                    100% { transform: translateX(250%);  opacity: 0.4; }
                }
            `}</style>
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
