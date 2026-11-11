import { useLayoutEffect, useRef } from 'react'

/**
 * 讓內容「剛好放進」外層：內容比外層高時，算出縮小比例寫到 --fit（樣式用 zoom 套用），不需要捲動。
 * 只在 <html> 有 enabledClass（例如折疊手機的 fold-wide）時作用；其他情況清掉 --fit＝原本大小。
 *
 * 量法：先把 --fit 設回 1，讀外層的 scrollHeight（內容實際需要的高度）與 clientHeight（可用高度），
 * 比例＝可用 ÷ 需要（最多 1）。同一個畫格裡設回去，所以看不到閃動。
 * 外層尺寸變（轉向、網址列收合）或內容變（資料載入）都會重算。
 */
export function useFitToHost<T extends HTMLElement>(enabledClass: string) {
    const ref = useRef<T>(null)

    useLayoutEffect(() => {
        const el = ref.current
        const host = el?.parentElement
        if (!el || !host) return

        const fit = () => {
            if (!document.documentElement.classList.contains(enabledClass)) {
                el.style.removeProperty('--fit')
                return
            }
            el.style.setProperty('--fit', '1')
            const need = host.scrollHeight
            const have = host.clientHeight
            el.style.setProperty('--fit', String(need > have ? have / need : 1))
        }

        fit()
        const ro = new ResizeObserver(fit)
        ro.observe(host)
        Array.from(el.children).forEach((c) => ro.observe(c))
        window.addEventListener('resize', fit)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', fit)
        }
    }, [enabledClass])

    return ref
}
