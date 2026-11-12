/**
 * ListLens — 捲動清單的放大鏡（側欄對話清單用）：直接照設定頁側欄（GlassNav）的放大鏡
 *
 *   平常：放大鏡停在目前那一列，只顯示凹陷底盤（.seg-veil）
 *   滑鼠按下一列：放大鏡在目前那一列原地長大（四邊多 --lens-over，鏡內放大 LENS_MAG、字用強調色）
 *   按住拖曳：按下 LENS_CFG.hold 後放大鏡跟著游標上下滑（每幀追 30%）；放開＝吸到最近的一列並選取它
 *   點一下：放大鏡從目前那一列滑到點的那一列（glideTo 的時間表），中途縮回成底盤
 *   手指（觸控）：拖曳要留給捲動，所以按下不長大；點一下才滑過去。長按＝打開對話選單（放大鏡縮回）
 *
 * 用法：放在捲動區（要 position: relative）的第一個子元素；可選的列加 data-lens-row，目前那一列加 .is-current。
 *   <div className="glass-scroll relative lens-list"><ListLens watch={currentId} />…列…</div>
 * 列本身的底盤由 .lens-list 拿掉（改由放大鏡畫）。列裡標了 data-conv-menu 的按鈕（⋯）按下不觸發放大鏡。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LENS_CFG, LENS_MAG, lensActive, useLensMotion } from './lensKit'
import { readPx } from '@/lib/cssVars'
import { swallowNextClick } from '@/lib/swallowClick'

type Box = { cy: number; h: number; left: number; w: number }

/** 列在捲動區內容座標裡的位置（用 offset 量：不受「按下縮小」影響；捲動時跟著內容走） */
function rowBox(host: HTMLElement, row: HTMLElement): Box | null {
    let top = 0, left = 0, el: HTMLElement | null = row
    while (el && el !== host) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent as HTMLElement | null }
    if (el !== host) return null
    return { cy: top + row.offsetHeight / 2, h: row.offsetHeight, left, w: row.offsetWidth }
}

