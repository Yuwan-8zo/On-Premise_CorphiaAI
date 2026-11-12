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
 *   - 放大鏡外觀、大小、長大動畫：和設定頁側欄（GlassNav）同一套——選項四邊各多 --lens-over、0.12 秒長大、
 *     鏡內放大 LENS_MAG 跟著長大；鏡片透明，只有亮邊（.lens-dish）和外圈細線，字用強調色粗體
 *
 * 從觸發鈕按住拖進來（lib/menuDrag）：選單一掛上就接手那根手指，滑進選單範圍放大鏡馬上出現（不用再等長按），
 * 在選單裡放開＝選那一項，在選單外放開＝不選、選單留著。
 *
 * 用法：把選單內容放在 <LensMenu> 裡；裡面所有 button、連結、role=menuitem 或 data-lens-item 都算選項。
 * 直排或橫排會依選項位置自動判斷。
 */
import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { capsuleHole, LENS_CFG, LENS_MAG } from './lensKit'
import { readPx } from '@/lib/cssVars'
import { swallowNextClick } from '@/lib/swallowClick'
import { returnMenuDrag, takeMenuDrag } from '@/lib/menuDrag'

const HOLD_MS = LENS_CFG.pressWait // 長按多久才出現放大鏡（移動不會提前觸發）
/** 放大鏡比選項多出去的距離（和設定頁側欄 GlassNav 同一個 --lens-over），長大時間 LENS_CFG.grow */
const growEase = (x: number) => 1 - Math.pow(1 - x, 3)

