/**
 * 長對話的閱讀進度條：聊天區頂端一條細線，長度＝捲到哪裡（0～100%）
 *
 *   - 對話夠長（內容超過 READ_MIN_SCREENS 個畫面高）才出現，短對話不需要
 *   - 像 iOS 的捲軸：捲動時浮現，停下 READ_HIDE_MS 後淡掉
 *   - 直接寫樣式（--read：0～1、data-on），捲動時不重新渲染
 *
 *   const { scrollRef, barRef } = useReadProgress()
 *   <div ref={barRef} className="read-progress" />   ← 樣式在 chat.css
 *   <div ref={scrollRef} className="chat-scroll">…</div>
 */
import { useCallback, useRef } from 'react'

const READ_MIN_SCREENS = 2
const READ_HIDE_MS = 1200

export function useReadProgress() {
    const barRef = useRef<HTMLDivElement | null>(null)
    const cleanup = useRef<(() => void) | null>(null)
    const scrollRef = useCallback((el: HTMLElement | null) => {
        cleanup.current?.()
        cleanup.current = null
        if (!el) return
        let hide = 0
        let raf = 0
        const update = () => {
            raf = 0
            const bar = barRef.current
            if (!bar) return
            const room = el.scrollHeight - el.clientHeight
            const long = el.scrollHeight > el.clientHeight * READ_MIN_SCREENS
            bar.style.setProperty('--read', long && room > 0 ? String(Math.min(1, Math.max(0, el.scrollTop / room))) : '0')
            if (!long) { delete bar.dataset.on; return }
            bar.dataset.on = ''
            window.clearTimeout(hide)
            hide = window.setTimeout(() => { delete bar.dataset.on }, READ_HIDE_MS)
        }
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
        el.addEventListener('scroll', onScroll, { passive: true })
        cleanup.current = () => {
            el.removeEventListener('scroll', onScroll)
            cancelAnimationFrame(raf)
            window.clearTimeout(hide)
        }
    }, [])
    return { scrollRef, barRef }
}