export default function ListLens({ watch }: { watch: unknown }) {
    const selfRef = useRef<HTMLDivElement | null>(null)
    const ghostRef = useRef<HTMLDivElement | null>(null)
    const [box, setBox] = useState<Box | null>(null)
    const boxRef = useRef<Box | null>(null)
    /** 放大鏡最後要停的位置（避免同一個目標滑兩次） */
    const target = useRef<number | null>(null)
    const lens = useLensMotion(0, (a, b) => Math.abs(b - a))
    const lensRef = useRef(lens)
    lensRef.current = lens

    const host = () => selfRef.current?.parentElement ?? null
    /** 可選的列（不含放大鏡裡的複本） */
    const rows = () => {
        const h = host()
        return h ? Array.from(h.querySelectorAll<HTMLElement>('[data-lens-row]')).filter((r) => r.offsetParent) : []
    }
    const measureCurrent = (): Box | null => {
        const h = host()
        const row = h?.querySelector<HTMLElement>('[data-lens-row].is-current')
        return h && row && row.offsetParent ? rowBox(h, row) : null
    }
    const glide = (cy: number) => {
        target.current = cy
        lensRef.current.glideTo(cy)
    }

    /** 鏡內複本：複製清單（不含放大鏡自己）一次，長大／滑行期間不再複製 */
    const snapshot = () => {
        const h = host(), g = ghostRef.current
        if (!h || !g) return
        const c = h.cloneNode(true) as HTMLElement
        c.querySelector('[data-list-lens]')?.remove()
        c.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
        // 複本裡的列不能再被當成可選的列量到（複本在捲動區最前面，會先被找到）
        c.querySelectorAll('[data-lens-row]').forEach((el) => el.removeAttribute('data-lens-row'))
        c.removeAttribute('data-fade')
        c.className = `${h.className} lens-ghost`.replace(/\bglass-scroll\b/, '')
        Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: `${h.clientWidth}px`, height: `${h.scrollHeight}px`, margin: '0', overflow: 'visible', maskImage: 'none', webkitMaskImage: 'none' })
        c.inert = true
        g.replaceChildren(c)
    }

    // 目前項目換了（點了別的對話、從網址進來）：第一次直接放好，之後滑過去
    useLayoutEffect(() => {
        const b = measureCurrent()
        const prev = boxRef.current
        boxRef.current = b
        setBox(b)
        if (!b) return
        if (!prev) { target.current = b.cy; lens.jump(b.cy); return }
        if (target.current === null || Math.abs(target.current - b.cy) > 0.5) {
            if (!lensActive(lens.current.current)) snapshot()
            glide(b.cy)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watch])

    // 清單大小改變（側欄展開、對話增減）：重新量，沒在動就直接放好
    useEffect(() => {
        const h = host()
        if (!h || typeof ResizeObserver === 'undefined') return
        const ro = new ResizeObserver(() => {
            const b = measureCurrent()
            boxRef.current = b
            setBox(b)
            if (b && !lensActive(lensRef.current.current.current)) { target.current = b.cy; lensRef.current.jump(b.cy) }
        })
        ro.observe(h)
        for (const el of Array.from(h.children)) ro.observe(el)
        return () => ro.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 按下、拖曳、放開（和 GlassNav 同一套：press → follow → glideTo）
    useEffect(() => {
        const h = host()
        if (!h) return
        let drag: { id: number; sy: number; touch: boolean; moved: boolean; timer: ReturnType<typeof setTimeout> } | null = null
        /** 游標 y → 內容座標，限制在第一列～最後一列的中心之間 */
        const yToPos = (clientY: number) => {
            const cs = rows().map((r) => rowBox(h, r)?.cy ?? 0)
            const y = clientY - h.getBoundingClientRect().top - h.clientTop + h.scrollTop
            return Math.max(Math.min(...cs), Math.min(Math.max(...cs), y))
        }
        const nearestRow = (pos: number) => {
            let best: HTMLElement | null = null, d = Infinity
            for (const r of rows()) { const b = rowBox(h, r); if (b && Math.abs(b.cy - pos) < d) { d = Math.abs(b.cy - pos); best = r } }
            return best
        }
        const cancel = () => {
            if (!drag) return
            clearTimeout(drag.timer)
            lensRef.current.follow(null)
            const cur = measureCurrent()
            if (cur) glide(cur.cy)
            try { h.releasePointerCapture(drag.id) } catch { /* 已經放開 */ }
            h.style.removeProperty('user-select')
            drag = null
        }
        const down = (e: PointerEvent) => {
            if (e.button > 0) return
            const t = e.target as HTMLElement
            const row = t.closest<HTMLElement>('[data-lens-row]')
            if (!row || !h.contains(row) || t.closest('[data-conv-menu]')) return
            const touch = e.pointerType === 'touch'
            // 還沒有目前項目（例如新對話）：放大鏡從按下的那一列開始
            if (!boxRef.current) {
                const b = rowBox(h, row)
                if (!b) return
                boxRef.current = b
                setBox(b)
                lensRef.current.jump(b.cy)
            }
            // 長按＝打開對話選單：時間到還沒拖動，放大鏡縮回去
            drag = { id: e.pointerId, sy: e.clientY, touch, moved: false, timer: setTimeout(() => { if (drag && !drag.moved) cancel() }, LENS_CFG.pressWait) }
            if (touch) return
            snapshot()
            lensRef.current.press()
        }
        const move = (e: PointerEvent) => {
            if (!drag || drag.id !== e.pointerId) return
            if (!drag.moved && Math.abs(e.clientY - drag.sy) < LENS_CFG.slop) return
            // 手指拖動＝捲動清單：放大鏡不跟
            if (drag.touch) { clearTimeout(drag.timer); drag = null; return }
            if (!drag.moved) {
                drag.moved = true
                clearTimeout(drag.timer)
                try { h.setPointerCapture(e.pointerId) } catch { /* 部分瀏覽器不支援 */ }
                h.style.setProperty('user-select', 'none')
            }
            lensRef.current.follow(yToPos(e.clientY))
        }
        const up = (e: PointerEvent) => {
            if (!drag || drag.id !== e.pointerId) return
            const d = drag
            drag = null
            clearTimeout(d.timer)
            lensRef.current.follow(null)
            h.style.removeProperty('user-select')
            if (d.moved) {
                // 拖曳放開：吸到放大鏡最近的那一列，選取它
                const row = nearestRow(lensRef.current.current.current.pos)
                const b = row && rowBox(h, row)
                if (b) glide(b.cy)
                try { h.releasePointerCapture(e.pointerId) } catch { /* 已經放開 */ }
                row?.click()
                swallowNextClick() // 先選取，再擋掉瀏覽器接著送的那一下（順序反了會把選取也擋掉）
                return
            }
            // 點一下：滑到點的那一列（選取交給列自己的 click）
            const row = (e.target as HTMLElement).closest<HTMLElement>('[data-lens-row]')
            const b = row && h.contains(row) && rowBox(h, row)
            if (!b) return
            if (d.touch) snapshot()
            glide(b.cy)
        }
        const lost = (e: PointerEvent) => { if (drag && drag.id === e.pointerId && drag.moved) cancel() }
        h.addEventListener('pointerdown', down)
        h.addEventListener('pointermove', move)
        h.addEventListener('pointerup', up)
        h.addEventListener('pointercancel', cancel)
        h.addEventListener('lostpointercapture', lost)
        return () => {
            h.removeEventListener('pointerdown', down)
            h.removeEventListener('pointermove', move)
            h.removeEventListener('pointerup', up)
            h.removeEventListener('pointercancel', cancel)
            h.removeEventListener('lostpointercapture', lost)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const f = lens.frame
    const active = lensActive(f)
    const over = box ? readPx('--lens-over') * f.grow : 0
    const lw = box ? box.w + over * 2 : 0
    const lh = box ? box.h + over * 2 : 0
    const L = box ? box.left - over : 0
    const T = f.pos - lh / 2
    const mag = 1 + (LENS_MAG - 1) * f.grow

    // 放大鏡作用中：真正的那一列先變回一般樣子（強調色只在鏡子裡），和 GlassNav 的「on && !active 才算目前」一樣
    useEffect(() => {
        const h = selfRef.current?.parentElement
        h?.classList.toggle('lens-busy', active)
        return () => { h?.classList.remove('lens-busy') }
    }, [active])

    return (
        <div ref={selfRef} data-list-lens aria-hidden="true" className={`absolute left-0 top-0 w-0 h-0 pointer-events-none ${active ? 'z-[2]' : 'z-0'}`}>
            {/* 平常在列的下面（只當底盤）；長大、滑行時蓋到列的上面，鏡內是放大的複本 */}
            {box && (
                <div className={`lens list-lens absolute ${active ? 'is-active' : ''}`} style={{ left: L, top: T, width: lw, height: lh, borderRadius: lh / 2 }}>
                    <div
                        ref={ghostRef}
                        className="absolute left-0 top-0"
                        style={{
                            visibility: active ? 'visible' : 'hidden',
                            transformOrigin: '0 0',
                            transform: `translate(${lw / 2}px, ${lh / 2}px) scale(${mag}) translate(${-lw / 2}px, ${-lh / 2}px) translate(${-L}px, ${-T}px)`,
                        }}
                    />
                    {active && <span className="lens-dish" />}
                    <span className="lens-veil seg-veil" style={{ opacity: f.veil }} />
                </div>
            )}
        </div>
    )
}
