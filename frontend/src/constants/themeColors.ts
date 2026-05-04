/**
 * 設計系統顏色常數（向下相容包裝）
 * ==========================================================
 *
 * NOTE: 真正的定義在 src/design-system/tokens.js（單一資料來源）。
 * 這個檔保留只是為了不破壞既有 `import { THEME_COLORS } from '...constants/themeColors'`
 * 的引用路徑。新程式碼建議改 import 自 '@/design-system'：
 *
 *   import { THEME_COLORS } from '@/design-system'
 */

export { THEME_COLORS } from '../design-system'
