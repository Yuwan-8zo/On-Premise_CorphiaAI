/**
 * 按住「叫出選單的按鈕」直接拖進選單選項（全站選單一致，同右下選單 Dock 的操作）
 *
 *   按下按鈕 → 選單馬上打開；手指不放開滑進選單 → 放大鏡出現並跟著手指；在某一項上放開＝選那一項
 *   只是點一下（按下就放開）→ 和以前一樣：選單打開，再點要的項目
 *   在選單外放開 → 什麼都不選，選單保持打開
 *   拖回觸發鈕上放開 → 反悔：什麼都不選，選單收回去
 *
 * 分工：
 *   觸發鈕用 useMenuTrigger(open, setOpen) 拿到 onPointerDown／onClick（還有 touch-none，拖曳時畫面不要捲）
 *   選單內容包在 <LensMenu> 裡：LensMenu 掛上時用 takeMenuDrag() 接手這個還按著的手指，畫放大鏡、放開時選取
 */
import { useRef } from 'react'

export interface MenuDrag {
    pointerId: number
    x: number
    y: number
    /** 觸發鈕：拖回這顆按鈕上放開＝反悔，選單收回去 */
    trigger?: HTMLElement | null
    /** 收回選單 */
    close?: () => void
}

let pending: MenuDrag | null = null

/** 觸發鈕按下時呼叫：記住這根手指，等選單（LensMenu）掛上來接手；還沒接手就放開＝作廢 */
export function beginMenuDrag(
    e: { pointerId: number; clientX: number; clientY: number; button: number },
    opts: { trigger?: HTMLElement | null; close?: () => void } = {},
) {
    if (e.button > 0) return
    const drag: MenuDrag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, ...opts }
    pending = drag
    const clear = (ev: PointerEvent) => {
        if (ev.pointerId !== drag.pointerId) return
        if (pending === drag) pending = null
        window.removeEventListener('pointerup', clear, true)
        window.removeEventListener('pointercancel', clear, true)
    }
    window.addEventListener('pointerup', clear, true)
    window.addEventListener('pointercancel', clear, true)
}

/** LensMenu 掛上時呼叫：有還按著的手指就交給它（只能拿一次） */
export function takeMenuDrag(): MenuDrag | null {
    const d = pending
    pending = null
    return d
}

/** 接手後選單又被卸下（例如開發模式 React 會「掛上→卸下→再掛上」檢查一次）：手指還按著就還回去，讓下一次掛上的選單接手 */
export function returnMenuDrag(d: MenuDrag) {
    pending = d
}

/**
 * 觸發鈕的事件：按下就打開並開始拖曳；接著瀏覽器送來的那次 click 不再切換（不然會馬上關掉）。
 * 選單已經打開時按下：照舊，click 會把它關掉。鍵盤（Enter／空白鍵）只有 click，照常切換。
 *
 *   const trigger = useMenuTrigger()
 *   <button {...trigger(isOpen, (el) => open(el), close)} />     // className 要自己併進去
 *   一個 hook 可以給很多顆按鈕用（例如表格每一列的「⋯」），同一時間只會按一顆
 */
export function useMenuTrigger() {
    const openedByPress = useRef(false)
    return (isOpen: boolean, open: (button: HTMLElement) => void, close: () => void) => ({
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (e.button > 0) return
            openedByPress.current = !isOpen
            if (isOpen) return
            beginMenuDrag(e, { trigger: e.currentTarget, close })
            open(e.currentTarget)
        },
        onClick: (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation()
            if (openedByPress.current) {
                openedByPress.current = false
                return
            }
            if (isOpen) close()
            else open(e.currentTarget)
        },
        /** 手指按著拖曳時頁面不要跟著捲（不然瀏覽器會中斷拖曳） */
        className: 'touch-none',
    })
}
