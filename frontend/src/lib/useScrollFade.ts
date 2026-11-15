/**
 * useScrollFade — 玻璃卡片裡的捲動區：上下還有內容時，邊緣淡出提示「還可以捲」（不顯示系統捲軸）
 *
 *   const ref = useScrollFade()
 *   <div className="paper overflow-hidden"><div ref={ref} className="glass-scroll">…</div></div>
 *
 * 為什麼捲動區要放在玻璃卡片「裡面」一層：卡片的光邊是畫在卡片上的一層，
 * 卡片本身捲動時光邊會跟著內容捲走，卡在畫面中間變成一條奇怪的圓角線。
 * 寫在元素的 data-fade（top／bottom／both），樣式見 details.css 的 .glass-scroll；不觸發重新渲染。
 * 回傳的是 callback ref：元素晚出現（例如抽屜打開才掛上）也接得到。
 */
import { useCallback, useRef } from 'react'

export function useScrollFade<T extends HTMLElement = HTMLDivElement>() {
    const cleanup = useRef<(() => void) | null>(null)
    return useCallback((el: T | null) => {
        cleanup.current?.()
        cleanup.current = null
        if (!el) return
        const update = () => {
            const top = el.scrollTop > 1
            const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
            const v = top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : ''
            if (v) el.dataset.fade = v
            else delete el.dataset.fade
        }
        update()
        el.addEventListener('scroll', update, { passive: true })
        const ro = new ResizeObserver(update)
        ro.observe(el)
        // 內容長短改變（例如選項載入）也要重算
        const mo = new MutationObserver(update)
        mo.observe(el, { childList: true, subtree: true })
        cleanup.current = () => {
            el.removeEventListener('scroll', update)
            ro.disconnect()
            mo.disconnect()
        }
    }, [])
}
