/**
 * 畫面轉場（View Transition API）共用：同一個元素在更新前後「變形」過去（例如縮圖放大成全螢幕）
 *
 *   morph(update)        在轉場裡執行 update（flushSync，拍新快照時畫面已經換好）
 *   supportsMorph()      瀏覽器支援、而且使用者沒開「減少動態效果」
 *
 * 要變形的兩個元素在「前」「後」各自掛同一個 view-transition-name（同一時間只能有一個元素用那個名字）。
 * 不支援的瀏覽器直接更新，不做動畫。換深淺色的圓形擴散另外在 lib/themeReveal。
 */
import { flushSync } from 'react-dom'
import { prefersReducedMotion } from './reducedMotion'

type ViewTransition = { finished: Promise<void> }
type DocWithVT = Document & { startViewTransition?: (cb: () => void) => ViewTransition }

export function supportsMorph(): boolean {
    return typeof document !== 'undefined' && typeof (document as DocWithVT).startViewTransition === 'function' && !prefersReducedMotion()
}

export function morph(update: () => void): Promise<void> {
    if (!supportsMorph()) {
        update()
        return Promise.resolve()
    }
    const vt = (document as DocWithVT).startViewTransition!(() => flushSync(update))
    return vt.finished.catch(() => undefined)
}
