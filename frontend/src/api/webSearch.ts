/**
 * 對外搜尋：唯一讀用途的端點，前端用它決定要不要先跟使用者確認搜尋關鍵字再送出。
 * 真正執行搜尋走既有的送訊息流程（帶 web_search: true），不是這裡。
 */
import apiClient from './client'

export interface WebSearchPolicy {
    /** 後端有沒有開這個功能（enable_web_search） */
    enabled: boolean
    /** 這個租戶是否設成「自動搜尋」（不用每次先問使用者） */
    auto: boolean
}

export const webSearchApi = {
    policy: async (): Promise<WebSearchPolicy> => {
        const response = await apiClient.get<WebSearchPolicy>('/web-search/policy')
        return response.data
    },
}
