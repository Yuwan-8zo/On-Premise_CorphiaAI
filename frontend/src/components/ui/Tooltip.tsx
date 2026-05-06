/**
 * Tooltip — 包在任何 button / icon 外面就能顯示懸浮提示。
 *
 * 設計（v2）：
 *   - 用 React Portal 把 tooltip 渲染到 document.body，
 *     不會被 ancestor 的 overflow:hidden / overflow-x-auto 切掉
 *   - 用 useState 追蹤 hover，每個 Tooltip 獨立 state，
 *     不再用 group-hover —— 之前 v1 用 group-hover 的問題：
 *     如果父層 (例如 <tr class="group">) 也用 .group，
 *     hover 父層時所有子 Tooltip 都會跑出來
 *   - position: fixed + 動態計算座標，跟著元素貼齊
 *
 * 用法：
 *   <Tooltip label="刪除">
 *     <button>...</button>
 *   </Tooltip>
 *
 * 注意：children 必須是 ReactElement（單一元素），會被 wrap 在 span 內。
 */
import { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
    /** 顯示在 tooltip 內的文字 */
    label: string
    /** 被包住的元素（要能 hover） */
    children: ReactNode
    /** tooltip 出現位置；預設 top */
    placement?: TooltipPlacement
    /** 額外 className 加在外層 wrapper（例如 self-stretch） */
    className?: string
    /** hover 多久後才顯示（ms），預設 0（立即） */
    delay?: number
}

interface Position {
    top: number
    left: number
}

export default function Tooltip({
    label,
    children,
    placement = 'top',
    className = '',
    delay = 0,
}: TooltipProps) {
    const wrapperRef = useRef<HTMLSpanElement | null>(null)
    const tooltipRef = useRef<HTMLSpanElement | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [position, setPosition] = useState<Position>({ top: 0, left: 0 })
    const showTimerRef = useRef<number | null>(null)

    // 計算 tooltip 應該出現的座標（fixed positioning，相對 viewport）
    const updatePosition = () => {
        if (!wrapperRef.current) return
        const wrapperRect = wrapperRef.current.getBoundingClientRect()
        const tooltipEl = tooltipRef.current
        // tooltip 還沒 mount 時用估計值，之後 effect 會 reposition
        const ttW = tooltipEl?.offsetWidth ?? 100
        const ttH = tooltipEl?.offsetHeight ?? 32
        const gap = 8

        let top = 0
        let left = 0
        switch (placement) {
            case 'top':
                top = wrapperRect.top - ttH - gap
                left = wrapperRect.left + wrapperRect.width / 2 - ttW / 2
                break
            case 'bottom':
                top = wrapperRect.bottom + gap
                left = wrapperRect.left + wrapperRect.width / 2 - ttW / 2
                break
            case 'left':
                top = wrapperRect.top + wrapperRect.height / 2 - ttH / 2
                left = wrapperRect.left - ttW - gap
                break
            case 'right':
                top = wrapperRect.top + wrapperRect.height / 2 - ttH / 2
                left = wrapperRect.right + gap
                break
        }

        // viewport 邊界保護：避免 tooltip 跑出畫面
        const vw = window.innerWidth
        const vh = window.innerHeight
        if (left < 4) left = 4
        if (left + ttW > vw - 4) left = vw - ttW - 4
        if (top < 4) top = 4
        if (top + ttH > vh - 4) top = vh - ttH - 4

        setPosition({ top, left })
    }

    const handleEnter = () => {
        if (delay > 0) {
            showTimerRef.current = window.setTimeout(() => {
                setIsVisible(true)
            }, delay)
        } else {
            setIsVisible(true)
        }
    }
    const handleLeave = () => {
        if (showTimerRef.current) {
            clearTimeout(showTimerRef.current)
            showTimerRef.current = null
        }
        setIsVisible(false)
    }

    // tooltip 顯示時：第一次以估計值定位 → 量到實際大小再 reposition 一次（避免閃跳）
    useEffect(() => {
        if (!isVisible) return
        updatePosition()
        // 用 rAF 等下一幀才量，這時 tooltip 已經 mount 進 DOM 拿得到實際 size
        const raf = requestAnimationFrame(updatePosition)
        // 視窗滾動 / resize 也要跟著更新
        const onScroll = () => updatePosition()
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible, placement])

    // unmount 時清 timer
    useEffect(() => {
        return () => {
            if (showTimerRef.current) clearTimeout(showTimerRef.current)
        }
    }, [])

    return (
        <span
            ref={wrapperRef}
            className={`relative inline-flex ${className}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onFocus={handleEnter}
            onBlur={handleLeave}
        >
            {children}
            {isVisible &&
                createPortal(
                    <span
                        ref={tooltipRef}
                        role="tooltip"
                        style={{ top: position.top, left: position.left }}
                        className="pointer-events-none fixed z-[9999] max-w-[min(80vw,400px)] whitespace-pre-wrap break-words rounded-lg border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-lg"
                    >
                        {label}
                    </span>,
                    document.body,
                )}
        </span>
    )
}
