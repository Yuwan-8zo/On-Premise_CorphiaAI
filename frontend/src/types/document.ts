/**
 * 文件相關類型定義
 */

export interface Document {
    id: string
    filename: string
    originalFilename: string
    fileType: string
    fileSize: number
    uploadedBy: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    errorMessage?: string
    chunkCount: number
    createdAt: string
    processedAt?: string
}

export interface DocumentListResponse {
    data: Document[]
    total: number
}

export interface DocumentUploadResponse {
    id: string
    filename: string
    status: string
    message: string
}
