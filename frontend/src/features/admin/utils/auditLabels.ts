/**
 * 稽核代碼 → 顯示文字（表格、細節、篩選選單、總覽圖表共用）；沒有翻譯的代碼直接顯示原文
 */
import type { TFunction } from 'i18next'

export const auditActionLabel = (t: TFunction, action: string): string =>
    t(`admin.audit.actionTypes.${action}`, { defaultValue: action })

export const auditResourceLabel = (t: TFunction, resource: string): string =>
    t(`admin.audit.resourceTypes.${resource}`, { defaultValue: resource })
