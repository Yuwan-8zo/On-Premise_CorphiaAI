/**
 * useDismiss — 選單、下拉、彈出面板共用的「點外面或按 Esc 關閉」。各元件不要自己掛 mousedown／keydown。
 *
 *   useDismiss(open, close, [menuRef, buttonRef])
 *
 *   refs：算「裡面」的元素（選單本體、觸發按鈕）；按在這些裡面不會關
 *   選項：
 *     ignore   另外不算外面的選擇器（例如可以按住拖曳的觸發鈕 '[data-conv-menu]'）
 *     outside  false＝只聽 Esc（點外面已經由遮罩處理）
 *     event    預設 mousedown；要在觸控按下的那一刻就收合用 pointerdown
 *     capture  在捕獲階段先處理（比其他 onClick 早）
 */
import { useEffect, useRef, type RefObject } from 'react'

interface DismissOptions {
    ignore?: string
    outside?: boolean
    event?: 'mousedown' | 'pointerdown'
    capture?: boolean
}

export function useDismiss(
    open: boolean,
    onClose: () => void,
    refs: RefObject<Element | null>[] = [],
    { ignore, outside = true, event = 'mousedown', capture = false }: DismissOptions = {},
) {
    // 永遠呼叫最新的 onClose 與 refs，不用因為它們改變而重新掛監聽
    const latest = useRef({ onClose, refs })
    latest.current = { onClose, refs }

    useEffect(() => {
        if (!open) return
        const onDown = (e: Event) => {
            const target = e.target as Node | null
            if (!target) return
            if (latest.current.refs.some((r) => r.current?.contains(target))) return
            if (ignore && (target as Element).closest?.(ignore)) return
            latest.current.onClose()
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') latest.current.onClose()
        }
        if (outside) document.addEventListener(event, onDown, capture)
        document.addEventListener('keydown', onKey)
        return () => {
            if (outside) document.removeEventListener(event, onDown, capture)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, ignore, outside, event, capture])
}
