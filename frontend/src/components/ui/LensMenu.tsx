/**
 * LensMenu — 選單長按放大鏡（照「北海道雪見六日」範本第 6 區 Dock 選單 .lens）
 *
 * 範本規格（design.js moveLens／drawLens）：
 *   - 按住 320ms → 出現放大鏡（只看長按，不因移動提前出現）；每幀追手指 30%（cur += (t - cur) * 0.3）
 *   - 放大鏡中心限制在第一項～最後一項的中心之間
 *   - 放大鏡裡是選單的複本（cloneNode），放大 1.12、反向位移，讓顏色跟著手指走；
 *     放大鏡內的項目用強調色、不畫底盤
 *   - 真正的選單在放大鏡位置挖洞（mask xor），不重影
 *   - 放開 → 選取放大鏡停住的那一項；一般點擊照常運作
 *   - 放大鏡外觀：淡白漸層＋上下細亮線（範本 .lens），不模糊
 *
 * 用法：把選單內容放在 <LensMenu> 裡；裡面所有 button、連結、role=menuitem 或 data-lens-item 都算選項。
 * 直排或橫排會依選項位置自動判斷。
 */
import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'

const HOLD_MS = 320 // 範本：長按 320ms 才出現放大鏡（移動不會提前觸發）
const MAG = 1.12

