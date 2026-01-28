/**
 * 文件 API
 */

import apiClient from './client'
import type {
    Document,
    DocumentListResponse,
    DocumentUploadResponse
} from '../types/document'

export const documentsApi = {
    /**
     * 取得文件列表
     */
    list: async (page: number = 1, pageSize: number = 20, search?: string): Promise<DocumentListResponse> => {
        const response = await apiClient.get('/documents', {
            params: {
                page,
                page_size: pageSize,
                search
            },
        })
        return response.data
    },

    /**
     * 上傳文件
     */
    upload: async (file: File): Promise<DocumentUploadResponse> => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await apiClient.post('/documents/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    /**
     * 刪除文件
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/documents/${id}`)
    },
}
