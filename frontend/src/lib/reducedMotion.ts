/**
 * 系統「減少動態效果」（prefers-reduced-motion）：全站共用的判斷，各元件不要自己寫 matchMedia。
 *   prefersReducedMotion()：現在是否開啟
 *   stripForReducedMotion(vars)：開啟時拿掉位移與縮放，只留淡入淡出（規範：換頁只留淡入淡出）
 */
export function prefersReducedMotion() {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const REDUCED_KEYS = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotation', 'xPercent', 'yPercent']

export function stripForReducedMotion<T extends Record<string, unknown> | undefined>(vars: T): T {
    if (!vars || !prefersReducedMotion()) return vars
    const out = { ...vars } as Record<string, unknown>
    for (const k of REDUCED_KEYS) delete out[k]
    return out as T
}
