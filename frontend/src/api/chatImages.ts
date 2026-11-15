/**
 * 聊天附圖片：把圖片附給下一則訊息，請 AI 看圖回答。
 * 圖片上傳到公司的主機、由主機上的圖文模型讀，不會送到任何外部服務。
 */
import apiClient from './client'

export interface VisionStatus {
    /** 這台主機能不能看圖（有沒有裝圖文模型）；不能就不顯示附圖的入口 */
    enabled: boolean
    /** 一則訊息最多幾張 */
    max_images: number
    /** 單張上限（MB） */
    max_mb: number
}

export interface ChatImageAttachResult {
    /** 目前附著的所有圖片編號（包含之前附的） */
    images: string[]
    skipped: Array<{ name: string; reason: string }>
}

export const chatImagesApi = {
    status: async (): Promise<VisionStatus> => (await apiClient.get<VisionStatus>('/chat-images/status')).data,

    attach: async (conversationId: string, files: File[]): Promise<ChatImageAttachResult> => {
        const form = new FormData()
        for (const file of files) form.append('files', file, file.name || 'image.png')
        const response = await apiClient.post<ChatImageAttachResult>(`/chat-images/${conversationId}/attach`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    /** 還沒送出前目前附了哪些（重新整理頁面後用） */
    pending: async (conversationId: string): Promise<string[]> =>
        (await apiClient.get<{ images: string[] }>(`/chat-images/${conversationId}`)).data.images,

    cancel: async (conversationId: string): Promise<void> => {
        await apiClient.delete(`/chat-images/${conversationId}`)
    },

    /** 讀一張圖（要帶登入憑證，所以不能直接當成 img 的網址；拿回來的內容由呼叫端轉成暫時的網址） */
    fetch: async (conversationId: string, imageId: string): Promise<Blob> =>
        (await apiClient.get<Blob>(`/chat-images/${conversationId}/${imageId}`, { responseType: 'blob' })).data,
}
