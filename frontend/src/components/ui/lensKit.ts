/**
 * lensKit — 「凹進去的放大鏡」共用工具（《Liquid Glass 元件規範》CSS 35、JS 00）
 * 用在 GlassSegmented（分段切換器）、GlassNav（直向分段＝側欄）、GlassSwitch（切換開關）。
 *
 * 構造（每個元件都一樣，只有尺寸和方向不同）：
 *   底（軌道／列）：顏色畫在裡面一層，放大鏡底下「真的挖洞」（capsuleHole）
 *   放大鏡：鏡片玻璃 --lens-glass（底面亮 9%、兩端漸暗，不另外補實色）
 *     鏡內：縮小的底（長邊 0.93、短邊 0.768，以鏡片中心為準）＋從鏡緣進來的肩（shoulderMask），同一個容器、同一個顏色
 *     亮邊（只在長邊兩緣）；外圈 --lens-ring
 *     最上層＝平常的樣子（凹陷底盤／白色旋鈕），跟著鏡片一起長大、按下淡掉、縮回時再蓋回
 * 時間表（按下、點一下切換、放開共用）：
 *   按下 0.12 秒長大、平常的樣子 0.1 秒淡掉；拖曳每幀追 30%
 *   滑過去 0.32 秒＋每 1px 0.7 毫秒（最長 0.54 秒），前 0.1 秒等速走六成；過一半開始 0.28 秒縮回（梯形）；
 *   平常的樣子 0.03 秒後開始、0.12 秒蓋滿；肩 0.2 秒淡掉
 */
import { useEffect, useRef, useState } from 'react'

export const LENS_SX = 0.93
export const LENS_SY = 0.768
/** 鏡內內容（文字、圖示）放大倍率：規範右下選單「鏡內圖示放大 1.12 倍」，跟著放大鏡一起長大、縮回 */
export const LENS_MAG = 1.12
const GROW_MS = 120
const VEIL_OUT_MS = 100
const SHRINK_MS = 280
const VEIL_WAIT_MS = 30
const VEIL_IN_MS = 120
const WALL_OUT_MS = 200

type Anim = { from: number; to: number; t0: number; dur: number; ease: (x: number) => number } | null
type Key = 'pos' | 'grow' | 'veil' | 'wall'
export type LensFrame = Record<Key, number>

const easeGrow = (x: number) => 1 - Math.pow(1 - x, 3) // ≈ cubic-bezier(.2,.7,.3,1)
const easeTrap = (x: number) => x * x * (3 - 2 * x)
const linear = (x: number) => x
const glideEase = (T: number) => (u: number) => {
    const a = Math.min(0.9, 100 / T)
    if (u <= a) return (0.6 * u) / a
    const w = (u - a) / (1 - a)
    return 0.6 + 0.4 * (1 - Math.pow(1 - w, 2.2))
}
export const reduceMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * 放大鏡的時間表。pos＝位置（元件自己定義單位），grow＝0 平常～1 放大鏡，veil＝平常的樣子不透明度，wall＝肩的不透明度
 * distPx(a, b)：兩個位置之間的像素距離（算滑動時間用）
 */
