/**
 * AI 產出的檔案（Word、Excel、簡報）：下載。後端見 backend/app/api/files.py
 */
import apiClient from './client'
import type { MessageAttachment } from '@/types/chat'

export const filesApi = {
    /** 取回檔案內容（桌面版「開啟」用） */
    fetch: async (file: MessageAttachment): Promise<Blob> =>
        (await apiClient.get(`/files/${file.id}/download`, { responseType: 'blob' })).data as Blob,

    /** 取回檔案並交給瀏覽器存檔（要帶登入憑證，所以不能用普通連結） */
    download: async (file: MessageAttachment): Promise<void> => {
        const res = await apiClient.get(`/files/${file.id}/download`, { responseType: 'blob' })
        const url = URL.createObjectURL(res.data as Blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        // 等瀏覽器開始存檔後再釋放
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
}
