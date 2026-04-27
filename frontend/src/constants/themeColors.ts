/**
 * 設計系統顏色常數
 *
 * 這些值與 index.css 中的 CSS 變數同步。
 * 用於需要 JavaScript 字串的場景（meta[theme-color]、html.style.background 等）。
 * 不可用於 Tailwind className（請使用 CSS 變數 token）。
 */

export const THEME_COLORS = {
    /** 深色模式主背景 (#202022) - 與 index.css --bg-base 同步 */
    darkBg: '#202022',
    /** 深色模式背景漸層 */
    darkBgGradient: 'linear-gradient(135deg, #202022 0%, #101012 100%)',
    /** 淺色模式主背景 (#F6F4F0) - 與 index.css --bg-main 同步 */
    lightBg: '#F6F4F0',
} as const