type Props = {
    children: ReactNode
    className?: string
    /** 顯示會滑動的選取底盤：自動跟著選單裡標了 .is-current 的項目 */
    plate?: boolean
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>

export default function LensMenu({ children, className = '', plate = false, ...rest }: Props) {
    const wrapRef = useRef<HTMLDivElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const lensRef = useRef<HTMLDivElement | null>(null)
    const plateRef = useRef<HTMLDivElement | null>(null)

    // 選取底盤：移到目前項目（.is-current）的位置；第一次定位不播動畫
    const placePlate = () => {
        const el = plateRef.current, wrap = wrapRef.current, list = listRef.current
        if (!el || !wrap || !list) return
        const cur = list.querySelector<HTMLElement>('.is-current')
        if (!cur) { el.style.opacity = '0'; return }
        const W = wrap.getBoundingClientRect(), r = cur.getBoundingClientRect()
        const first = el.style.opacity !== '1'
        if (first) el.style.transition = 'none'
        Object.assign(el.style, {
            opacity: '1',
            width: `${r.width}px`,
            height: `${r.height}px`,
            borderRadius: getComputedStyle(cur).borderTopLeftRadius,
            transform: `translate(${r.left - W.left}px, ${r.top - W.top}px)`,
        })
        if (first) requestAnimationFrame(() => { el.style.transition = '' })
    }
    useLayoutEffect(() => { if (plate) placePlate() })
    useEffect(() => {
        if (!plate || typeof ResizeObserver === 'undefined' || !listRef.current) return
        const ro = new ResizeObserver(() => placePlate())
        ro.observe(listRef.current)
        return () => ro.disconnect()
         
    }, [plate])

    const st = useRef({
        pid: -1,
        px: 0,
        py: 0,
        active: false,
        timer: 0 as unknown as ReturnType<typeof setTimeout>,
        raf: 0,
        cur: null as number | null,
        axis: 'y' as 'x' | 'y',
        hov: null as HTMLElement | null,
        ghost: null as HTMLElement | null,
        down: false,
        off: null as null | (() => void),
    })

    const items = (): HTMLElement[] => {
        const list = listRef.current
        if (!list) return []
        const all = list.querySelectorAll<HTMLElement>('button, a[href], [role="menuitem"], [data-lens-item]')
        return [...all].filter((el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled)
    }

    const clearMask = () => {
        const l = listRef.current
        if (!l) return
        l.style.removeProperty('-webkit-mask-image')
        l.style.removeProperty('mask-image')
    }

    const draw = () => {
        const s = st.current
        const wrap = wrapRef.current, list = listRef.current, lens = lensRef.current
        const its = items()
        if (!wrap || !list || !lens || !its.length) return
        const W = wrap.getBoundingClientRect()
        const L = list.getBoundingClientRect()
        const rs = its.map((el) => el.getBoundingClientRect())
        const vert = s.axis === 'y'
        const centers = rs.map((r) => (vert ? r.top + r.height / 2 : r.left + r.width / 2))
        const lo = Math.min(...centers), hi = Math.max(...centers)
        const t = Math.max(lo, Math.min(hi, vert ? s.py : s.px))
        if (s.cur === null) s.cur = t
        s.cur += (t - s.cur) * 0.3
        if (Math.abs(t - s.cur) < 0.05) s.cur = t
        // 放大鏡停在哪一項
        let idx = 0, best = Infinity
        centers.forEach((c, i) => { const d = Math.abs(c - s.cur!); if (d < best) { best = d; idx = i } })
        s.hov = its[idx]
        const r = rs[idx]
        // 尺寸：直排時與選項同寬（不超出捲動範圍被裁切）、高度放大 1.25；橫排時沿排列方向放大 1.12
        const lw = vert ? r.width : r.width * MAG
        const lh = r.height * 1.25
        const cx = vert ? r.left + r.width / 2 : s.cur
        const cy = vert ? s.cur : r.top + r.height / 2
        const x = cx - lw / 2 - W.left
        const y = cy - lh / 2 - W.top
        // 膠囊（範本放大鏡圓角 ≈ 高度一半）
        const rad = Math.min(lh, lw) / 2
        Object.assign(lens.style, { left: `${x}px`, top: `${y}px`, width: `${lw}px`, height: `${lh}px`, borderRadius: `${rad}px` })
        // 放大鏡內的複本：以放大鏡中心放大 1.12，反向位移與真選單對齊
        if (s.ghost) {
            s.ghost.style.width = `${L.width}px`
            s.ghost.style.transform =
                `translate(${lw / 2}px, ${lh / 2}px) scale(${MAG}) translate(${-lw / 2}px, ${-lh / 2}px) ` +
                `translate(${L.left - W.left - x}px, ${L.top - W.top - y}px)`
        }
        // 真選單挖洞
        const mx = x - (L.left - W.left), my = y - (L.top - W.top)
        const m = 'linear-gradient(#000 0 0), linear-gradient(#000 0 0)'
        Object.assign(list.style, {
            webkitMaskImage: m, maskImage: m,
            webkitMaskSize: `100% 100%, ${lw}px ${lh}px`, maskSize: `100% 100%, ${lw}px ${lh}px`,
            webkitMaskPosition: `0 0, ${mx}px ${my}px`, maskPosition: `0 0, ${mx}px ${my}px`,
            webkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
            webkitMaskComposite: 'xor', maskComposite: 'exclude',
        } as Partial<CSSStyleDeclaration>)
    }

    const loop = () => {
        const s = st.current
        if (!s.active) return
        draw()
        s.raf = requestAnimationFrame(loop)
    }

    const activate = () => {
        const s = st.current
        const wrap = wrapRef.current, list = listRef.current, lens = lensRef.current
        // 已經放開就不出現（避免在選單外放開後，計時仍觸發、放大鏡卡住跟著滑鼠）
        if (s.active || !s.down || !wrap || !list || !lens) return
        const its = items()
        if (its.length < 2) return
        // 依選項位置判斷直排／橫排
        const a = its[0].getBoundingClientRect(), b = its[its.length - 1].getBoundingClientRect()
        s.axis = Math.abs(b.top - a.top) >= Math.abs(b.left - a.left) ? 'y' : 'x'
        s.active = true
        s.cur = null
        try { wrap.setPointerCapture(s.pid) } catch { /* 部分瀏覽器不支援 */ }
        // 複製選單放進放大鏡（範本 buildGhost）
        lens.innerHTML = ''
        const g = list.cloneNode(true) as HTMLElement
        g.removeAttribute('id')
        g.setAttribute('aria-hidden', 'true')
        g.inert = true
        Object.assign(g.style, { position: 'absolute', left: '0', top: '0', margin: '0', transformOrigin: '0 0', pointerEvents: 'none' })
        g.style.removeProperty('-webkit-mask-image')
        g.style.removeProperty('mask-image')
        lens.appendChild(g)
        s.ghost = g
        lens.classList.add('on')
        wrap.classList.add('lens-on')
        cancelAnimationFrame(s.raf)
        s.raf = requestAnimationFrame(loop)
    }

    const end = (commit: boolean) => {
        const s = st.current
        clearTimeout(s.timer)
        s.down = false
        s.off?.()
        s.off = null
        const wasActive = s.active
        const target = s.hov
        s.pid = -1
        s.active = false
        s.hov = null
        cancelAnimationFrame(s.raf)
        if (!wasActive) return
        lensRef.current?.classList.remove('on')
        const w = wrapRef.current
        // 放大鏡選取：底盤直接出現在新位置，與放大鏡淡出同步（不從舊位置滑過來）
        w?.classList.replace('lens-on', 'lens-out')
        setTimeout(() => w?.classList.remove('lens-out'), 350)
        clearMask()
        setTimeout(() => { if (!st.current.active && lensRef.current) { lensRef.current.innerHTML = ''; st.current.ghost = null } }, 300)
        // 放開 → 選取放大鏡停住的那一項
        if (commit && target) target.click()
    }

    useEffect(() => () => { cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer); st.current.off?.() }, [])

    return (
        <div
            ref={wrapRef}
            className="relative"
            onPointerDown={(e) => {
                if (e.button > 0) return
                const s = st.current
                s.pid = e.pointerId
                s.down = true
                s.px = e.clientX
                s.py = e.clientY
                clearTimeout(s.timer)
                s.timer = setTimeout(activate, HOLD_MS)
                // 放開／取消在整個視窗監聽：在選單外放開也收得到
                s.off?.()
                const pid = e.pointerId
                const up = (ev: PointerEvent) => { if (ev.pointerId === pid) end(true) }
                const cancel = (ev: PointerEvent) => { if (ev.pointerId === pid) end(false) }
                window.addEventListener('pointerup', up, true)
                window.addEventListener('pointercancel', cancel, true)
                s.off = () => {
                    window.removeEventListener('pointerup', up, true)
                    window.removeEventListener('pointercancel', cancel, true)
                }
            }}
            onPointerMove={(e) => {
                const s = st.current
                if (e.pointerId !== s.pid) return
                s.px = e.clientX
                s.py = e.clientY
            }}
        >
            <div ref={listRef} className={`${plate ? 'has-plate ' : ''}${className}`} {...rest}>
                {plate && <div ref={plateRef} aria-hidden="true" data-lens-plate className="lens-plate" style={{ opacity: 0 }} />}
                {children}
            </div>
            <div ref={lensRef} aria-hidden="true" className="menu-lens" />
        </div>
    )
}
