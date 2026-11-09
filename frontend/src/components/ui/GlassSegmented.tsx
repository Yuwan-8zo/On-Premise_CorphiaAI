/**
 * GlassSegmented — 分段切換（照「北海道雪見六日」範本第 6 區 Dock 放大鏡 .lens 的做法）
 *
 * 範本規格（design.js moveLens／drawLens）：
 *   - 放大鏡中心限制在「第一個選項中心 ～ 最後一個選項中心」之間，只允許多出的半邊溢出軌道
 *   - 每幀追手指 30%（cur += (t - cur) * 0.3），放開吸附到最近的選項
 *   - 放大鏡裡有一份選項文字的複本（ghost），用選取色、放大 1.12 倍，
 *     並反向位移讓文字和底下對齊 → 字色跟著放大鏡走
 *   - 底下真正的文字在放大鏡位置挖洞（mask xor），不會重影
 *   - 靜止：白色滑塊；按住：滑塊長大（寬 ×1.12、高 ×1.3）並變成玻璃
 * 放大用「改變實際尺寸」而不是 CSS scale：scale 會把位移量一起放大，越往右偏越多。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface SegmentOption<T extends string> {
    value: T
    label: React.ReactNode
}

interface Props<T extends string> {
    options: SegmentOption<T>[]
    value: T
    onChange: (value: T) => void
    className?: string
    /** 軌道內距（px） */
    pad?: number
    'data-tour'?: string
}

const GROW_X = 1.12
const GROW_Y = 1.3
const MAG = 1.12

