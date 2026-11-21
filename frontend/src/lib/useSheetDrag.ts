/**
 * 往下拖就關閉的面板（手機版的底部面板，iOS 的 sheet 手感）
 *
 *   按住把手或標題列往下拖：面板跟著手指走；往上拖有阻力（拉不太動）
 *   放開：拖超過面板高度的 SHEET_CLOSE_RATIO、或往下甩得夠快（SHEET_FLING_V px/ms）＝關閉，否則彈回原位
 *   關閉時面板從目前位置繼續滑出畫面（data-swiped，讓 CSS 不再播一般的收起動畫），播完才呼叫 onClose
 *   按到按鈕、連結、輸入框不算拖（讓它們照常點）
 *
 *   const handleRef = useSheetDrag(panelRef, { enabled, onClose })
 *   <div ref={handleRef}>把手＋標題列</div>
 */
import { useCallback, useRef, type RefObject } from 'react'
import { readMs } from '@/lib/cssVars'

const SHEET_CLOSE_RATIO = 0.3
const SHEET_FLING_V = 0.6
/** 往上拖的阻力：只跟手指走這個比例 */
const SHEET_UP_DAMP = 0.15
/** 動了多少 px 才算開始拖（避免點一下被當成拖） */
const SHEET_SLOP = 4

interface Options {
    enabled: boolean
    onClose: () => void
}

export function useSheetDrag(panelRef: RefObject<HTMLElement | null>, { enabled, onClose }: Options) {
    const opts = useRef({ enabled, onClose })
    opts.current = { enabled, onClose }
    const cleanup = useRef<(() => void) | null>(null)

    return useCallback((handle: HTMLElement | null) => {
        cleanup.current?.()
        cleanup.current = null
        if (!handle) return
        let start: { y: number; t: number; id: number } | null = null
        let dragging = false
        let last = { y: 0, t: 0 }
        let v = 0
        const panel = () => panelRef.current
        const setY = (y: number, animate: boolean) => {
            const p = panel()
            if (!p) return
            p.style.transition = animate ? `transform ${readMs('--duration-panel')}ms var(--ease-sp)` : 'none'
            p.style.transform = y ? `translateY(${y}px)` : ''
        }
        const down = (e: PointerEvent) => {
            if (!opts.current.enabled || e.button > 0) return
            if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return
            start = { y: e.clientY, t: e.timeStamp, id: e.pointerId }
            last = { y: e.clientY, t: e.timeStamp }
            v = 0
            dragging = false
        }
        const move = (e: PointerEvent) => {
            if (!start || e.pointerId !== start.id) return
            const dy = e.clientY - start.y
            if (!dragging) {
                if (Math.abs(dy) < SHEET_SLOP) return
                dragging = true
                handle.setPointerCapture(e.pointerId)
            }
            const dt = e.timeStamp - last.t
            if (dt > 0) v = (e.clientY - last.y) / dt
            last = { y: e.clientY, t: e.timeStamp }
            setY(dy > 0 ? dy : dy * SHEET_UP_DAMP, false)
        }
        const up = (e: PointerEvent) => {
            if (!start || e.pointerId !== start.id) return
            const dy = e.clientY - start.y
            start = null
            if (!dragging) return
            dragging = false
            const p = panel()
            const h = p?.offsetHeight ?? 0
            if (p && (dy > h * SHEET_CLOSE_RATIO || (dy > 0 && v > SHEET_FLING_V))) {
                p.dataset.swiped = ''
                setY(h + dy, true)
                window.setTimeout(() => opts.current.onClose(), readMs('--duration-panel'))
            } else {
                setY(0, true)
            }
        }
        handle.addEventListener('pointerdown', down)
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', up)
        handle.addEventListener('pointercancel', up)
        cleanup.current = () => {
            handle.removeEventListener('pointerdown', down)
            handle.removeEventListener('pointermove', move)
            handle.removeEventListener('pointerup', up)
            handle.removeEventListener('pointercancel', up)
        }
    }, [panelRef])
}

/** 面板重新打開時清掉上一次拖出去留下的位置 */
export function resetSheet(panel: HTMLElement | null) {
    if (!panel) return
    delete panel.dataset.swiped
    panel.style.transform = ''
    panel.style.transition = ''
}
