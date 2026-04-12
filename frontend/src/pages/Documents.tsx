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
        <div className={`w-10 h-10 rounded-[16px] bg-ios-light-gray5 dark:bg-ios-dark-gray6 flex items-center justify-center ${colors[type] || 'text-gray-500'}`}>
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
        pending: 'bg-yellow-100/50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20',
        processing: 'bg-ios-blue-light/10 text-ios-blue-light dark:bg-ios-blue-dark/20 dark:text-ios-blue-light border border-blue-200 dark:border-ios-blue-dark/30',
        completed: 'bg-green-100/50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20',
        failed: 'bg-red-100/50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20',
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
    const { theme, toggleTheme, showConfirm } = useUIStore()

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
        showConfirm(t('common.confirmDelete'), async () => {
            try {
                await apiClient.delete(`/documents/${id}`)
                setDocuments(docs => docs.filter(d => d.id !== id))
            } catch (err) {
                console.error('刪除失敗:', err)
                setError('刪除文件失敗')
            }
        })
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
        <div className="min-h-screen bg-ios-light-gray6 dark:bg-ios-dark-gray6 transition-colors duration-300">
            {/* 頂部導覽列 */}
            <header className="h-[80px] border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-8 bg-white/95 dark:bg-ios-dark-gray6/95 backdrop-blur-md transition-colors sticky top-0 z-10">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-wide">
                    📁 {t('nav.documents')}
                </h1>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-ios-dark-gray4 rounded-full transition-colors"
                >
                    {theme === 'dark' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929M12 17a5 5 0 100-10 5 5 0 000 10z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
            </header>

            <div className="max-w-5xl mx-auto p-8 pt-10">
                {/* 上傳區域 */}
                <div
                    className={`relative border-2 border-dashed rounded-[20px] p-10 mb-10 transition-colors bg-white dark:bg-ios-dark-gray5 ${dragActive
                            ? 'border-ios-blue-light bg-ios-blue-light/5 dark:bg-ios-blue-dark/10'
                            : 'border-gray-300 dark:border-white/5 hover:border-ios-blue-light/50 dark:hover:border-ios-blue-dark/50'
                        } shadow-sm dark:shadow-none`}
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

                    <div className="text-center flex flex-col items-center">
                        <div className="text-ios-blue-light dark:text-ios-blue-dark mb-4">
                            <UploadIcon />
                        </div>
                        <p className="text-gray-900 dark:text-gray-100 font-medium mb-2 text-lg">
                            拖放文件到此處，或點擊選擇
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            支援 PDF、Word、Excel、TXT、Markdown
                        </p>
                    </div>

                    {/* 上傳進度 */}
                    {isUploading && (
                        <div className="mt-6 max-w-md mx-auto">
                            <div className="h-2 bg-gray-100 dark:bg-ios-dark-gray6 rounded-full overflow-hidden border border-gray-200 dark:border-white/5">
                                <div
                                    className="h-full bg-ios-blue-light dark:bg-ios-blue-dark transition-all duration-300 relative"
                                    style={{ width: `${uploadProgress}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
                                上傳中... {uploadProgress}%
                            </p>
                        </div>
                    )}
                </div>

                {/* 錯誤訊息 */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-[20px] text-red-600 dark:text-red-400 shadow-sm">
                        {error}
                    </div>
                )}

                {/* 文件列表 */}
                <div className="bg-white dark:bg-ios-dark-gray5 rounded-[20px] border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="px-8 py-5 border-b border-gray-200 dark:border-white/5">
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            已上傳文件 ({documents.length})
                        </h2>
                    </div>

                    {isLoading ? (
                        <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                            載入中...
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                            尚無上傳的文件
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-white/5">
                            {documents.map(doc => (
                                <div key={doc.id} className="px-8 py-5 flex items-center gap-5 hover:bg-gray-50 dark:hover:bg-ios-dark-gray4 transition-colors">
                                    <FileIcon type={doc.fileType} />

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[15px] text-gray-900 dark:text-white truncate mb-0.5">
                                            {doc.originalFilename}
                                        </p>
                                        <div className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400">
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
                                        className="p-2 md:p-2.5 ml-4 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
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
