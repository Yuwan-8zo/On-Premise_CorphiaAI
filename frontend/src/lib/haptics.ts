/**
 * 手機觸覺回饋（輕輕震一下）——全站共用，各元件不要自己呼叫 navigator.vibrate
 *
 *   haptic('tap')      一般點按：送出、切換開關、長按選單打開
 *   haptic('success')  完成：複製、上傳好了
 *   haptic('warn')     要注意：刪除、被攔截
 *
 * 只在觸控裝置上作用（有滑鼠的電腦不震）；系統開了「減少動態效果」也不震。
 *   - Android Chrome：navigator.vibrate(毫秒)
 *   - iPhone Safari（18 以後）：沒有 vibrate，但點一下「開關樣式的核取方塊」的標籤時系統會給觸覺回饋，
 *     所以放一顆看不見的 <input type="checkbox" switch> 借用它（Safari 以外的瀏覽器點了沒有任何作用）
 */
import { prefersReducedMotion } from './reducedMotion'
import { MQ_HOVER } from './useMediaQuery'

export type HapticKind = 'tap' | 'success' | 'warn'

/** 每一種回饋的震動模式（毫秒；陣列＝震、停、震） */
const PATTERN: Record<HapticKind, number | number[]> = {
    tap: 8,
    success: [10, 40, 10],
    warn: [18, 50, 18],
}

let iosLabel: HTMLLabelElement | null = null

function iosTick() {
    if (!iosLabel) {
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.setAttribute('switch', '')
        input.id = 'corphia-haptic'
        input.tabIndex = -1
        input.setAttribute('aria-hidden', 'true')
        iosLabel = document.createElement('label')
        iosLabel.htmlFor = input.id
        iosLabel.setAttribute('aria-hidden', 'true')
        for (const el of [input, iosLabel]) {
            el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px'
            document.body.appendChild(el)
        }
    }
    iosLabel.click()
}

export function haptic(kind: HapticKind = 'tap') {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    try {
        if (window.matchMedia(MQ_HOVER)?.matches || prefersReducedMotion()) return
        if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(PATTERN[kind])
            return
        }
        iosTick()
    } catch {
        // 震不了就算了：觸覺回饋只是加分，不能讓按鈕本身失效
    }
}
