/**
 * Corphia 設計系統 — 單一資料來源 (Single Source of Truth)
 * ==========================================================
 *
 * 這個檔案是「所有 design token 的唯一定義來源」。
 *
 *   tailwind.config.js  ─┐
 *                        ├──▶  從這個檔案 import
 *   TS 程式碼            ─┘    （透過 design-system/index.ts）
 *
 * 為什麼用 .js 而不是 .ts：
 *   tailwind.config.js 是 PostCSS 在 build 時讀的，它沒有 TS compiler；
 *   所以 token 的 source 必須是純 JS。TS 那邊有 design-system/index.ts
 *   做型別封裝，UI 程式碼一律從那邊 import，不直接碰這個檔。
 *
 * 修改規則：
 *   1. 改值就在這裡改，整個 App 視覺會跟著變。
 *   2. **不要在 .tsx 裡面寫 hex 色碼或 px 數值**，永遠用 token。
 *   3. 新增 token 要同步寫進 design-system/README.md 的對照表。
 */

// ── 圓角 ────────────────────────────────────────────────
// `cv-` 前綴避免跟 Tailwind 內建 rounded-{r,t,b,l}- 衝突。
export const radius = {
    pill: '9999px',
    'cv-xs': '6px',
    'cv-sm': '10px',
    'cv-md': '14px',
    'cv-lg': '20px',
    'cv-xl': '24px',
    'cv-2xl': '32px',
    // 既有 token，向下相容
    'card-sm': '22px',
    'card-md': '30px',
    'card-lg': '34px',
    'card-xl': '38px',
}

// ── 字級 ────────────────────────────────────────────────
// [字級, line-height]，line-height 也綁進 token 裡，避免再寫 leading-*
export const fontSize = {
    caption: ['12px', '16px'],
    'body-sm': ['13px', '18px'],
    body: ['14px', '20px'],
    'body-lg': ['16px', '24px'],
    'title-sm': ['18px', '24px'],
    title: ['22px', '28px'],
    display: ['36px', '44px'],
}

// ── 主題色（背景 / surface）───────────────────────────────
// 與 src/index.css 的 --bg-base / --bg-surface 同步。
// 用於 JS 字串場景（meta[theme-color]、html.style.background…）。
export const themeColors = {
    /** 深色主背景，與 --bg-base 同步 */
    darkBg: '#202022',
    /** 深色 surface，與 --bg-surface 同步 */
    darkSurface: '#28282A',
    /** 深色背景漸層 */
    darkBgGradient: 'linear-gradient(135deg, #202022 0%, #101012 100%)',
    /** 淺色主背景，與 --bg-main 同步 */
    lightBg: '#F6F4F0',
    /** 淺色 surface，與 --bg-surface 同步 */
    lightSurface: '#F2EFEA',
}

// ── 品牌色（accent / corphia）────────────────────────────
export const brandColors = {
    bronze: '#896E53',
    bronzeHover: '#6F5943',
    bronzeActive: '#574537',
}

// 預設匯出方便 tailwind.config.js 一次取用所有
export default { radius, fontSize, themeColors, brandColors }