export function useLensMotion(initial: number, distPx: (a: number, b: number) => number) {
    const [frame, setFrame] = useState<LensFrame>({ pos: initial, grow: 0, veil: 1, wall: 0 })
    const v = useRef<LensFrame>({ pos: initial, grow: 0, veil: 1, wall: 0 })
    const anim = useRef<Record<Key, Anim>>({ pos: null, grow: null, veil: null, wall: null })
    const follow = useRef<number | null>(null)
    const held = useRef(false)
    const raf = useRef(0)
    const timer = useRef(0 as unknown as ReturnType<typeof setTimeout>)
    const dist = useRef(distPx)
    dist.current = distPx

    const step = (now: number) => {
        let busy = false
        for (const k of ['pos', 'grow', 'veil', 'wall'] as const) {
            const an = anim.current[k]
            if (!an) continue
            if (now < an.t0) { busy = true; continue }
            const u = Math.min(1, (now - an.t0) / an.dur)
            v.current[k] = an.from + (an.to - an.from) * an.ease(u)
            if (u >= 1) anim.current[k] = null
            else busy = true
        }
        if (follow.current !== null) {
            v.current.pos += (follow.current - v.current.pos) * 0.3
            busy = true
        }
        setFrame({ ...v.current })
        raf.current = busy ? requestAnimationFrame(step) : 0
    }
    const run = () => { if (!raf.current) raf.current = requestAnimationFrame(step) }
    const animate = (k: Key, to: number, dur: number, ease: (x: number) => number, delay = 0) => {
        anim.current[k] = { from: v.current[k], to, t0: performance.now() + delay, dur: Math.max(1, dur), ease }
        run()
    }
    const jump = (pos: number) => {
        clearTimeout(timer.current)
        anim.current = { pos: null, grow: null, veil: null, wall: null }
        follow.current = null
        v.current = { pos, grow: 0, veil: 1, wall: 0 }
        setFrame({ ...v.current })
    }

    useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(timer.current) }, [])

    return {
        frame,
        current: v,
        /** 按下：放大鏡長大、平常的樣子淡掉、肩出現 */
        press() {
            held.current = true
            clearTimeout(timer.current)
            if (reduceMotion()) return
            anim.current.pos = null
            anim.current.wall = null
            v.current.wall = 1
            animate('grow', 1, GROW_MS, easeGrow)
            animate('veil', 0, VEIL_OUT_MS, linear)
        },
        /** 拖曳：位置每幀追上目標 30%；null＝停止跟手 */
        follow(target: number | null) {
            follow.current = reduceMotion() ? null : target
            if (target !== null && reduceMotion()) { v.current.pos = target; setFrame({ ...v.current }) }
            run()
        },
        /** 點一下切換／放開吸附：邊長大邊滑，過一半開始縮回 */
        glideTo(to: number) {
            held.current = false
            follow.current = null
            clearTimeout(timer.current)
            if (reduceMotion()) { jump(to); return }
            const T = Math.min(320 + 0.7 * dist.current(v.current.pos, to), 540)
            animate('pos', to, T, glideEase(T))
            if (v.current.grow < 1) { animate('grow', 1, GROW_MS, easeGrow); v.current.wall = 1; anim.current.wall = null }
            if (v.current.veil > 0) animate('veil', 0, VEIL_OUT_MS, linear)
            timer.current = setTimeout(() => {
                if (held.current) return
                animate('grow', 0, SHRINK_MS, easeTrap)
                animate('veil', 1, VEIL_IN_MS, linear, VEIL_WAIT_MS)
                animate('wall', 0, WALL_OUT_MS, linear)
            }, T / 2)
        },
        jump,
    }
}

/** 放大鏡是否在作用中（按住、滑動或縮回中）；平常只顯示凹陷底盤／白色旋鈕 */
export const lensActive = (f: LensFrame) => f.grow > 0.001 || f.veil < 0.999

/**
 * 接縫規則：洞一律比鏡片「內縮」HOLE_INSET（1px），讓鏡片蓋住洞的邊緣。
 * 洞和鏡片一樣大時，兩邊的邊緣各只蓋到半個像素，中間會透出後面的顏色，變成一圈隱約的黑線。
 */
export const HOLE_INSET = 1

/**
 * 在元素上挖一個膠囊形的洞（x, y, w, h＝鏡片在元素座標裡的位置與大小；橫的或直的膠囊都可以），自動內縮 HOLE_INSET。
 * 照規範：整片減掉兩個圓＋中間長方形
 */
export function capsuleHole(x0: number, y0: number, w0: number, h0: number): React.CSSProperties {
    const x = x0 + HOLE_INSET, y = y0 + HOLE_INSET, w = Math.max(0, w0 - HOLE_INSET * 2), h = Math.max(0, h0 - HOLE_INSET * 2)
    const r = Math.min(h, w) / 2
    const vertical = h > w
    const [c1x, c1y, c2x, c2y] = vertical ? [x + w / 2, y + r, x + w / 2, y + h - r] : [x + r, y + h / 2, x + w - r, y + h / 2]
    const [rw, rh, rx, ry] = vertical ? [w, Math.max(0, h - 2 * r), x, y + r] : [Math.max(0, w - 2 * r), h, x + r, y]
    const img =
        `linear-gradient(#000 0 0), ` +
        `radial-gradient(circle at ${c1x}px ${c1y}px, #000 ${r - 0.5}px, transparent ${r}px), ` +
        `radial-gradient(circle at ${c2x}px ${c2y}px, #000 ${r - 0.5}px, transparent ${r}px), ` +
        `linear-gradient(#000 0 0)`
    const size = `100% 100%, 100% 100%, 100% 100%, ${rw}px ${rh}px`
    const pos = `0 0, 0 0, 0 0, ${rx}px ${ry}px`
    return {
        WebkitMaskImage: img,
        WebkitMaskSize: size,
        WebkitMaskPosition: pos,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskComposite: 'source-out, source-over, source-over',
        maskImage: img,
        maskSize: size,
        maskPosition: pos,
        maskRepeat: 'no-repeat',
        maskComposite: 'subtract, add, add',
    } as React.CSSProperties
}

