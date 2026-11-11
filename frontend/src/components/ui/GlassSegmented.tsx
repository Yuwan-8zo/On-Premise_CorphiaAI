/**
 * GlassSegmented — 分段切換器（《Liquid Glass 元件規範》：分段切換器、CSS 26／34／35、JS 00）
 *
 * 平常：軌道＝控制元件玻璃＋光邊；目前項目＝凹陷底盤＋強調色文字；其他項目＝主要文字色
 * 按住：凹陷底盤就是放大鏡最上面的一層（.lens-veil），跟著鏡片長大（四邊各加 8）並淡掉，露出「凹進去」的放大鏡：
 *   - 軌道的底色與光邊在鏡片底下真的挖洞（背景模糊不挖）；鏡片本身只有 --lens-glass（底面亮 9%、兩端漸暗）
 *   - 鏡內：一份縮小的「整條軌道」（長邊 0.93、短邊 0.768，以鏡片中心為準）＋從鏡緣進來的肩，
 *     同一個容器、同一個顏色（深色＝白 6.6%：疊上鏡片的 9% 剛好等於軌道的 15%）——鏡內鏡外同一個顏色
 *   - 鏡內文字用強調色、以鏡片中心放大 1.12 倍（規範右下選單）；真正的文字在鏡片位置挖洞；亮邊只在長邊兩緣；外圈 --lens-ring
 * vertical：直的軌道（側欄收合時用）；做法相同、方向轉 90 度（規範「右下選單」：鏡片用 --lens-glass-v、肩在上下）
 * 拖曳每幀追 30%、兩端硬鎖在第一格～最後一格；鍵盤 ← →（直的用 ↑ ↓）Home End。時間表與共用工具在 lensKit.ts。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Tooltip from './Tooltip'
import { useCssPx, type PxOrVar } from '@/lib/cssVars'
import { LENS_CFG, LENS_MAG, LENS_SX, LENS_SY, capsuleHole, lensActive, shoulderMask, useLensMotion } from './lensKit'

export interface SegmentOption<T extends string> {
    value: T
    label: React.ReactNode
    /** 只有圖示時給報讀軟體的名稱 */
    name?: string
}

interface Props<T extends string> {
    options: SegmentOption<T>[]
    value: T
    onChange: (value: T) => void
    className?: string
    /** 軌道內距：像素或設定名稱（預設 --seg-pad＝4） */
    pad?: PxOrVar
    /** 直的軌道 */
    vertical?: boolean
    /** 放大鏡沿長邊、垂直長邊各加多少（px）；分段切換器 8／8，浮動工具列（只有圖示）11.5／4.5 */
    growLong?: PxOrVar
    growCross?: PxOrVar
    /** 格子之間的空隙（沿長邊，px）；右下選單規格：按鈕 46、列距 53 → 空隙 7 */
    gap?: PxOrVar
    /** 純圖示的工具列：滑過每格顯示 name 的提示泡泡 */
    tooltips?: boolean
    /** 浮動工具列：整條高 52、只有圖示；按住 0.32 秒或直接左右滑，等放大鏡長大後，鏡內那一格的圖示下方才淡入 name（其他格不顯示），放開立刻收回 */
    toolbar?: boolean
    'data-tour'?: string
}