export default function GlassSegmented<T extends string>({ options, value, onChange, className = '', pad = 4, ...rest }: Props<T>) {
    const trackRef = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [pressed, setPressed] = useState(false)
    const n = options.length
    const index = Math.max(0, options.findIndex((o) => o.value === value))

    // 位置（0 ~ n-1 連續值）與放大程度（0 靜止 ~ 1 按住）都由同一個每幀迴圈驅動，
    // 外框與裡面的文字複本永遠同一幀更新，不會錯位
    const [frame, setFrame] = useState({ pos: index, grow: 0 })
    const cur = useRef({ pos: index, grow: 0 })
    const goal = useRef({ pos: index, grow: 0 })
    const raf = useRef(0)
    const running = useRef(false)
    const pointer = useRef<{ id: number; sx: number; moved: boolean } | null>(null)

    const tick = () => {
        const c = cur.current, g = goal.current
        c.pos += (g.pos - c.pos) * 0.3
        c.grow += (g.grow - c.grow) * 0.3
        const done = Math.abs(g.pos - c.pos) < 0.002 && Math.abs(g.grow - c.grow) < 0.002
        if (done) { c.pos = g.pos; c.grow = g.grow }
        setFrame({ pos: c.pos, grow: c.grow })
        if (done && !pointer.current) { running.current = false; return }
        raf.current = requestAnimationFrame(tick)
    }
    const kick = () => {
        if (running.current) return
        running.current = true
        raf.current = requestAnimationFrame(tick)
    }

    useEffect(() => () => { cancelAnimationFrame(raf.current); running.current = false }, [])

    // 外部改變選項（鍵盤、程式切換）→ 滑過去
    useEffect(() => {
        if (pointer.current) return
        goal.current.pos = index
        kick()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index])

    // 量軌道尺寸（放大鏡的位置、挖洞都用像素算）
    useLayoutEffect(() => {
        const el = trackRef.current
        if (!el) return
        const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // 指標的 x → 連續位置；限制在第一格～最後一格中心之間（範本 top/bot 限制）
    const posFromX = (x: number) => {
        const r = trackRef.current!.getBoundingClientRect()
        const sg = (r.width - pad * 2) / n
        const p = (x - r.left - pad - sg / 2) / sg
        return Math.max(0, Math.min(n - 1, p))
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.button > 0) return
        pointer.current = { id: e.pointerId, sx: e.clientX, moved: false }
        try { trackRef.current?.setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
        setPressed(true)
        goal.current.grow = 1
        kick()
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const p = pointer.current
        if (!p || p.id !== e.pointerId) return
        if (!p.moved && Math.abs(e.clientX - p.sx) < 6) return
        p.moved = true
        goal.current.pos = posFromX(e.clientX)
    }

    const finish = (e: React.PointerEvent, commit: boolean) => {
        const p = pointer.current
        if (!p || p.id !== e.pointerId) return
        pointer.current = null
        setPressed(false)
        goal.current.grow = 0
        // 拖動 → 吸附到最近；輕點 → 點到的那一格；取消 → 回原位
        const next = commit ? Math.round(p.moved ? goal.current.pos : posFromX(e.clientX)) : index
        goal.current.pos = next
        kick()
        const v = options[next]?.value
        if (commit && v !== undefined && v !== value) onChange(v)
    }

    // ── 幾何（像素，相對軌道左上角）──
    const rowW = Math.max(0, size.w - pad * 2)
    const rowH = Math.max(0, size.h - pad * 2)
    const seg = n ? rowW / n : 0
    const { pos, grow } = frame
    const cx = pad + (pos + 0.5) * seg
    const cy = size.h / 2
    const lw = seg * (1 + (GROW_X - 1) * grow)
    const lh = rowH * (1 + (GROW_Y - 1) * grow)
    const L = cx - lw / 2
    const T = cy - lh / 2
    const sc = 1 + (MAG - 1) * grow
    const ready = size.w > 0

    // 選項列（真的文字與放大鏡裡的複本共用同一份排版）
    const row = (ghost: boolean) =>
        options.map((o, i) => {
            const active = i === index
            const common = {
                className: `flex-1 flex items-center justify-center rounded-full text-[14px] font-semibold text-center ${
                    ghost ? 'text-text-primary' : 'text-text-secondary'
                }`,
                style: { width: seg || undefined, WebkitTapHighlightColor: 'transparent' } as React.CSSProperties,
            }
            if (ghost) return <span key={o.value} {...common}>{o.label}</span>
            return (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={(e) => {
                        // 指標操作已在 pointerup 處理；這裡只處理鍵盤（Enter／空白鍵）
                        if (e.detail === 0 && !active) onChange(o.value)
                    }}
                    {...common}
                >
                    {o.label}
                </button>
            )
        })

    // 真文字在放大鏡位置挖洞（只顯示放大鏡裡那份，不重影）
    const hole = ready
        ? {
              WebkitMaskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
              WebkitMaskSize: `100% 100%, ${lw}px ${lh}px`,
              WebkitMaskPosition: `0 0, ${L - pad}px ${T - pad}px`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskComposite: 'xor',
              maskImage: 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
              maskSize: `100% 100%, ${lw}px ${lh}px`,
              maskPosition: `0 0, ${L - pad}px ${T - pad}px`,
              maskRepeat: 'no-repeat',
              maskComposite: 'exclude',
          } as React.CSSProperties
        : undefined

    return (
        <div
            ref={trackRef}
            role="tablist"
            data-tour={rest['data-tour']}
            className={`seg-track relative rounded-full select-none touch-none ${className}`}
            style={{ padding: pad }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
            onLostPointerCapture={(e) => finish(e, false)}
        >
            {/* 底下真正的選項（未選取色），放大鏡位置挖洞 */}
            <div className="relative z-[2] flex h-full" style={hole}>
                {row(false)}
            </div>

            {/* 放大鏡／滑塊 */}
            {ready && (
                <div
                    aria-hidden="true"
                    className={`seg-knob overflow-hidden ${pressed ? 'is-pressed' : ''}`}
                    style={{ left: L, top: T, width: lw, height: lh, zIndex: 3 }}
                >
                    {/* 放大鏡裡的那份選項：選取色、放大 1.12，反向位移讓文字跟著放大鏡走 */}
                    <div
                        className="absolute left-0 top-0 flex pointer-events-none"
                        style={{
                            width: rowW,
                            height: rowH,
                            transformOrigin: '0 0',
                            transform:
                                `translate(${lw / 2}px, ${lh / 2}px) scale(${sc}) translate(${-lw / 2}px, ${-lh / 2}px) ` +
                                `translate(${pad - L}px, ${pad - T}px)`,
                        }}
                    >
                        {row(true)}
                    </div>
                </div>
            )}
        </div>
    )
}
