import { useLayoutEffect, useRef } from 'react'

/**
 * 整頁「剛好放進一個畫面」：裡面標了 data-fit-check 的區塊（例如左側欄、內容區）只要有一個比自己的高度多出內容，
 * 就算出縮小比例寫到 --fit（樣式用 zoom 套用到整頁），不需要捲動、也不會被裁。
 * 只在元素的 CSS 變數 --fit-on 為 1 時作用（由樣式決定，例如 Tailwind 的 lg:[--fit-on:1]，
 * 這樣斷點只寫在 Tailwind 一個地方）；其他情況清掉 --fit＝原本大小、照常捲動。
 *
 * 量法：先把 --fit 設回 1，多出來的高度＝整頁被撐出去的部分（例如左側欄比畫面高）＋各區塊內部放不下的最大值；
 * 比例＝可用高度 ÷（可用高度＋多出來的高度）。縮放後寬度變寬、排版會變，所以縮完再量，
 * 還放不下就繼續縮（最多幾次）。同一個畫格裡完成，看不到閃動。
 * 視窗大小、轉向、網址列收合、切換分頁、資料載入都會重算。
 */
export function useFitToHost<T extends HTMLElement>() {
    const ref = useRef<T>(null)

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return

        let frame = 0
        const fit = () => {
            frame = 0
            if (getComputedStyle(el).getPropertyValue('--fit-on').trim() !== '1') {
                el.style.removeProperty('--fit')
                return
            }
            const checks = () => Array.from(el.querySelectorAll<HTMLElement>('[data-fit-check]'))
            // 被撐出去的部分：區塊底邊超過「整頁底邊扣掉內距」多少（以縮放後的單位換算）
            const pushedOut = () => {
                const z = parseFloat(el.style.getPropertyValue('--fit')) || 1
                const limit = el.getBoundingClientRect().bottom - parseFloat(getComputedStyle(el).paddingBottom) * z
                return Math.max(0, ...checks().map((c) => c.getBoundingClientRect().bottom - limit)) / z
            }
            const overflow = () => pushedOut() + Math.max(0, ...checks().map((c) => c.scrollHeight - c.clientHeight))
            let scale = 1
            el.style.setProperty('--fit', '1')
            for (let i = 0; i < 4; i++) {
                const extra = overflow()
                if (extra <= 1) break // 差 1px 以內視為放得下（小數點進位造成的誤差）
                const have = el.clientHeight
                scale *= have / (have + extra)
                el.style.setProperty('--fit', String(scale))
            }
        }
        const schedule = () => { if (!frame) frame = requestAnimationFrame(fit) }

        fit()
        const ro = new ResizeObserver(schedule)
        ro.observe(el)
        const mo = new MutationObserver(schedule) // 切換分頁、資料載入、文字更新
        mo.observe(el, { childList: true, subtree: true, characterData: true })
        window.addEventListener('resize', schedule)
        return () => {
            ro.disconnect()
            mo.disconnect()
            window.removeEventListener('resize', schedule)
            if (frame) cancelAnimationFrame(frame)
        }
    }, [])

    return ref
}
