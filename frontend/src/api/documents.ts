import apiClient from './client'
import { AxiosProgressEvent } from 'axios'

export interface DocumentResponse {
    id: string
    filename: string
    content_type: string
    size_bytes: number
    status: string
    doc_metadata?: Record<string, unknown>
    created_at: string
}

export const documentsApi = {
    // 列表 - 回傳 { data: DocumentResponse[], total: number }，與後端 DocumentListResponse schema 一致
    list: async (): Promise<{ data: DocumentResponse[], total: number }> => {
        const response = await apiClient.get('/documents')
        // BUG-09 修正：後端固定回傳 {data: [], total: number}，此處不需要條件判斷
        return response.data
    },

    // 上傳檔案（帶有專案資料夾分離）
    upload: async (file: File, folderName?: string, onUploadProgress?: (progressEvent: AxiosProgressEvent) => void) => {
        const formData = new FormData()
        formData.append('file', file)
        if (folderName) {
            formData.append('folderName', folderName)
        }

        const response = await apiClient.post('/documents/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress,
        })
        return response.data
    },

    // 刪除檔案
    delete: async (id: string) => {
        await apiClient.delete(`/documents/${id}`)
    },
    
    // 更新 metadata (例如啟用/停用引用)
    updateMetadata: async (id: string, metadata: Record<string, unknown>) => {
        const response = await apiClient.patch(`/documents/${id}/metadata`, {
            doc_metadata: metadata
        })
        return response.data
    }
}