/**
 * 在元素上挖一個圓角方形的洞（x, y, w, h＝鏡片的位置與大小，r＝鏡片圓角），自動內縮 HOLE_INSET（圓角同心縮小）。
 * 整片減掉四個角的圓＋橫、直兩塊長方形
 */
export function roundRectHole(x0: number, y0: number, w0: number, h0: number, r0: number): React.CSSProperties {
    const x = x0 + HOLE_INSET, y = y0 + HOLE_INSET, w = Math.max(0, w0 - HOLE_INSET * 2), h = Math.max(0, h0 - HOLE_INSET * 2)
    const R = Math.min(r0 - HOLE_INSET, w / 2, h / 2)
    const circle = (cx: number, cy: number) => `radial-gradient(circle at ${cx}px ${cy}px, #000 ${R - 0.5}px, transparent ${R}px)`
    const layers = [
        'linear-gradient(#000 0 0)',
        circle(x + R, y + R), circle(x + w - R, y + R), circle(x + R, y + h - R), circle(x + w - R, y + h - R),
        'linear-gradient(#000 0 0)', 'linear-gradient(#000 0 0)',
    ]
    const size = ['100% 100%', '100% 100%', '100% 100%', '100% 100%', '100% 100%', `${Math.max(0, w - 2 * R)}px ${h}px`, `${w}px ${Math.max(0, h - 2 * R)}px`].join(', ')
    const pos = ['0 0', '0 0', '0 0', '0 0', '0 0', `${x + R}px ${y}px`, `${x}px ${y + R}px`].join(', ')
    const img = layers.join(', ')
    return {
        WebkitMaskImage: img,
        WebkitMaskSize: size,
        WebkitMaskPosition: pos,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskComposite: 'source-out, source-over, source-over, source-over, source-over, source-over',
        maskImage: img,
        maskSize: size,
        maskPosition: pos,
        maskRepeat: 'no-repeat',
        maskComposite: 'subtract, add, add, add, add, add',
    } as React.CSSProperties
}

/**
 * 肩的遮罩（規範 JS：maskURI）。W、H＝放大鏡長大後的寬高；o＝放大鏡比底多出去的量；barH＝底的高度。
 * 底的上緣在鏡緣上的交點是 xr；底面從 xr 再往裡 2 開始，用圓弧從「底原本的上緣」彎到「縮小後的上緣」，兩端各留一塊（寬 zw）給肩。
 * 接縫規則：肩是單一形狀（整片減掉上下兩條底面），不另外畫沿鏡緣的細線、不疊漸層——
 * 規範 maskURI 原本那條「往中間消失的細線」會和縮小的底交界，在底面兩端留下隱約的線（違反「鏡內不疊線」）
 */
const maskCache = new Map<string, string>()
/** vertical＝直的放大鏡：W、H 仍是「長邊、短邊」，畫好後整組轉 90 度，輸出寬 H、高 W 的遮罩；rad＝鏡片圓角（預設膠囊 H/2） */
export function shoulderMask(W: number, H: number, o: number, barH: number, vertical = false, rad?: number) {
    const key = [W, H, o, barH, rad ?? 0].map((n) => n.toFixed(1)).join('x') + (vertical ? 'v' : '')
    const hit = maskCache.get(key)
    if (hit) return hit
    const f = (n: number) => +n.toFixed(2)
    const r = rad ?? H / 2
    const xr = r - Math.sqrt(Math.max(0, r * r - (r - o) * (r - o)))
    const bandY = f(H / 2 - (barH * LENS_SY) / 2 + 0.2)
    const cs = f(xr + 2)
    const rx = f(bandY - o + 1.3)
    const [vw, vh] = vertical ? [H, W] : [W, H]
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${f(vw * 10)}' height='${f(vh * 10)}' viewBox='0 0 ${f(vw)} ${f(vh)}' preserveAspectRatio='none'>` +
        `<defs><mask id='m'><rect width='${f(W)}' height='${f(H)}' fill='#fff'/>` +
        `<rect x='${cs}' y='-8' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}' fill='#000'/><rect x='${cs}' y='${f(H - bandY)}' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}' fill='#000'/>` +
        `</mask></defs><g${vertical ? ` transform='translate(${f(H)} 0) rotate(90)'` : ''}><rect width='${f(W)}' height='${f(H)}' fill='#fff' mask='url(#m)'/></g></svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    maskCache.set(key, url)
    return url
}

