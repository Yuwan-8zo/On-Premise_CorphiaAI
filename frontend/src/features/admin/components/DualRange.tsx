/**
 * DualRange — 兩個把手的拉桿（門檻規劃器：左＝送模型複查、右＝直接攔阻）
 *   軌道分三段上色：放行／複查／攔阻（顏色和長條圖、三格數字同一組）
 *   把手是白色膠囊（和切換開關的白色旋鈕同一個樣式 .sw-veil），上面寫目前的值；拖曳或點選把手後用方向鍵調整（Shift 一次 ×5）
 *   按住拖曳時把手變成放大鏡（規範「拉桿與放大鏡」，照 iOS 亮度拉桿）：68×44 深灰霧面鏡片、底下一圈淡陰影，
 *   鏡內的軌道粗 1.25 倍、碰到鏡緣往外張到 1.6 倍，讀條停在鏡片正中間，超出軌道兩端的那一段不畫
 *   兩個把手至少隔一格（左 < 右），不能交叉
 * 尺寸讀 tokens.css 的 --dr-*、--sl-*；方向鍵的步長讀 --dr-step
 */
import { useRef, useState } from 'react'
import { readNum, readPx } from '@/lib/cssVars'
import { useLensPull } from '@/components/ui/useLensPull'

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

/** 鏡內的軌道：中間粗 t×--sl-in，兩端 --sl-flare-len 那一段沿著鏡緣張到 t×--sl-flare（上下對稱的一個形狀） */
function lensTrackPath(w: number, h: number, t: number) {
    const a = (t * (readNum('--sl-in') || 1.25)) / 2
    const b = (t * (readNum('--sl-flare') || 1.6)) / 2
    const L = w * (readNum('--sl-flare-len') || 0.16)
    const c = h / 2
    return `M0 ${c - b} C${L * 0.35} ${c - b} ${L * 0.65} ${c - a} ${L} ${c - a} L${w - L} ${c - a} C${w - L * 0.65} ${c - a} ${w - L * 0.35} ${c - b} ${w} ${c - b}`
        + ` L${w} ${c + b} C${w - L * 0.35} ${c + b} ${w - L * 0.65} ${c + a} ${w - L} ${c + a} L${L} ${c + a} C${L * 0.65} ${c + a} ${L * 0.35} ${c + b} 0 ${c + b} Z`
}

export default function DualRange({ low, high, onChange, disabled = false, lowLabel, highLabel, colors }: DualRangeProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const step = readNum('--dr-step') || 0.01
    // 正在拖曳哪一個把手（放大鏡）；軌道寬在按下時量一次
    const [active, setActive] = useState<'low' | 'high' | null>(null)
    const [trackW, setTrackW] = useState(0)
    // 拉過頭（規範「拉桿」）：拖到端點再往外拉，整條拉桿被拉長、放開彈回；端點看軌道
    const rootRef = useRef<HTMLDivElement>(null)
    const activeRef = useRef(active)
    activeRef.current = active
    useLensPull(rootRef, { axis: 'x', bounds: () => trackRef.current, active: () => activeRef.current !== null, disabled })

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

    const onPointerDown = (which: 'low' | 'high') => (e: React.PointerEvent<HTMLButtonElement>) => {
        if (disabled || e.button > 0) return
        try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
        e.currentTarget.focus()
        setTrackW(trackRef.current?.getBoundingClientRect().width ?? 0)
        setActive(which)
    }
    const onPointerEnd = () => setActive(null)
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

    const lensW = readPx('--dr-lens-w'), lensH = readPx('--dr-lens-h'), trackH = readPx('--dr-track-h')
    const lens = (v: number) => {
        // 鏡片座標 x ↔ 軌道座標：鏡片中心＝目前的值；軌道範圍外不畫
        const x0 = lensW / 2 - v * trackW
        const x1 = x0 + trackW
        const id = `dr-g-${v.toFixed(2).replace('.', '')}`
        return (
            <svg aria-hidden className="dr-mag" width={lensW} height={lensH} viewBox={`0 0 ${lensW} ${lensH}`}>
                <defs>
                    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
                        <stop offset={0} stopColor={colors.pass} />
                        <stop offset={low} stopColor={colors.pass} />
                        <stop offset={low} stopColor={colors.review} />
                        <stop offset={high} stopColor={colors.review} />
                        <stop offset={high} stopColor={colors.block} />
                        <stop offset={1} stopColor={colors.block} />
                    </linearGradient>
                    <clipPath id={`${id}-c`}><rect x={x0} y={0} width={trackW} height={lensH} /></clipPath>
                </defs>
                <path d={lensTrackPath(lensW, lensH, trackH)} fill={`url(#${id})`} clipPath={`url(#${id}-c)`} />
            </svg>
        )
    }

    const knob = (which: 'low' | 'high', v: number, label: string) => {
        const on = active === which
        return (
            <button
                type="button"
                role="slider"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={v}
                aria-valuetext={v.toFixed(2)}
                aria-disabled={disabled || undefined}
                onPointerDown={onPointerDown(which)}
                onPointerMove={onPointerMove(which)}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onKeyDown={onKeyDown(which)}
                className={`dr-knob ${on ? 'is-lens' : ''} absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center sw-veil rounded-full text-[length:var(--fs-12)] font-semibold tabular-nums text-black/85 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60`}
                style={{ left: `${v * 100}%`, cursor: disabled ? 'default' : on ? 'grabbing' : 'grab', zIndex: on ? 2 : 1 }}
            >
                <span className="dr-val">{v.toFixed(2)}</span>
                {on && trackW > 0 && lens(v)}
            </button>
        )
    }

    return (
        <div ref={rootRef} className="relative w-full" style={{ height: 'var(--dr-knob-h)' }}>
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