type Props = {
    children: ReactNode
    className?: string
    /** 顯示會滑動的選取底盤：自動跟著選單裡標了 .is-current 的項目 */
    plate?: boolean
    /** 外層選單卡片的圓角跟著膠囊放大鏡調成同心（預設開；選單只是大面板的一部分時關掉，例如提示詞模板） */
    fitCard?: boolean
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>

export default function LensMenu({ children, className = '', plate = false, fitCard = true, ...rest }: Props) {
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

    // 選單卡片的圓角：調成「放大鏡膠囊的圓角＋選項離卡片邊的距離」，膠囊放大鏡和卡片同心（只有直排、外層是 .paper 卡片時）
    useLayoutEffect(() => {
        if (!fitCard) return
        const wrap = wrapRef.current
        const card = wrap?.closest<HTMLElement>('.paper')
        const first = listRef.current?.querySelector<HTMLElement>('button, a[href], [role="menuitem"], [data-lens-item]')
        if (!card || !first) return
        // 掛上時選單正在打開的動畫裡（縮放 0.96→1）：量到的尺寸先換回沒縮放的大小
        const C = card.getBoundingClientRect(), b = first.getBoundingClientRect()
        const k = card.offsetWidth ? C.width / card.offsetWidth : 1
        const r = { height: b.height / k }
        const inset = Math.max(0, (b.left - C.left) / k)
        // 放大鏡長到最大＝選項四邊各多 over（不超過選項離卡片的距離），膠囊圓角＋剩下的距離＝卡片圓角
        const over = Math.min(readPx('--lens-over'), inset)
        const lensR = r.height / 2 + over
        card.style.setProperty('border-radius', `${Math.round(lensR + inset - over)}px`, 'important')
    }, [fitCard])
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
        /** 放大鏡開始長大的時間、四邊多出去的距離 */
        t0: 0,
        over: 0,
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
        for (const k of ['-webkit-mask-image', 'mask-image', '-webkit-mask-size', 'mask-size', '-webkit-mask-position', 'mask-position', '-webkit-mask-repeat', 'mask-repeat', '-webkit-mask-composite', 'mask-composite']) l.style.removeProperty(k)
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
        const finger = Math.max(lo, Math.min(hi, vert ? s.py : s.px))
        // 直排：手指在哪一項，放大鏡就滑到那一項的正中間停住（鏡裡的字上下置中）；橫排照舊跟著手指
        let near = 0, nd = Infinity
        centers.forEach((c, i) => { const d = Math.abs(c - finger); if (d < nd) { nd = d; near = i } })
        const t = vert ? centers[near] : finger
        if (s.cur === null) s.cur = t
        s.cur += (t - s.cur) * 0.3
        if (Math.abs(t - s.cur) < 0.05) s.cur = t
        // 放大鏡停在哪一項
        let idx = 0, best = Infinity
        centers.forEach((c, i) => { const d = Math.abs(c - s.cur!); if (d < best) { best = d; idx = i } })
        s.hov = its[idx]
        const r = rs[idx]
        // 尺寸（和設定頁側欄的放大鏡同一套）：選項四邊各多 over，按下後 0.12 秒從選項大小長大；一律膠囊
        const g = growEase(Math.min(1, (performance.now() - s.t0) / LENS_CFG.grow))
        const card = wrap.closest<HTMLElement>('.paper')
        const C = card?.getBoundingClientRect()
        // 選單卡片：放大鏡不能超出卡片（多出去的距離不超過選項離卡片的距離）
        const inset = C ? Math.max(0, vert ? r.left - C.left : r.top - C.top) : s.over
        const over = Math.min(s.over, inset) * g
        const lw = r.width + over * 2
        let lh = r.height + over * 2
        const cx = vert ? r.left + r.width / 2 : s.cur
        const cy = vert ? s.cur : r.top + r.height / 2
        const gap = Math.max(0, inset - over)
        if (C && vert) lh = Math.min(lh, C.height - 2 * gap)
        const freeTop = cy - lh / 2
        let top = freeTop
        if (C && vert) top = Math.max(C.top + gap, Math.min(C.bottom - gap - lh, top))
        // 被卡片上下緣擋住時放大鏡往內挪了：鏡裡的內容跟著挪同樣的距離，字才會在鏡子裡上下置中
        const shiftY = top - freeTop
        const x = cx - lw / 2 - W.left
        const y = top - W.top
        const rad = Math.min(lh, lw) / 2
        Object.assign(lens.style, { left: `${x}px`, top: `${y}px`, width: `${lw}px`, height: `${lh}px`, borderRadius: `${rad}px` })
        // 放大鏡內的複本：和側欄一樣以放大鏡中心放大（倍率跟著長大），反向位移與真選單對齊
        if (s.ghost) {
            const mag = 1 + (LENS_MAG - 1) * g
            s.ghost.style.width = `${L.width}px`
            s.ghost.style.transform =
                `translate(${lw / 2}px, ${lh / 2}px) scale(${mag}) translate(${-lw / 2}px, ${-lh / 2}px) ` +
                `translate(${L.left - W.left - x}px, ${L.top - W.top - y + shiftY}px)`
        }
        // 真選單挖一個一樣的膠囊洞（不重影）
        const hole = capsuleHole(x - (L.left - W.left), y - (L.top - W.top), lw, lh) as Record<string, string>
        for (const [k, v] of Object.entries(hole)) list.style.setProperty(k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), String(v))
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
        // 只有一個能按的項目（例如自己的帳號只能「編輯」）也要有放大鏡，從觸發鈕拖過來才選得到
        if (!its.length) return
        // 依選項位置判斷直排／橫排（只有一項就當直排）
        const a = its[0].getBoundingClientRect(), b = its[its.length - 1].getBoundingClientRect()
        s.axis = its.length < 2 || Math.abs(b.top - a.top) >= Math.abs(b.left - a.left) ? 'y' : 'x'
        s.active = true
        s.cur = null
        s.t0 = performance.now()
        s.over = readPx('--lens-over')
        try { wrap.setPointerCapture(s.pid) } catch { /* 部分瀏覽器不支援 */ }
        // 複製選單放進放大鏡（範本 buildGhost）
        lens.innerHTML = ''
        const g = list.cloneNode(true) as HTMLElement
        g.removeAttribute('id')
        g.classList.add('lens-ghost')
        g.setAttribute('aria-hidden', 'true')
        g.inert = true
        Object.assign(g.style, { position: 'absolute', left: '0', top: '0', margin: '0', transformOrigin: '0 0', pointerEvents: 'none' })
        g.style.removeProperty('-webkit-mask-image')
        g.style.removeProperty('mask-image')
        lens.appendChild(g)
        // 亮邊（長邊兩緣），和側欄、分段切換器同一個 .lens-dish
        const dish = document.createElement('span')
        dish.className = 'lens-dish'
        lens.appendChild(dish)
        s.ghost = g
        lens.classList.add('on')
        wrap.classList.add('lens-on')
        cancelAnimationFrame(s.raf)
        s.raf = requestAnimationFrame(loop)
    }

    /** 收起放大鏡（淡出、拿掉挖洞），不管手指還按不按著 */
    const hideLens = () => {
        const s = st.current
        s.active = false
        s.hov = null
        cancelAnimationFrame(s.raf)
        lensRef.current?.classList.remove('on')
        const w = wrapRef.current
        w?.classList.replace('lens-on', 'lens-out')
        setTimeout(() => w?.classList.remove('lens-out'), 350)
        clearMask()
        setTimeout(() => { if (!st.current.active && lensRef.current) { lensRef.current.innerHTML = ''; st.current.ghost = null } }, 300)
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
        if (commit && target) {
            target.click()
            swallowNextClick() // 放開時已經選好了，瀏覽器接著送出的 click 不再落到底下
        }
    }

    useEffect(() => () => { cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer); st.current.off?.() }, [])

    // 從觸發鈕按住拖進來：接手還按著的手指
    useEffect(() => {
        const drag = takeMenuDrag()
        if (!drag) return
        const s = st.current
        const pid = drag.pointerId
        s.pid = pid
        s.down = true
        s.px = drag.x
        s.py = drag.y
        /** 手指在不在選單範圍裡（四周多算一點，邊緣的項目好選） */
        const inside = (x: number, y: number) => {
            const r = wrapRef.current?.getBoundingClientRect()
            const m = LENS_CFG.dragSlop
            return !!r && x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m
        }
        /** 手指在不在觸發鈕上（拖回按鈕＝反悔） */
        const onTrigger = (x: number, y: number) => {
            const r = drag.trigger?.isConnected ? drag.trigger.getBoundingClientRect() : null
            return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        }
        /** 手指離開過觸發鈕沒有（離開後再回到按鈕放開＝反悔；一直沒離開＝只是點一下） */
        let leftTrigger = false
        const move = (ev: PointerEvent) => {
            if (ev.pointerId !== pid) return
            s.px = ev.clientX
            s.py = ev.clientY
            const over = onTrigger(ev.clientX, ev.clientY)
            if (!over) leftTrigger = true
            if (s.active && over) hideLens()
            else if (!s.active && inside(ev.clientX, ev.clientY)) activate()
        }
        const up = (ev: PointerEvent) => {
            if (ev.pointerId !== pid) return
            // 拖回觸發鈕放開：什麼都不選，選單收回去
            if (onTrigger(ev.clientX, ev.clientY)) {
                end(false)
                if (leftTrigger && drag.close) {
                    drag.close()
                    swallowNextClick() // 接著的 click 不要再落到觸發鈕上把選單打開
                }
                return
            }
            end(inside(ev.clientX, ev.clientY))
        }
        const cancel = (ev: PointerEvent) => { if (ev.pointerId === pid) end(false) }
        // 手指拖曳期間不要讓頁面捲動（長按對話列再拖的時候，瀏覽器會把拖曳當成捲動、中斷手勢）
        const noScroll = (ev: TouchEvent) => { if (s.down) ev.preventDefault() }
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', up, true)
        window.addEventListener('pointercancel', cancel, true)
        window.addEventListener('touchmove', noScroll, { passive: false, capture: true })
        const off = () => {
            window.removeEventListener('pointermove', move, true)
            window.removeEventListener('pointerup', up, true)
            window.removeEventListener('pointercancel', cancel, true)
            window.removeEventListener('touchmove', noScroll, true)
        }
        s.off = off
        return () => {
            // 選單在手指放開前就被卸下：把手指還回去（再掛上的選單會接手），自己的監聽拿掉
            const stillDown = s.down && s.pid === pid
            off()
            if (s.off === off) s.off = null
            if (stillDown) {
                s.down = false
                s.pid = -1
                returnMenuDrag({ ...drag, x: s.px, y: s.py })
            }
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
