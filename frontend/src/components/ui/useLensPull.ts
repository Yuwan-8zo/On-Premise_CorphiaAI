/**
 * useLensPull — 放大鏡拉過頭的回彈（《Liquid Glass 元件規範》CSS 64／JS 19「拉桿拉過頭」，所有放大鏡共用）
 *
 *   按住放大鏡拖到端點，再往外拉：
 *     整個元件往手指那邊移 pullShare（36%），靠手指那一端再被拉長其餘的量（64%）→ 那一端剛好跟到被拉的距離；
 *     拉的距離有阻尼（越拉越拉不動，最多 pullMax），放開後 pullBack 彈回。
 *   數值都在 LENS_CFG（lensKit）。橫的（分段切換器、切換開關、拉桿）沿 x，直的（右上選單、彈出選單、清單、側欄導覽）沿 y。
 *
 *   做法：拉長用 scale、移動用 translate（獨立屬性，不碰元件自己的 transform／transition／transform-origin）；
 *   縮放中心是元件中心，所以另外補一段位移：遠端只跟著整列移動，拉長的量全部落在近端。彈回用 Web Animations，不改元件的 transition。
 */
import { useEffect, useRef, type RefObject } from 'react'
import { LENS_CFG } from './lensKit'
import { prefersReducedMotion } from '@/lib/reducedMotion'

/** 阻尼：超出 over（px）時實際被拉多遠；越拉越拉不動，最多 max */
export function pullDamp(over: number, max: number = LENS_CFG.pullMax): number {
    return over > 0 ? max * (1 - 1 / (1 + over / max)) : 0
}

/**
 * 拉過頭的變形（沿拉動方向）。
 *   pos＝手指位置；lo、hi＝元件兩端；o＝元件的縮放中心
 *   回傳 s（沿這個方向的縮放）、t（位移）；沒超出時 s＝1、t＝0
 */
export function pullTransform(pos: number, lo: number, hi: number, o: number): { s: number; t: number } {
    // 超出多少：往前端是負的、往後端是正的
    let d = 0
    if (pos < lo) d = pos - lo
    else if (pos > hi) d = pos - hi
    const len = hi - lo
    if (!d || len <= 0) return { s: 1, t: 0 }
    const sign = Math.sign(d)
    const p = pullDamp(Math.abs(d))
    const far = sign > 0 ? lo : hi
    const s = 1 + (p * (1 - LENS_CFG.pullShare)) / len
    // (far − o)(1 − s)：縮放後把遠端拉回原位（拉長全在近端）；再整個往手指那邊移 pullShare
    return { s, t: (far - o) * (1 - s) + sign * p * LENS_CFG.pullShare }
}

interface PullOptions {
    /** 拉動方向（可以給函式：例如彈出選單按下後才知道是直排還是橫排） */
    axis: 'x' | 'y' | (() => 'x' | 'y')
    /** 現在放大鏡是不是在跟手（例如長按才出現的清單放大鏡）；沒給＝按住就算 */
    active?: () => boolean
    /** 用哪個元素的兩端判斷「拉過頭」；沒給＝被變形的元素本身（例如右上選單：變形外層、端點看展開的外殼） */
    bounds?: () => HTMLElement | null
    disabled?: boolean
}

const EASE_FALLBACK = 'cubic-bezier(0.32, 0.72, 0, 1)'

