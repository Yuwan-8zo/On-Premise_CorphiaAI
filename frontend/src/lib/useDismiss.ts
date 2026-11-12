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
 *
 * 疊在一起的層（設定視窗裡再開確認框、對話框裡再開下拉選單）：按一次 Esc 只關「最後打開的那一層」，再按一次才關下一層。
 * 所以對話框、整頁視窗也用這一支（outside: false），不要各自掛 keydown。
 *
 * 按 Esc 關閉時，焦點回到打開前的那個元素（通常是觸發按鈕），鍵盤使用者不會失去位置；點外面關閉則不搶焦點。
 * 點外面關閉時，這一下只負責關閉：接下來的 click 不會傳到底下的按鈕或卡片（iOS 的行為；不然關選單的同時會誤按到後面的東西）。
 */
import { useEffect, useRef, type RefObject } from 'react'
import { swallowNextClick } from './swallowClick'

/** 目前開著的層，依打開的順序；最後一個是最上面那一層（Esc 只給它處理） */
const openLayers: symbol[] = []

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
        const layer = Symbol('dismiss-layer')
        openLayers.push(layer)
        // 打開那一刻有焦點的元素（觸發按鈕）；按 Esc 關閉後把焦點還給它
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const onDown = (e: Event) => {
            const target = e.target as Node | null
            if (!target) return
            if (latest.current.refs.some((r) => r.current?.contains(target))) return
            if (ignore && (target as Element).closest?.(ignore)) return
            latest.current.onClose()
            swallowNextClick()
        }
        const onKey = (e: KeyboardEvent) => {
            // 裡面的欄位已經用掉這次 Esc（例如搜尋欄先清空文字）就不關閉
            if (e.key !== 'Escape' || e.defaultPrevented) return
            // 上面還有別的層開著：這次 Esc 是它的
            if (openLayers[openLayers.length - 1] !== layer) return
            latest.current.onClose()
            if (opener?.isConnected) requestAnimationFrame(() => opener.focus({ preventScroll: true }))
        }
        if (outside) document.addEventListener(event, onDown, capture)
        document.addEventListener('keydown', onKey)
        return () => {
            const i = openLayers.indexOf(layer)
            if (i !== -1) openLayers.splice(i, 1)
            if (outside) document.removeEventListener(event, onDown, capture)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, ignore, outside, event, capture])
}
