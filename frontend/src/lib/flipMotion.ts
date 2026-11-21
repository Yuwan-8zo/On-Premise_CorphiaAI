/**
 * 只用 transform／clip-path 的過場（不動寬高，瀏覽器不用每一格重排版面）
 *
 *   版面一次切到新的大小，再用「從舊位置滑回來」（FLIP）或「從舊範圍露出來」（clip-path）把過程補上；
 *   看起來和以前直接動寬高一樣，但每一格只需要合成，不用重新排整個聊天區。
 *   時間、曲線讀 styles 的設定（--duration-medium、--ease-out），使用者開「減少動態效果」就不播。
 */
import { readMs } from '@/lib/cssVars'

export function reduceMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 和以前的寬高過渡同一組時間與曲線 */
export function morphTiming(): KeyframeAnimationOptions {
    const ease = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()
    return { duration: readMs('--duration-medium') || 300, easing: ease || 'ease-out' }
}

/** 從 x 位移滑回原位（元素已經在新位置） */
export function slideFromX(els: Iterable<Element>, dx: number) {
    if (!dx || reduceMotion()) return
    const timing = morphTiming()
    for (const el of els) {
        if (typeof (el as HTMLElement).animate === 'function') {
            (el as HTMLElement).animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], timing)
        }
    }
}
