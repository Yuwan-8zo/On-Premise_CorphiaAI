/**
 * 瀏覽器臨時資料夾：使用者用瀏覽器選這台電腦的資料夾，附給 AI 看（只附下一則訊息，不留底）
 * 和 documentsApi.upload 不一樣：那是上傳到專案資料夾、長期索引；這裡只是這一題用完就丟。
 */
import apiClient from './client'

export interface BrowserFolderSkipped {
    name: string
    reason: string
}
export interface BrowserFolderAttachResult {
    accepted: string[]
    skipped: BrowserFolderSkipped[]
    chars: number
    pii: number
}
export interface BrowserFolderPending {
    files: string[]
    chars: number
    expires_in_sec: number
}

export const browserFolderApi = {
    /** files：讀folder picker 選到的檔案（已經依副檔名、大小篩過一輪） */
    attach: async (conversationId: string, files: File[]): Promise<BrowserFolderAttachResult> => {
        const formData = new FormData()
        for (const file of files) formData.append('files', file, file.webkitRelativePath || file.name)
        const response = await apiClient.post<BrowserFolderAttachResult>(`/browser-folder/${conversationId}/attach`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    /** 還沒送出訊息前查詢目前附了什麼（重新整理頁面後用） */
    pending: async (conversationId: string): Promise<BrowserFolderPending> => {
        const response = await apiClient.get<BrowserFolderPending>(`/browser-folder/${conversationId}`)
        return response.data
    },

    /** 使用者按「移除附加」：主動取消，不用等過期 */
    cancel: async (conversationId: string): Promise<void> => {
        await apiClient.delete(`/browser-folder/${conversationId}`)
    },
}
