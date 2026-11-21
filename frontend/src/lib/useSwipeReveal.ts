/**
 * 往左滑露出按鈕（手機清單的一列，像 iOS 郵件）
 *
 *   手指按住一列往左拖：列裡的內容跟著走，右邊露出按鈕（.swipe-actions）
 *   放開：拖超過按鈕寬度的一半＝停在打開的位置，否則彈回
 *   打開時：點別的地方（或開了另一列）就收回；點這列本身只收回、不打開對話
 *   只接手指／觸控筆（滑鼠用「⋯」和長按）；上下的捲動照常（列設 touch-action: pan-y）
 *
 *   寫在列上的樣式變數 --swipe-x（內容位移）與 data-swipe（拖曳或打開中），樣式見 chat.css
 *   const ref = useSwipeReveal(enabled)   →   <div ref={ref}>…<div className="swipe-actions">…</div></div>
 */
import { useCallback, useRef } from 'react'
import { swallowNextClick } from '@/lib/swallowClick'
import { readMs } from '@/lib/cssVars'

/** 動了多少 px 才判斷方向 */
const SWIPE_SLOP = 8
/** 拖過頭（超過按鈕寬度）時的阻力 */
const SWIPE_OVER_DAMP = 0.25

/** 目前打開的那一列（同時只開一列） */
let closeOpen: (() => void) | null = null

export function useSwipeReveal(enabled: boolean) {
    const on = useRef(enabled)
    on.current = enabled
    const cleanup = useRef<(() => void) | null>(null)

    return useCallback((row: HTMLElement | null) => {
        cleanup.current?.()
        cleanup.current = null
        if (!row) return
        let start: { x: number; y: number; id: number; base: number } | null = null
        let mode: 'none' | 'swipe' | 'scroll' = 'none'
        let x = 0
        const width = () => row.querySelector<HTMLElement>('.swipe-actions')?.offsetWidth ?? 0
        const set = (v: number, animate: boolean) => {
            x = v
            row.toggleAttribute('data-swipe-anim', animate)
            row.style.setProperty('--swipe-x', `${v}px`)
            if (v) row.dataset.swipe = ''
            else if (animate) window.setTimeout(() => { if (!x) delete row.dataset.swipe }, readMs('--duration-panel'))
            else delete row.dataset.swipe
        }
        const close = () => {
            set(0, true)
            document.removeEventListener('pointerdown', outside, true)
            if (closeOpen === close) closeOpen = null
        }
        // 打開時按到按鈕以外的地方：收回；按的是這列本身就連 click 一起吃掉（不要順便打開對話）
        const outside = (e: PointerEvent) => {
            const t = e.target as HTMLElement
            if (t.closest('.swipe-actions') && row.contains(t)) return
            if (row.contains(t)) swallowNextClick()
            close()
        }
        const open = () => {
            if (closeOpen && closeOpen !== close) closeOpen()
            set(-width(), true)
            closeOpen = close
            document.addEventListener('pointerdown', outside, true)
        }

        const down = (e: PointerEvent) => {
            if (!on.current || e.pointerType === 'mouse') return
            if ((e.target as HTMLElement).closest('.swipe-actions')) return
            start = { x: e.clientX, y: e.clientY, id: e.pointerId, base: x }
            mode = 'none'
        }
        const move = (e: PointerEvent) => {
            if (!start || e.pointerId !== start.id) return
            const dx = e.clientX - start.x, dy = e.clientY - start.y
            if (mode === 'none') {
                if (Math.hypot(dx, dy) < SWIPE_SLOP) return
                mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
                if (mode === 'swipe') row.setPointerCapture(e.pointerId)
            }
            if (mode !== 'swipe') return
            const w = width()
            let v = Math.min(0, start.base + dx)
            if (v < -w) v = -w + (v + w) * SWIPE_OVER_DAMP
            set(v, false)
        }
        const up = (e: PointerEvent) => {
            if (!start || e.pointerId !== start.id) return
            start = null
            if (mode !== 'swipe') return
            mode = 'none'
            // 拖完放開，瀏覽器還會送一下 click：不要當成「點這列」
            swallowNextClick()
            if (x < -width() / 2) open()
            else close()
        }
        row.addEventListener('pointerdown', down)
        row.addEventListener('pointermove', move)
        row.addEventListener('pointerup', up)
        row.addEventListener('pointercancel', up)
        cleanup.current = () => {
            row.removeEventListener('pointerdown', down)
            row.removeEventListener('pointermove', move)
            row.removeEventListener('pointerup', up)
            row.removeEventListener('pointercancel', up)
            document.removeEventListener('pointerdown', outside, true)
            if (closeOpen === close) closeOpen = null
        }
    }, [])
}
