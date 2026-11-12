/**
 * GlassNav — 直向的分段切換器（側欄導覽用；《Liquid Glass 元件規範》：分段切換器、CSS 26／34／35、JS 00）
 *
 * 和 GlassSegmented 同一套做法，只是方向改成上下：
 *   平常：目前項目＝凹陷底盤（--well＋內凹陰影）＋強調色；其他項目＝次要文字色
 *   按下：底盤立刻變成「凹進去」的玻璃放大鏡（四邊各加 8、圓角＝高度一半），
 *         鏡內是一份縮小的底（寬 0.93、高 0.768），文字用強調色；底下真正的文字在鏡片位置挖洞
 *   拖曳：上下拖，每幀追上手指 30%；兩端硬鎖在第一項～最後一項
 *   點一下／放開：邊長大邊滑過去，時間依行程距離由 lensKit 的 glideProfile 決定（短行程用開關、長行程用分頁列的時間表），
 *         底盤 0.03 秒後蓋回、0.12 秒蓋滿
 *   鍵盤：↑ ↓ Home End；「減少動態效果」時直接切換
 * 項目樣式用 snow.css 的 .nav-item（小尺寸加 .nav-item-sm）。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LENS_CFG, LENS_MAG, capsuleHole, lensActive, useLensMotion } from './lensKit'
import { swallowNextClick } from '@/lib/swallowClick'
import { useCssPx, type PxOrVar } from '@/lib/cssVars'

export interface GlassNavItem<T extends string> {
    id: T
    label: React.ReactNode
    icon?: React.ReactNode
}

interface Props<T extends string> {
    items: GlassNavItem<T>[]
    value: T
    /** 點一下就會呼叫（即使點的是目前項目，方便手機版切到內容頁） */
    onChange: (id: T) => void
    /** 項目之間的間距：像素或設定名稱（預設 --nav-gap） */
    gap?: PxOrVar
    size?: 'md' | 'sm'
    className?: string
    'aria-label'?: string
}


type Box = { top: number; h: number }

