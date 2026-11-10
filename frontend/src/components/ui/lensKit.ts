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
 * 在元素上挖一個膠囊形的洞（x, y, w, h＝洞在元素座標裡的位置與大小；橫的或直的膠囊都可以）。
 * 照規範：整片減掉兩個圓＋中間長方形
 */
export function capsuleHole(x: number, y: number, w: number, h: number): React.CSSProperties {
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
 * 肩的遮罩（規範 JS：maskURI）。W、H＝放大鏡長大後的寬高；o＝放大鏡比底多出去的量；barH＝底的高度。
 * 底的上緣在鏡緣上的交點是 xr；底面從 xr 再往裡 2 開始，用圓弧從「底原本的上緣」彎到「縮小後的上緣」，
 * 兩端各留一塊（寬 zw）給肩，沿鏡緣另有一條往中間消失的細線
 */
const maskCache = new Map<string, string>()
export function shoulderMask(W: number, H: number, o: number, barH: number) {
    const key = [W, H, o, barH].map((n) => n.toFixed(1)).join('x')
    const hit = maskCache.get(key)
    if (hit) return hit
    const f = (n: number) => +n.toFixed(2)
    const r = H / 2
    const xr = r - Math.sqrt(Math.max(0, r * r - (r - o) * (r - o)))
    const bandY = f(H / 2 - (barH * LENS_SY) / 2 + 0.2)
    const cs = f(xr + 2)
    const rx = f(bandY - o + 1.3)
    const zw = f(cs + rx + 3)
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${f(W * 10)}' height='${f(H * 10)}' viewBox='0 0 ${f(W)} ${f(H)}' preserveAspectRatio='none'>` +
        `<defs><linearGradient id='k'><stop offset='0' stop-opacity='0'/><stop offset='.19' stop-opacity='0'/><stop offset='.42' stop-opacity='1'/><stop offset='.58' stop-opacity='1'/><stop offset='.81' stop-opacity='0'/><stop offset='1' stop-opacity='0'/></linearGradient>` +
        `<clipPath id='c'><rect x='1.5' y='1.5' width='${f(W - 3)}' height='${f(H - 3)}' rx='${f(r - 1.5)}'/></clipPath>` +
        `<mask id='m'><rect width='${f(W)}' height='${f(H)}' fill='#000'/>` +
        `<rect x='0' y='0' width='${zw}' height='${f(H)}' fill='#fff'/><rect x='${f(W - zw)}' y='0' width='${zw}' height='${f(H)}' fill='#fff'/>` +
        `<rect x='.75' y='.75' width='${f(W - 1.5)}' height='${f(H - 1.5)}' rx='${f(r - 0.75)}' fill='none' stroke='#fff' stroke-width='1.5'/>` +
        `<g clip-path='url(#c)'><rect x='${cs}' y='-8' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}'/><rect x='${cs}' y='${f(H - bandY)}' width='${f(W - cs * 2)}' height='${f(bandY + 8)}' rx='${rx}'/></g>` +
        `<rect x='0' y='0' width='${f(W)}' height='${bandY}' fill='url(#k)'/><rect x='0' y='${f(H - bandY)}' width='${f(W)}' height='${bandY}' fill='url(#k)'/>` +
        `</mask></defs><rect width='${f(W)}' height='${f(H)}' fill='#fff' mask='url(#m)'/></svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    maskCache.set(key, url)
    return url
}

/** 切換開關的肩（規範 CSS 35 .sw-wall 原樣，68×44 的單位） */
export const SWITCH_WALL_MASK =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='680' height='440' viewBox='0 0 68 44' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='k'%3E%3Cstop offset='0' stop-opacity='0'/%3E%3Cstop offset='.19' stop-opacity='0'/%3E%3Cstop offset='.42' stop-opacity='1'/%3E%3Cstop offset='.58' stop-opacity='1'/%3E%3Cstop offset='.81' stop-opacity='0'/%3E%3Cstop offset='1' stop-opacity='0'/%3E%3C/linearGradient%3E%3CclipPath id='c'%3E%3Crect x='1.5' y='1.5' width='65' height='41' rx='20.5'/%3E%3C/clipPath%3E%3Cmask id='m'%3E%3Crect width='68' height='44' fill='%23000'/%3E%3Crect x='0' y='0' width='16' height='44' fill='%23fff'/%3E%3Crect x='52' y='0' width='16' height='44' fill='%23fff'/%3E%3Crect x='.75' y='.75' width='66.5' height='42.5' rx='21.25' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3Cg clip-path='url%28%23c%29'%3E%3Crect x='9.2' y='-6' width='49.6' height='15.75' rx='5'/%3E%3Crect x='9.2' y='34.25' width='49.6' height='15.75' rx='5'/%3E%3C/g%3E%3Crect x='0' y='0' width='68' height='9.5' fill='url%28%23k%29'/%3E%3Crect x='0' y='34.5' width='68' height='9.5' fill='url%28%23k%29'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='68' height='44' fill='%23fff' mask='url%28%23m%29'/%3E%3C/svg%3E")`

/** 直的選單放大鏡的肩（規範 CSS 35 .dock .lens .rc-wall 原樣，93×88 的單位；肩在上下） */
export const DOCK_WALL_MASK =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='930' height='880' viewBox='0 0 93 88' preserveAspectRatio='none'%3E%3Cdefs%3E%3ClinearGradient id='k' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-opacity='0'/%3E%3Cstop offset='.24' stop-opacity='0'/%3E%3Cstop offset='.44' stop-opacity='1'/%3E%3Cstop offset='.56' stop-opacity='1'/%3E%3Cstop offset='.76' stop-opacity='0'/%3E%3Cstop offset='1' stop-opacity='0'/%3E%3C/linearGradient%3E%3CclipPath id='c'%3E%3Crect x='1.5' y='1.5' width='90' height='85' rx='38.5'/%3E%3C/clipPath%3E%3Cmask id='m'%3E%3Crect width='93' height='88' fill='%23000'/%3E%3Crect x='0' y='0' width='93' height='33.5' fill='%23fff'/%3E%3Crect x='0' y='54.5' width='93' height='33.5' fill='%23fff'/%3E%3Crect x='.75' y='.75' width='91.5' height='86.5' rx='39.25' fill='none' stroke='%23fff' stroke-width='1.5'/%3E%3Cg clip-path='url%28%23c%29'%3E%3Crect x='-8' y='19.4' width='24.5' height='49.2' rx='10.8'/%3E%3Crect x='76.5' y='19.4' width='24.5' height='49.2' rx='10.8'/%3E%3C/g%3E%3Crect x='0' y='0' width='16.5' height='88' fill='url%28%23k%29'/%3E%3Crect x='76.5' y='0' width='16.5' height='88' fill='url%28%23k%29'/%3E%3C/mask%3E%3C/defs%3E%3Crect width='93' height='88' fill='%23fff' mask='url%28%23m%29'/%3E%3C/svg%3E")`

/**
 * 直的放大鏡的凹陷：鏡內整片是底色，左右各挖一條上下圓頭的「底面」（照鏡片當下的寬高直接畫，不拉伸、不轉向，沒有接縫）
 * w、h＝鏡片寬高；band＝每條底面的寬；end＝底面離鏡片上下兩端的距離（兩端留給底色接回鏡緣，等同規範的「肩」）
 */
export function sideBandMask(w: number, h: number, band: number, end: number): React.CSSProperties {
    const f = (n: number) => +n.toFixed(2)
    const b = Math.max(0, band)
    const r = Math.min(b, 6)
    const top = f(end), len = f(Math.max(0, h - end * 2))
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${f(w)}' height='${f(h)}' viewBox='0 0 ${f(w)} ${f(h)}'>` +
        `<defs><mask id='m'><rect width='${f(w)}' height='${f(h)}' fill='#fff'/>` +
        `<rect x='${f(-r)}' y='${top}' width='${f(b + r)}' height='${len}' rx='${f(r)}' fill='#000'/>` +
        `<rect x='${f(w - b)}' y='${top}' width='${f(b + r)}' height='${len}' rx='${f(r)}' fill='#000'/>` +
        `</mask></defs><rect width='${f(w)}' height='${f(h)}' fill='#fff' mask='url(#m)'/></svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    return { WebkitMaskImage: url, maskImage: url, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' } as React.CSSProperties
}
