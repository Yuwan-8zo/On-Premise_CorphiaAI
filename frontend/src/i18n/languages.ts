/** 介面支援的語言（設定頁與登入頁共用同一份清單） */
export type Language = 'zh-TW' | 'en-US' | 'ja-JP'

export const LANGUAGES: Array<{ code: Language; label: string }> = [
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'en-US', label: 'English' },
    { code: 'ja-JP', label: '日本語' },
]
