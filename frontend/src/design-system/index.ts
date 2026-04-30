/**
 * Corphia 設計系統 — TS 入口
 * ==========================================================
 *
 * UI 程式碼一律從這個檔 import token。
 * 真正的值在 ./tokens.js（單一資料來源），這裡只做型別封裝與 re-export。
 *
 *   import { THEME_COLORS, BRAND } from '@/design-system'
 *
 * 為什麼有兩層：tokens.js 同時要被 tailwind.config.js (Node ESM)
 * 跟 TS 程式碼讀，所以值必須是純 JS；型別資訊只給 TS 用。
 */

import tokens from './tokens.js'

/** 主題背景色（給 meta[theme-color]、html.style.background 用） */
export const THEME_COLORS = tokens.themeColors

/** 品牌色（hex 字串） */
export const BRAND = tokens.brandColors

/** 圓角 token 表（key 對應 Tailwind className 的後綴） */
export const RADIUS = tokens.radius

/** 字級 token 表（key 對應 Tailwind className 的後綴） */
export const FONT_SIZE = tokens.fontSize

// 預設匯出整包，必要時可以一次拿全部
export default tokens

// 型別匯出（讓使用端可以做 keyof）
export type ThemeColorKey = keyof typeof tokens.themeColors
export type BrandColorKey = keyof typeof tokens.brandColors
export type RadiusKey = keyof typeof tokens.radius
export type FontSizeKey = keyof typeof tokens.fontSize
