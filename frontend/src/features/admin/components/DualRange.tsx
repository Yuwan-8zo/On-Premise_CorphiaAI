/**
 * DualRange — 兩個把手的拉桿（門檻規劃器：左＝送模型複查、右＝直接攔阻）
 *   軌道分三段上色：放行／複查／攔阻（顏色和長條圖、三格數字同一組）
 *   把手是白色膠囊（和切換開關的白色旋鈕同一個樣式 .sw-veil），上面寫目前的值；拖曳或點選把手後用方向鍵調整（Shift 一次 ×5）
 *   兩個把手至少隔一格（左 < 右），不能交叉
 * 尺寸讀 tokens.css 的 --dr-*；方向鍵的步長讀 --dr-step
 */
import { useRef } from 'react'
import { readNum } from '@/lib/cssVars'

export interface DualRangeProps {
    low: number
    high: number
    onChange: (low: number, high: number) => void
    disabled?: boolean
    lowLabel: string
    highLabel: string
    /** 三段的顏色（CSS 色彩） */
    colors: { pass: string; review: string; block: string }
}

const round2 = (v: number) => Math.round(v * 100) / 100

export default function DualRange({ low, high, onChange, disabled = false, lowLabel, highLabel, colors }: DualRangeProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const step = readNum('--dr-step') || 0.01

    const clamp = (which: 'low' | 'high', v: number) => {
        v = round2(Math.min(1, Math.max(0, v)))
        if (which === 'low') return [Math.min(v, round2(high - step)), high] as const
        return [low, Math.max(v, round2(low + step))] as const
    }
    const set = (which: 'low' | 'high', v: number) => {
        const [l, h] = clamp(which, v)
        if (l !== low || h !== high) onChange(Math.max(step, l), h)
    }

    const valueAt = (clientX: number) => {
        const r = trackRef.current?.getBoundingClientRect()
        if (!r || r.width === 0) return 0
        return (clientX - r.left) / r.width
    }

    const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled || e.button > 0) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        e.currentTarget.focus()
    }
    const onPointerMove = (which: 'low' | 'high') => (e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return
        set(which, valueAt(e.clientX))
    }
    const onKeyDown = (which: 'low' | 'high') => (e: React.KeyboardEvent) => {
        if (disabled) return
        const cur = which === 'low' ? low : high
        const d = (e.shiftKey ? 5 : 1) * step
        const next: Record<string, number> = {
            ArrowLeft: cur - d, ArrowDown: cur - d, ArrowRight: cur + d, ArrowUp: cur + d,
            Home: 0, End: 1, PageDown: cur - 10 * step, PageUp: cur + 10 * step,
        }
        if (!(e.key in next)) return
        e.preventDefault()
        set(which, next[e.key])
    }

    const knob = (which: 'low' | 'high', v: number, label: string) => (
        <button
            type="button"
            role="slider"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={v}
            aria-valuetext={v.toFixed(2)}
            aria-disabled={disabled || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove(which)}
            onKeyDown={onKeyDown(which)}
            className="dr-knob absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center sw-veil rounded-full text-[length:var(--fs-12)] font-semibold tabular-nums text-black/85 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            style={{ left: `${v * 100}%`, width: 'var(--dr-knob-w)', height: 'var(--dr-knob-h)', cursor: disabled ? 'default' : 'grab' }}
        >
            {v.toFixed(2)}
        </button>
    )

    return (
        <div className="relative w-full" style={{ height: 'var(--dr-knob-h)' }}>
            <div
                ref={trackRef}
                aria-hidden
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full flex"
                style={{ height: 'var(--dr-track-h)' }}
            >
                <span style={{ width: `${low * 100}%`, background: colors.pass }} />
                <span style={{ width: `${(high - low) * 100}%`, background: colors.review }} />
                <span className="flex-1" style={{ background: colors.block }} />
            </div>
            {knob('low', low, lowLabel)}
            {knob('high', high, highLabel)}
        </div>
    )
}