export default function GlassSegmented<T extends string>({ options, value, onChange, className = '', pad: padIn = '--seg-pad', vertical = false, growLong: growLongIn = '--lens-over', growCross: growCrossIn = '--lens-over', gap: gapIn = 0, tooltips = false, toolbar = false, ...rest }: Props<T>) {
    // 尺寸參數可以給像素或設定名稱（預設讀 tokens.css 的 --seg-pad、--lens-over），不寫死
    const sizeIn = [padIn, growLongIn, growCrossIn, gapIn]
    const px = useCssPx(sizeIn.filter((v): v is `--${string}` => typeof v === 'string'))
    const [pad, growLong, growCross, gap] = sizeIn.map((v) => (typeof v === 'string' ? px[v] : v))
    const trackRef = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const n = options.length
    const index = Math.max(0, options.findIndex((o) => o.value === value))
    const sgRef = useRef(0)

    const lens = useLensMotion(index, (a, b) => Math.abs(a - b) * sgRef.current)
    const drag = useRef<{ id: number; s: number; moved: boolean } | null>(null)
    // 工具列長大（長按成立）：定點按住 0.32 秒，或手指直接沿著列滑動就立刻成立
    const [wide, setWide] = useState(false)
    const wideTimer = useRef(0)
    useEffect(() => () => window.clearTimeout(wideTimer.current), [])

    // 外部改變選項（鍵盤、程式切換）→ 滑過去
    useEffect(() => {
        if (drag.current) return
        if (Math.abs(lens.current.current.pos - index) > 0.001) lens.glideTo(index)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index])

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

    const coord = (e: { clientX: number; clientY: number }) => (vertical ? e.clientY : e.clientX)
    // 指標位置 → 連續位置；兩端硬鎖在第一格～最後一格中心
    const posFrom = (v: number) => {
        const r = trackRef.current!.getBoundingClientRect()
        const len = vertical ? r.height : r.width
        const start = vertical ? r.top : r.left
        const sg = (len - pad * 2 - gap * (n - 1)) / n
        return Math.max(0, Math.min(n - 1, (v - start - pad - sg / 2) / (sg + gap)))
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.button > 0) return
        drag.current = { id: e.pointerId, s: coord(e), moved: false }
        try { trackRef.current?.setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
        lens.press()
        if (toolbar) {
            window.clearTimeout(wideTimer.current)
            wideTimer.current = window.setTimeout(() => setWide(true), LENS_CFG.pressWait)
        }
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        if (!d.moved && Math.abs(coord(e) - d.s) < LENS_CFG.slop) return
        d.moved = true
        if (toolbar) { window.clearTimeout(wideTimer.current); setWide(true) }
        lens.follow(posFrom(coord(e)))
    }
    const finish = (e: React.PointerEvent, commit: boolean) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        drag.current = null
        window.clearTimeout(wideTimer.current)
        setWide(false)
        lens.follow(null)
        const next = commit ? Math.round(d.moved ? lens.current.current.pos : posFrom(coord(e))) : index
        lens.glideTo(next)
        const val = options[next]?.value
        if (commit && val !== undefined && val !== value) onChange(val)
    }

    // ── 幾何：先用「長邊／短邊」算，再對應到 x、y ──
    const W = size.w, H = size.h
    const long = vertical ? H : W
    const cross = vertical ? W : H
    const rowLong = Math.max(0, long - pad * 2)
    const rowCross = Math.max(0, cross - pad * 2)
    const sg = n ? (rowLong - gap * (n - 1)) / n : 0 // 一格的大小
    const pitch = sg + gap // 相鄰兩格中心的距離
    sgRef.current = pitch
    const f = lens.frame
    const cl = pad + f.pos * pitch + sg / 2 // 鏡心在長邊上的位置
    const ll = sg + growLong * 2 * f.grow
    const lc = rowCross + growCross * 2 * f.grow
    const L = vertical ? cross / 2 - lc / 2 : cl - ll / 2
    const T = vertical ? cl - ll / 2 : cross / 2 - lc / 2
    const lw = vertical ? lc : ll
    const lh = vertical ? ll : lc
    const ready = W > 0
    const active = ready && lensActive(f)

    const LLf = sg + growLong * 2, LCf = rowCross + growCross * 2
    const sLong = 1 - (1 - LENS_SX) * f.grow
    const sCross = 1 - (1 - LENS_SY) * f.grow
    // 肩：鏡內縮小的軌道在那一側延伸到鏡片外才接上肩（底面是兩條直線）；
    // 移到最邊的格子時，縮小軌道的尾端落在鏡片裡 → 那一側的肩淡掉，底面順著軌道的圓頭彎過去
    const barStart = cl * (1 - sLong)
    const barEnd = cl + (long - cl) * sLong
    const shl = barStart < cl - ll / 2 - 0.5 ? 1 : 0
    const shr = barEnd > cl + ll / 2 + 0.5 ? 1 : 0
    // 縮小的整條軌道（以鏡片中心為準）：橫的長邊 0.93、短邊 0.768；直的方向互換
    const shrunkBar: React.CSSProperties = {
        left: -L, top: -T, width: W, height: H, borderRadius: cross / 2,
        transformOrigin: `${L + lw / 2}px ${T + lh / 2}px`,
        transform: vertical ? `scale(${sCross}, ${sLong})` : `scale(${sLong}, ${sCross})`,
    }
    const wallMask = shoulderMask(LLf, LCf, (LCf - cross) / 2, cross)
    const wallMaskV = shoulderMask(LLf, LCf, (LCf - cross) / 2, cross, true)

    const row = (ghost: boolean) =>
        options.map((o, i) => {
            const on = i === index
            const common = {
                className: `${toolbar ? 'relative' : ''} flex-1 flex items-center justify-center rounded-full text-[length:var(--fs-14)] font-semibold text-center whitespace-nowrap ${
                    ghost || (on && !active) ? 'text-accent' : 'text-text-primary'
                }`,
                style: { [vertical ? 'height' : 'width']: sg || undefined, flex: 'none', WebkitTapHighlightColor: 'transparent' } as React.CSSProperties,
            }
            const content = toolbar ? (
                <>
                    <span className="seg-ico">{o.label}</span>
                    {/* 只有放大鏡正中那一格顯示名稱 */}
                    {ghost && o.name && i === Math.round(f.pos) && <span className="seg-lab" aria-hidden="true">{o.name}</span>}
                </>
            ) : o.label
            if (ghost) return <span key={o.value} {...common}>{content}</span>
            const button = (
                <button
                    key={o.value}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-label={o.name}
                    onClick={(e) => { if (e.detail === 0 && !on) onChange(o.value) }}
                    onKeyDown={(e) => {
                        const go = (k: number) => { e.preventDefault(); const t = options[k]; if (t && k !== index) onChange(t.value) }
                        const next = vertical ? 'ArrowDown' : 'ArrowRight'
                        const prev = vertical ? 'ArrowUp' : 'ArrowLeft'
                        if (e.key === next) go(Math.min(n - 1, index + 1))
                        else if (e.key === prev) go(Math.max(0, index - 1))
                        else if (e.key === 'Home') go(0)
                        else if (e.key === 'End') go(n - 1)
                    }}
                    {...common}
                >
                    {content}
                </button>
            )
            // 長大顯示文字時不再出提示泡泡
            return tooltips && o.name ? <Tooltip key={o.value} label={wide ? '' : o.name}>{button}</Tooltip> : button
        })

    const rowW = vertical ? rowCross : rowLong
    const rowH = vertical ? rowLong : rowCross

    return (
        <div
            ref={trackRef}
            role="tablist"
            aria-orientation={vertical ? 'vertical' : 'horizontal'}
            data-tour={rest['data-tour']}
            className={`seg-track relative rounded-full select-none touch-none ${toolbar ? 'seg-tools' : ''} ${wide ? 'is-wide' : ''} ${className}`}
            style={{ padding: pad, ['--R' as string]: `${cross / 2}px` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finish(e, true)}
            onPointerCancel={(e) => finish(e, false)}
            onLostPointerCapture={(e) => finish(e, false)}
        >
            {/* 軌道的底色與光邊（放大鏡底下挖洞） */}
            <span aria-hidden="true" className="seg-blur absolute" style={active ? capsuleHole(L, T, lw, lh) : undefined} />
            <span aria-hidden="true" className="seg-bgf absolute" style={active ? capsuleHole(L, T, lw, lh) : undefined} />
            <span aria-hidden="true" className="seg-rim absolute" style={{ ['--R' as string]: `${cross / 2}px`, ...(active ? capsuleHole(L + 1, T + 1, lw, lh) /* 光邊這層四周多留 1px，座標跟著位移 */ : {}) }} />

            {/* 放大鏡（平常＝凹陷底盤） */}
            {ready && (
                <div
                    aria-hidden="true"
                    className={`lens absolute ${vertical ? 'is-v' : ''} ${active ? 'is-active' : ''}`}
                    style={{ left: L, top: T, width: lw, height: lh, borderRadius: Math.min(lw, lh) / 2, zIndex: 1 }}
                >
                    {active && (
                        <>
                                                        {vertical ? (
                                // 直的：跟橫的同一套（縮小的軌道＋肩），肩的遮罩轉 90 度；底面末端用圓弧彎進肩裡
                                <span className="lens-ink">
                                    <span className="lens-bar" style={shrunkBar} />
                                    <span className="lens-wall" style={{ opacity: f.wall, ['--lens-wall-mask' as string]: wallMaskV }}>
                                        <i className="t" style={{ opacity: shl }} />
                                        <i className="b" style={{ opacity: shr }} />
                                    </span>
                                </span>
                            ) : (
                                // 橫的：照規範，縮小的軌道（長邊 0.93、短邊 0.768）＋兩端的肩，上下露出底面
                                <span className="lens-ink">
                                    <span className="lens-bar" style={shrunkBar} />
                                    <span className="lens-wall" style={{ opacity: f.wall, ['--lens-wall-mask' as string]: wallMask }}>
                                        <i className="l" style={{ opacity: shl }} />
                                        <i className="r" style={{ opacity: shr }} />
                                    </span>
                                </span>
                            )}
                            <div
                                className={`absolute left-0 top-0 flex ${vertical ? 'flex-col' : ''} pointer-events-none`}
                                style={{ width: rowW, height: rowH, gap, transformOrigin: '0 0', transform: `translate(${lw / 2}px, ${lh / 2}px) scale(${1 + (LENS_MAG - 1) * f.grow}) translate(${-lw / 2}px, ${-lh / 2}px) translate(${pad - L}px, ${pad - T}px)` }}
                            >
                                {row(true)}
                            </div>
                            <span className="lens-dish" />
                        </>
                    )}
                    <span className="lens-veil seg-veil" style={{ opacity: f.veil }} />
                </div>
            )}

            {/* 選項（鏡片位置挖洞） */}
            <div className={`relative z-[2] flex ${vertical ? 'flex-col w-full' : ''} h-full`} style={{ gap, ...(active ? capsuleHole(L - pad, T - pad, lw, lh) : {}) }}>
                {row(false)}
            </div>
        </div>
    )
}