export function useLensPull(ref: RefObject<HTMLElement | null>, opts: PullOptions) {
    const optsRef = useRef(opts)
    optsRef.current = opts

    useEffect(() => {
        const el = ref.current
        if (!el) return
        let pid: number | null = null
        let lo = 0
        let hi = 0
        let o = 0
        let cur: { s: number; t: number } | null = null
        let anim: Animation | null = null

        const axisNow = () => { const a = optsRef.current.axis; return typeof a === 'function' ? a() : a }
        const fmt = (v: { s: number; t: number }) => (axisNow() === 'x'
            ? { translate: `${v.t}px 0px`, scale: `${v.s} 1` }
            : { translate: `0px ${v.t}px`, scale: `1 ${v.s}` })

        /** 量兩端與縮放中心（沒有變形時才量） */
        const measure = () => {
            const axis = axisNow()
            const { bounds } = optsRef.current
            const b = (bounds?.() ?? el).getBoundingClientRect()
            const r = el.getBoundingClientRect()
            lo = axis === 'x' ? b.left : b.top
            hi = axis === 'x' ? b.right : b.bottom
            o = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2
        }

        const release = () => {
            if (!cur) return
            const from = fmt(cur)
            cur = null
            el.style.removeProperty('translate')
            el.style.removeProperty('scale')
            if (prefersReducedMotion() || typeof el.animate !== 'function') return
            const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-sp').trim() || EASE_FALLBACK
            anim = el.animate([from, { translate: '0px 0px', scale: '1 1' }], { duration: LENS_CFG.pullBack, easing: ease })
        }

        const end = (e: PointerEvent) => {
            if (e.pointerId !== pid) return
            pid = null
            release()
        }

        const move = (e: PointerEvent) => {
            const { active, disabled } = optsRef.current
            // 不是從這個元件按下、但放大鏡已經在跟這根手指（例如從觸發鈕拖進彈出選單）：接手
            if (pid === null && active && !disabled && e.buttons > 0 && active()) pid = e.pointerId
            if (e.pointerId !== pid) return
            if (active && !active()) { release(); return }
            // 還在彈回：等彈完再拉（彈回中量到的位置含動畫的變形）
            if (anim?.playState === 'running') return
            // 還沒被拉時每次重量兩端（元件可能剛展開、還在長大）；拉著時沿用，免得量到自己的變形
            if (!cur) measure()
            const v = pullTransform(axisNow() === 'x' ? e.clientX : e.clientY, lo, hi, o)
            if (v.s === 1 && v.t === 0) {
                if (cur) { cur = null; el.style.removeProperty('translate'); el.style.removeProperty('scale') }
                return
            }
            cur = v
            const f = fmt(v)
            el.style.translate = f.translate
            el.style.scale = f.scale
        }

        const down = (e: PointerEvent) => {
            if (optsRef.current.disabled || pid !== null || e.button > 0) return
            pid = e.pointerId
        }

        el.addEventListener('pointerdown', down, true)
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', end, true)
        window.addEventListener('pointercancel', end, true)
        return () => {
            el.removeEventListener('pointerdown', down, true)
            window.removeEventListener('pointermove', move, true)
            window.removeEventListener('pointerup', end, true)
            window.removeEventListener('pointercancel', end, true)
            anim?.cancel()
            el.style.removeProperty('translate')
            el.style.removeProperty('scale')
        }
    }, [ref])
}

/**
 * 畫面上量到的方框 → 換回「沒被拉長」時的位置。
 * 給每一幀都用 getBoundingClientRect 定位放大鏡的元件（LensMenu）：拉過頭時卡片被縮放，
 * 不換回去的話，放大鏡會被算進一次縮放、又跟著卡片再縮放一次，越靠近被拉的那端偏越多。
 */
export function unpullRect(el: HTMLElement | null, r: DOMRect): DOMRect {
    if (!el?.style.scale) return r
    const [sx, sy = sx] = el.style.scale.split(' ').map(Number)
    const [tx, ty = 0] = (el.style.translate || '0px 0px').split(' ').map((v) => Number.parseFloat(v) || 0)
    const c = el.getBoundingClientRect()
    // 畫面座標＝中心＋縮放 ×（版面座標−中心）＋位移；現在的中心（c 的中心）＝版面中心＋位移
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2
    const ox = cx - tx, oy = cy - ty
    return new DOMRect(ox + (r.left - cx) / sx, oy + (r.top - cy) / sy, r.width / sx, r.height / sy)
}