export default function GlassNav<T extends string>({ items, value, onChange, gap: gapIn = '--nav-gap', size = 'md', className = '', 'aria-label': ariaLabel }: Props<T>) {
    // 尺寸讀設定：項目間距、放大鏡比列多出去的量（--lens-over）
    const px = useCssPx(typeof gapIn === 'string' ? [gapIn, '--lens-over'] : ['--lens-over'])
    const gap = typeof gapIn === 'string' ? px[gapIn] : gapIn
    const GROW_PX = px['--lens-over']
    const listRef = useRef<HTMLDivElement | null>(null)
    const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
    const [geo, setGeo] = useState<{ w: number; boxes: Box[] }>({ w: 0, boxes: [] })
    const geoRef = useRef(geo)
    geoRef.current = geo
    const n = items.length
    const index = Math.max(0, items.findIndex((it) => it.id === value))

    const drag = useRef<{ id: number; sy: number; moved: boolean } | null>(null)

    // 連續位置 → 中心 y 與高度（相鄰兩項之間線性內插，間距也算進去）
    const at = (pos: number, boxes = geoRef.current.boxes) => {
        if (!boxes.length) return { cy: 0, h: 0 }
        const i = Math.max(0, Math.min(boxes.length - 1, Math.floor(pos)))
        const j = Math.min(boxes.length - 1, i + 1)
        const f = Math.max(0, Math.min(1, pos - i))
        const a = boxes[i], b = boxes[j]
        return { cy: a.top + a.h / 2 + (b.top + b.h / 2 - a.top - a.h / 2) * f, h: a.h + (b.h - a.h) * f }
    }
    const posFromY = (clientY: number) => {
        const boxes = geoRef.current.boxes
        const r = listRef.current!.getBoundingClientRect()
        const y = clientY - r.top
        const c = boxes.map((b) => b.top + b.h / 2)
        if (y <= c[0]) return 0
        for (let i = 0; i < c.length - 1; i++) if (y <= c[i + 1]) return i + (y - c[i]) / (c[i + 1] - c[i])
        return n - 1
    }

    const lens = useLensMotion(index, (a, b) => Math.abs(at(b).cy - at(a).cy))

    useEffect(() => {
        if (drag.current) return
        if (Math.abs(lens.current.current.pos - index) > 0.001) lens.glideTo(index)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index])

    // 量每一項的位置
    useLayoutEffect(() => {
        const el = listRef.current
        if (!el) return
        const measure = () =>
            setGeo({
                w: el.offsetWidth,
                boxes: btnRefs.current.slice(0, n).map((b) => ({ top: b?.offsetTop ?? 0, h: b?.offsetHeight ?? 0 })),
            })
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [n])

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.button > 0) return
        drag.current = { id: e.pointerId, sy: e.clientY, moved: false }
        try { listRef.current?.setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
        lens.press()
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        if (!d.moved && Math.abs(e.clientY - d.sy) < LENS_CFG.slop) return
        d.moved = true
        lens.follow(posFromY(e.clientY))
    }
    const finish = (e: React.PointerEvent, commit: boolean) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        drag.current = null
        lens.follow(null)
        const next = commit ? Math.round(d.moved ? lens.current.current.pos : posFromY(e.clientY)) : index
        lens.glideTo(next)
        const it = items[next]
        if (commit && it) {
            onChange(it.id)
            // 手機設定：切到內容頁後，同一下的 click 不能落到新頁面上（會誤按到「日本語」之類的選項）
            swallowNextClick()
        }
    }

    // ── 幾何 ──
    const f = lens.frame
    const ready = geo.w > 0 && geo.boxes.length === n && geo.boxes.some((b) => b.h > 0)
    const { cy, h: rowH } = at(f.pos)
    const rowW = geo.w
    const lw = rowW + GROW_PX * 2 * f.grow
    const lh = rowH + GROW_PX * 2 * f.grow
    const L = rowW / 2 - lw / 2
    const T = cy - lh / 2
    const active = ready && lensActive(f)
    const listH = geo.boxes.length ? geo.boxes[n - 1].top + geo.boxes[n - 1].h : 0

    const itemClass = `nav-item ${size === 'sm' ? 'nav-item-sm' : ''}`
    const content = (it: GlassNavItem<T>) => (
        <>
            {it.icon && <span className="nav-item-icon">{it.icon}</span>}
            <span>{it.label}</span>
        </>
    )

    return (
        <div
            ref={listRef}
            role="tablist"
            aria-orientation="vertical"
            aria-label={ariaLabel}
            className={`glass-nav relative select-none touch-none ${className}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
            onLostPointerCapture={(e) => finish(e, false)}
        >
            {/* 放大鏡（平常＝凹陷底盤）：橫膠囊直向滑動，列沒有軌道，所以鏡內不畫縮小的底，只有鏡片玻璃＋強調色文字 */}
            {ready && (
                <div aria-hidden="true" className={`lens absolute ${active ? 'is-active' : ''}`} style={{ left: L, top: T, width: lw, height: lh, borderRadius: lh / 2, zIndex: 1 }}>
                    {active && (
                        <>
                            <div className="absolute left-0 top-0 flex flex-col pointer-events-none" style={{ width: rowW, height: listH, gap, transformOrigin: '0 0', transform: `translate(${lw / 2}px, ${lh / 2}px) scale(${1 + (LENS_MAG - 1) * f.grow}) translate(${-lw / 2}px, ${-lh / 2}px) translate(${-L}px, ${-T}px)` }}>
                                {items.map((it) => (
                                    <span key={it.id} className={`${itemClass} is-current`}>{content(it)}</span>
                                ))}
                            </div>
                            <span className="lens-dish" />
                        </>
                    )}
                    <span className="lens-veil seg-veil" style={{ opacity: f.veil }} />
                </div>
            )}

            {/* 真正的項目（鏡片位置挖洞） */}
            <div className="relative z-[2] flex flex-col" style={{ gap, ...(active ? capsuleHole(L, T, lw, lh) : {}) }}>
                {items.map((it, i) => {
                    const on = i === index
                    return (
                        <button
                            key={it.id}
                            ref={(el) => { btnRefs.current[i] = el }}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={(e) => { if (e.detail === 0) onChange(it.id) }}
                            onKeyDown={(e) => {
                                const go = (k: number) => { e.preventDefault(); const t = items[k]; if (t) { onChange(t.id); btnRefs.current[k]?.focus() } }
                                if (e.key === 'ArrowDown') go(Math.min(n - 1, index + 1))
                                else if (e.key === 'ArrowUp') go(Math.max(0, index - 1))
                                else if (e.key === 'Home') go(0)
                                else if (e.key === 'End') go(n - 1)
                            }}
                            className={`${itemClass} ${on && !active ? 'is-current' : ''}`}
                        >
                            {content(it)}
                        </button>
                    )
                })}
            </div>

        </div>
    )
}
