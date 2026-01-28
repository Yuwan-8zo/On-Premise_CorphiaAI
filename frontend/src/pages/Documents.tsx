/**
 * 文件管理頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../store/uiStore'
import apiClient from '../api/client'

interface Document {
    id: string
    filename: string
    originalFilename: string
    fileType: string
    fileSize: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    chunkCount: number
    errorMessage?: string
    createdAt: string
    processedAt?: string
}

// Icons
const UploadIcon = () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
)

const FileIcon = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
        pdf: 'text-red-500',
        docx: 'text-blue-500',
        xlsx: 'text-green-500',
        txt: 'text-gray-500',
        md: 'text-purple-500',
    }

    return (
        <div className={`w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${colors[type] || 'text-slate-500'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
        </div>
    )
}

const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)

const StatusBadge = ({ status }: { status: Document['status'] }) => {
    const styles = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }

    const labels = {
        pending: '等待中',
        processing: '處理中',
        completed: '已完成',
        failed: '失敗',
    }

    return (
        <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status]}`}>
            {labels[status]}
        </span>
    )
}

export default function Documents() {
    const { t } = useTranslation()
    const { theme, toggleTheme } = useUIStore()

    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)

    // 載入文件列表
    const loadDocuments = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await apiClient.get('/documents')
            setDocuments(response.data.data.map((doc: Record<string, unknown>) => ({
                id: doc.id,
                filename: doc.filename,
                originalFilename: doc.original_filename,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                status: doc.status,
                chunkCount: doc.chunk_count,
                errorMessage: doc.error_message,
                createdAt: doc.created_at,
                processedAt: doc.processed_at,
            })))
        } catch (err) {
            console.error('載入文件失敗:', err)
            setError('載入文件列表失敗')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadDocuments()
    }, [loadDocuments])

    // 上傳文件
    const uploadFile = async (file: File) => {
        setIsUploading(true)
        setUploadProgress(0)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)

        try {
            await apiClient.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = progressEvent.total
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0
                    setUploadProgress(progress)
                },
            })

            // 重新載入列表
            await loadDocuments()
        } catch (err) {
            console.error('上傳失敗:', err)
            setError('文件上傳失敗')
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    // 刪除文件
    const deleteDocument = async (id: string) => {
        if (!confirm('確定要刪除此文件嗎？')) return

        try {
            await apiClient.delete(`/documents/${id}`)
            setDocuments(docs => docs.filter(d => d.id !== id))
        } catch (err) {
            console.error('刪除失敗:', err)
            setError('刪除文件失敗')
        }
    }

    // 拖放處理
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(e.dataTransfer.files[0])
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0])
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* 頂部導覽列 */}
            <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-900">
                <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
                    📁 {t('nav.documents')}
                </h1>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>
            </header>

            <div className="max-w-5xl mx-auto p-6">
                {/* 上傳區域 */}
                <div
                    className={`relative border-2 border-dashed rounded-xl p-8 mb-8 transition-colors ${dragActive
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-300 dark:border-slate-700 hover:border-primary-400'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        accept=".pdf,.docx,.xlsx,.txt,.md"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isUploading}
                    />

                    <div className="text-center">
                        <div className="text-slate-400 dark:text-slate-500 mb-4">
                            <UploadIcon />
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">
                            拖放文件到此處，或點擊選擇
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            支援 PDF、Word、Excel、TXT、Markdown
                        </p>
                    </div>

                    {/* 上傳進度 */}
                    {isUploading && (
                        <div className="mt-4">
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <p className="text-sm text-slate-500 text-center mt-2">
                                上傳中... {uploadProgress}%
                            </p>
                        </div>
                    )}
                </div>

                {/* 錯誤訊息 */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* 文件列表 */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-800 dark:text-white">
                            已上傳文件 ({documents.length})
                        </h2>
                    </div>

                    {isLoading ? (
                        <div className="p-8 text-center text-slate-500">
                            載入中...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            尚無上傳的文件
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {documents.map(doc => (
                                <div key={doc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <FileIcon type={doc.fileType} />

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-white truncate">
                                            {doc.originalFilename}
                                        </p>
                                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                            <span>{formatFileSize(doc.fileSize)}</span>
                                            <span>•</span>
                                            <span>{doc.chunkCount} 分塊</span>
                                            <span>•</span>
                                            <span>{new Date(doc.createdAt).toLocaleDateString('zh-TW')}</span>
                                        </div>
                                    </div>

                                    <StatusBadge status={doc.status} />

                                    <button
                                        onClick={() => deleteDocument(doc.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="刪除"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
