/**
 * 對話預設標題（全站共用）
 *   存進資料庫的值固定是「新對話」：送出第一句話時用它判斷要不要自動改標題，所以不能跟著語言變。
 *   顯示時才翻成目前語言（displayTitle）。
 */
import i18n from '@/i18n'

export const DEFAULT_CONVERSATION_TITLE = '新對話'

/** 給畫面顯示的標題：預設標題翻成目前語言，使用者取的名字原樣顯示 */
export function displayTitle(title: string | null | undefined): string {
    return !title || title === DEFAULT_CONVERSATION_TITLE ? i18n.t('chat.newChat') : title
}
