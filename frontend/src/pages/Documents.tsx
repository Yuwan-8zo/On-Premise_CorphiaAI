/**
 * 文件管理頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
    ArrowUpTrayIcon,
    TrashIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

import { documentsApi } from '../api/documents'
import type { Document } from '../types/document'

export default function Documents() {
    const { t } = useTranslation()
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [search, setSearch] = useState('')

    // 載入文件列表
    const loadDocuments = useCallback(async () => {
        try {
            setLoading(true)
            const data = await documentsApi.list(1, 100, search)
            setDocuments(data.data)
        } catch (error) {
            console.error('Failed to load documents:', error)
        } finally {
            setLoading(false)
        }
    }, [search])

    useEffect(() => {
        loadDocuments()
    }, [loadDocuments])

    // 處理檔案上傳
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            await documentsApi.upload(file)
            // 上傳後重新載入列表
            await loadDocuments()
            alert('文件上傳成功，正在背景處理中...')
        } catch (error) {
            console.error('Upload failed:', error)
            alert(t('errors.serverError'))
        } finally {
            setUploading(false)
            // 清空 input 讓同一檔案可再選
            e.target.value = ''
        }
    }

    // 處理刪除
    const handleDelete = async (id: string, filename: string) => {
        if (confirm(`${t('common.delete')} ${filename}?`)) {
            try {
                await documentsApi.delete(id)
                setDocuments(docs => docs.filter(d => d.id !== id))
            } catch (error) {
                console.error('Delete failed:', error)
                alert(t('errors.serverError'))
            }
        }
    }

    // 狀態標籤樣式
    const getStatusBadge = (status: string) => {
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
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        )
    }

    return (
        <div className="h-full flex flex-col p-6 max-w-6xl mx-auto w-full">
            {/* 標題與操作區 */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {t('nav.documents')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        管理您的知識庫文件，支援 PDF、Word、TXT
                    </p>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    {/* 搜尋框 */}
                    <div className="relative flex-1 sm:w-64">
                        <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 
                       bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* 上傳按鈕 */}
                    <label className={`
            flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 
            text-white rounded-lg cursor-pointer transition-colors whitespace-nowrap
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}>
                        <input
                            type="file"
                            onChange={handleUpload}
                            disabled={uploading}
                            accept=".pdf,.docx,.txt,.md"
                            className="hidden"
                        />
                        {uploading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <ArrowUpTrayIcon className="w-5 h-5" />
                        )}
                        <span>上傳文件</span>
                    </label>
                </div>
            </div>

            {/* 文件列表 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">當案名稱</th>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">大小</th>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">狀態</th>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">分塊數</th>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">上傳時間</th>
                                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <DocumentTextIcon className="w-12 h-12 stroke-1" />
                                            <p>尚無文件，請上傳第一份文件</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <DocumentTextIcon className="w-8 h-8 text-primary-500 bg-primary-50 dark:bg-primary-900/20 p-1.5 rounded-lg" />
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                                                        {doc.filename}
                                                    </p>
                                                    {doc.errorMessage && (
                                                        <p className="text-xs text-red-500 mt-0.5 truncate max-w-[200px]">
                                                            {doc.errorMessage}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {(doc.fileSize / 1024).toFixed(1)} KB
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(doc.status)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {doc.chunkCount}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                            {new Date(doc.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(doc.id, doc.filename)}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                title={t('common.delete')}
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
