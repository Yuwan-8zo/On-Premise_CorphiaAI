/**
 * 換深淺色的動畫：新的顏色從按下的按鈕往外圓形擴散，蓋過整頁（使用者 2026-11-21 要求）
 * ──────────────────────────────────────────────────────────────────
 * 用 View Transition API（iOS Safari 18+／Chrome 111+）：瀏覽器在換色前後各拍一張整頁快照，
 * 新快照用 clip-path 的圓從按鈕中心長大到蓋滿畫面（半徑＝按鈕中心到最遠角的距離）。
 *   - 沒給按鈕位置（例如跟著系統自動換）：退回原本的整頁淡入淡出
 *   - 不支援的瀏覽器、使用者開了「減少動態效果」：直接換，不做動畫
 * 時間與曲線讀 base.css 的 --theme-reveal-dur／--theme-reveal-ease。
 *
 * flushSync 強制 React 同步處理狀態更新，確保拍「新」快照時畫面已經換好色。
 */
import { flushSync } from 'react-dom'

export interface RevealOrigin {
    x: number
    y: number
}

/** 按鈕中心（給 onClick 用：toggleTheme(revealFrom(e.currentTarget))） */
export const revealFrom = (el: Element): RevealOrigin => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

type ViewTransition = { ready: Promise<void>; finished: Promise<void> }
type DocWithVT = Document & { startViewTransition?: (cb: () => void) => ViewTransition }

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export function withThemeReveal(mutator: () => void, origin?: RevealOrigin) {
    const doc = typeof document !== 'undefined' ? (document as DocWithVT) : undefined
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!doc || typeof doc.startViewTransition !== 'function' || reduce) {
        mutator()
        return
    }
    const html = doc.documentElement
    // 有按鈕位置：關掉預設的淡入淡出，改成圓形擴散（見 base.css 的 html.theme-reveal）
    if (origin) html.classList.add('theme-reveal')
    const vt = doc.startViewTransition(() => flushSync(mutator))
    if (!origin) return
    const { x, y } = origin
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    vt.ready
        .then(() => {
            const dur = cssVar('--theme-reveal-dur')
            html.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
                {
                    duration: dur.endsWith('ms') ? parseFloat(dur) : parseFloat(dur) * 1000,
                    easing: cssVar('--theme-reveal-ease'),
                    pseudoElement: '::view-transition-new(root)',
                },
            )
        })
        .catch(() => undefined)
    vt.finished.finally(() => html.classList.remove('theme-reveal')).catch(() => undefined)
}
