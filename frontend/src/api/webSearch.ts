/**
 * 對外搜尋：唯一讀用途的端點，前端用它決定看不看得到連網相關的操作（每則回答下面的「連網重答」）。
 * 要不要查由後端決定（需要即時資訊才查，見後端 services/web_search_policy），不是這裡。
 */
import apiClient from './client'

/** 管理者的政策：auto＝需要即時資訊時自動查、ask＝不自動查（可以按連網重答）、off＝完全不連外網 */
export const WEB_SEARCH_MODES = ['auto', 'ask', 'off'] as const
export type WebSearchMode = (typeof WEB_SEARCH_MODES)[number]

export interface WebSearchPolicy {
    /** 使用者這邊可不可以連網（系統有開、而且政策不是 off） */
    enabled: boolean
    mode: WebSearchMode
}

/** 租戶設定 → 政策（跟後端 mode_from_settings 同一套規則：舊的 web_search_auto 真＝auto、假＝ask，都沒設＝auto） */
export function webSearchModeOf(settings?: Record<string, unknown> | null): WebSearchMode {
    const mode = settings?.web_search_mode
    if (WEB_SEARCH_MODES.includes(mode as WebSearchMode)) return mode as WebSearchMode
    if (settings && 'web_search_auto' in settings) return settings.web_search_auto ? 'auto' : 'ask'
    return 'auto'
}

export const webSearchApi = {
    policy: async (): Promise<WebSearchPolicy> => {
        const response = await apiClient.get<WebSearchPolicy>('/web-search/policy')
        return response.data
    },
}
