import tokens from './tokens.js'

export const THEME_COLORS = tokens.themeColors
export const BRAND = tokens.brandColors
export const ACCENT_COLORS = tokens.accentColors
export const PALETTE = tokens.palette
export const RADIUS = tokens.radius
export const FONT_SIZE = tokens.fontSize
export const SHADOW = tokens.boxShadow
export const MOTION = tokens.motion

export default tokens

export type ThemeColorKey = keyof typeof tokens.themeColors
export type BrandColorKey = keyof typeof tokens.brandColors
export type AccentColorKey = keyof typeof tokens.accentColors
export type RadiusKey = keyof typeof tokens.radius
export type FontSizeKey = keyof typeof tokens.fontSize
