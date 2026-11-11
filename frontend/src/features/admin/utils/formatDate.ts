import i18n from '@/i18n'
import { parseServerDate } from '@/lib/utils'

/**
 * 後台表格的時間：月/日 時:分，跟著目前介面語言（中文顯示上午／下午、英文顯示 AM／PM）。
 * 沒有值時回傳「-」。總覽、稽核、使用者共用。
 */
export function formatDate(value?: string): string {
    if (!value) return '-'
    return parseServerDate(value).toLocaleString(i18n.language || undefined, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
