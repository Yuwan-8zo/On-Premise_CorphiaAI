/**
 * useKeepInViewport — 浮動選單量完自己的大小後，自動挪進畫面內（離邊至少 --space），不會被螢幕邊緣切掉。
 * 選單照常用 left／top（或 right）定位在按鈕下方；超出時用 CSS translate 往內推，不影響進場動畫用的 transform。
 *
 *   useKeepInViewport(ref, open)          // 只挪進畫面內
 *   useKeepInViewport(ref, open, anchor)  // 下面放不下、上面放得下：翻到按鈕上方（anchor＝按鈕的 top、bottom），不蓋住按鈕
 */
import { useLayoutEffect, type RefObject } from 'react'

/** 離畫面邊的最小距離：讀全站間距 --space，讀不到時用 12 */
function edgeGap() {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space'))
    return Number.isFinite(v) && v > 0 ? v : 12
}

export interface ViewportAnchor {
    top: number
    bottom: number
}

export function useKeepInViewport(ref: RefObject<HTMLElement | null>, active: unknown, anchor?: ViewportAnchor | null) {
    const aTop = anchor?.top
    const aBottom = anchor?.bottom
    useLayoutEffect(() => {
        const el = ref.current
        if (!el || !active) return
        el.style.translate = ''
        const r = el.getBoundingClientRect()
        const g = edgeGap()
        const dx = r.right > innerWidth - g ? innerWidth - g - r.right : r.left < g ? g - r.left : 0
        let dy = r.bottom > innerHeight - g ? innerHeight - g - r.bottom : r.top < g ? g - r.top : 0
        if (dy < 0 && aTop !== undefined && aBottom !== undefined) {
            // 選單和按鈕之間原本的間隔，翻到上方時保持一樣
            const offset = Math.max(0, r.top - aBottom)
            const topAbove = aTop - offset - r.height
            if (topAbove >= g) dy = topAbove - r.top
        }
        if (dx || dy) el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`
    }, [ref, active, aTop, aBottom])
}
