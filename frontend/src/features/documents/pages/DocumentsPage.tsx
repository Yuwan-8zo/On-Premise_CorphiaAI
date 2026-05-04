/**
 * 文件管理頁面
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { documentsApi } from '@/api/documents'
import MaterialIcon from '@/components/icons/MaterialIcon'

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
        doc: 'text-blue-500',
        xlsx: 'text-green-500',
        xls: 'text-green-500',
        pptx: 'text-orange-500',
        ppt: 'text-orange-500',
        txt: 'text-text-secondary',
        md: 'text-text-secondary',
    }

    return (
        <div className={`w-10 h-10 rounded-[16px] bg-bg-surface  flex items-center justify-center ${colors[type] || 'text-text-secondary'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 14H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
        </div>
    )
}

// 副檔名白名單 — 跟後端能成功解析的格式對齊。
// 舊版 office 格式 (.doc / .xls / .ppt) 後端會拒絕（python-pptx / python-docx 解析
// 不穩或不支援），這邊就不放進 accept 讓使用者能選到。
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.md']
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')

/**
 * 多檔上傳佇列的單筆狀態
 *
 * 為什麼要把 progress / status / error 攤在 item 上而不是用一個全域變數：
 *   - 上傳是並行的（CONCURRENCY=3），每筆有自己的進度
 *   - 任何一筆失敗都不該影響其他筆
 *   - UI 要逐筆畫一條進度條，需要 stable id 對應 React key
 */
interface UploadItem {
    id: string
    file: File
    progress: number  // 0-100
    status: 'queued' | 'uploading' | 'completed' | 'failed'
    error?: string
}

const UPLOAD_CONCURRENCY = 3

function getExtension(name: string): string {
    const idx = name.lastIndexOf('.')
    return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function isAcceptedFile(file: File): boolean {
    return ACCEPTED_EXTENSIONS.includes(getExtension(file.name))
}

const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)

const StatusBadge = ({ status }: { status: Document['status'] }) => {
    const styles = {
        pending: 'bg-yellow-100/50 text-yellow-700  border border-yellow-200',
        processing: 'bg-accent text-corphia-bronze  border border-border-subtle',
        completed: 'bg-green-100/50 text-green-700  border border-green-200',
        failed: 'bg-red-100/50 text-red-700  border border-red-200',
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
    const { t, i18n } = useTranslation()
    const { theme, toggleTheme, showConfirm } = useUIStore()

    const [documents, setDocuments] = useState<Document[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
    const [error, setError] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // 是否還有檔案正在上傳（給 input disabled / drop zone 樣式判斷用）
    const isUploading = uploadQueue.some(
        (item) => item.status === 'queued' || item.status === 'uploading',
    )

    /** 依當前語系決定要下載的範例檔 */
    const sampleHref = (() => {
        const lang = i18n.language || 'zh-TW'
        if (lang.startsWith('en')) return '/samples/sample-en.md'
        if (lang.startsWith('ja')) return '/samples/sample-ja.md'
        return '/samples/sample-zh.md'
    })()

    /** 依檔名搜尋過濾的結果 */
    const visibleDocuments = searchQuery.trim()
        ? documents.filter((d) =>
              d.originalFilename.toLowerCase().includes(searchQuery.trim().toLowerCase())
          )
        : documents

    // 載入文件列表
    const loadDocuments = useCallback(async () => {
        setIsLoading(true)
        try {
            const result = await documentsApi.list()
            setDocuments(result.data.map((doc) => ({
                id: doc.id,
                filename: doc.filename,
                originalFilename: doc.original_filename,
                fileType: doc.file_type,
                fileSize: doc.file_size,
                status: doc.status,
                chunkCount: doc.chunk_count,
                errorMessage: doc.error_message ?? undefined,
                createdAt: doc.created_at,
                processedAt: doc.processed_at ?? undefined,
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

    /**
     * 把 N 個檔案丟進上傳佇列並開始處理。
     *
     * 行為：
     *   1) 先把選中的檔案分成「副檔名合法」和「不合法」兩堆，不合法的直接退掉並提示
     *   2) 合法的給每筆配 id，初始 status='queued'，加進 uploadQueue
     *   3) 起 UPLOAD_CONCURRENCY 個 worker 從佇列搶檔案來上傳
     *   4) 每筆獨立追蹤進度與錯誤，互不影響
     *   5) 全部結束後 reload 文件列表，並把 'completed' 的條目延遲 4 秒淡出
     *      （'failed' 的留著讓使用者看到原因，要手動關才會消）
     */
    const enqueueUploads = useCallback(
        async (files: File[]) => {
            if (files.length === 0) return
            setError(null)

            // 先過濾副檔名
            const accepted: File[] = []
            const rejected: File[] = []
            for (const f of files) {
                if (isAcceptedFile(f)) accepted.push(f)
                else rejected.push(f)
            }
            if (rejected.length > 0) {
                const names = rejected.map((f) => f.name).join('、')
                setError(`不支援的檔案類型：${names}`)
            }
            if (accepted.length === 0) return

            // 為每筆配 id 並加進佇列
            const newItems: UploadItem[] = accepted.map((file) => ({
                id:
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                progress: 0,
                status: 'queued',
            }))
            setUploadQueue((prev) => [...prev, ...newItems])

            // 提取 setUploadQueue 用的 helper：依 id 局部更新某 item
            const patchItem = (id: string, patch: Partial<UploadItem>) => {
                setUploadQueue((prev) =>
                    prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
                )
            }

            // 用 shift 模擬 queue，多個 worker 並行搶
            const workQueue = [...newItems]
            const workerLoop = async () => {
                while (true) {
                    const item = workQueue.shift()
                    if (!item) return
                    patchItem(item.id, { status: 'uploading', progress: 0 })
                    try {
                        await documentsApi.upload(item.file, undefined, (e) => {
                            const pct = e.total
                                ? Math.round((e.loaded * 100) / e.total)
                                : 0
                            patchItem(item.id, { progress: pct })
                        })
                        patchItem(item.id, { status: 'completed', progress: 100 })
                    } catch (err: unknown) {
                        const axiosErr = err as { response?: { data?: { detail?: string } } }
                        const msg =
                            axiosErr?.response?.data?.detail ||
                            (err instanceof Error ? err.message : '上傳失敗')
                        patchItem(item.id, { status: 'failed', error: msg })
                        console.error(`上傳失敗 [${item.file.name}]:`, err)
                    }
                }
            }

            // 開 N 個 worker
            await Promise.all(
                Array.from(
                    { length: Math.min(UPLOAD_CONCURRENCY, newItems.length) },
                    () => workerLoop(),
                ),
            )

            // 全部跑完 → 重新拉一次列表
            await loadDocuments()

            // 4 秒後淡出已完成的；失敗的保留讓使用者看
            setTimeout(() => {
                setUploadQueue((prev) =>
                    prev.filter((it) => it.status !== 'completed'),
                )
            }, 4000)
        },
        [loadDocuments],
    )

    /** 移除佇列中某筆（用於失敗後手動 dismiss） */
    const dismissUpload = (id: string) => {
        setUploadQueue((prev) => prev.filter((it) => it.id !== id))
    }

    // 刪除文件
    const deleteDocument = async (id: string) => {
        showConfirm(t('common.confirmDelete'), async () => {
            try {
                await documentsApi.delete(id)
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

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            enqueueUploads(Array.from(e.dataTransfer.files))
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            enqueueUploads(Array.from(e.target.files))
            // reset input value so the same file can be re-selected later
            e.target.value = ''
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    return (
        <div
            className="min-h-[100dvh] bg-bg-base transition-colors duration-300 relative"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            {/* 背景弧線 SVG —— 跟登入/Admin/Chat 同款 */}
            <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02] transition-colors duration-300" d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03] transition-colors duration-300" d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.02] dark:opacity-[0.01] transition-colors duration-300" d="M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z" />
                </svg>
            </div>
            {/* 頂部導覽列 —— 玻璃感 sticky bar */}
            <header className="relative z-10 h-16 sm:h-[80px] border-b border-white/40 dark:border-white/10 flex items-center justify-between px-4 sm:px-8 bg-bg-base/70 supports-[backdrop-filter]:bg-bg-base/55 backdrop-blur-2xl transition-colors sticky top-0">
                <div className="flex items-center gap-3">
                    <Link
                        to="/chat"
                        aria-label={t('common.backToChat')}
                        title={t('common.backToChat')}
                        className="flex items-center justify-center w-9 h-9 rounded-full text-text-secondary hover:text-text-primary hover:bg-white/[0.06] dark:hover:bg-white/[0.06] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Link>
                    <h1 className="text-xl font-semibold text-text-primary tracking-wide flex items-center gap-2">
                        <MaterialIcon name="folder" size={22} />
                        {t('nav.documents')}
                    </h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/[0.06] dark:hover:bg-white/[0.06] rounded-full transition-colors"
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

            <div className="relative z-10 max-w-5xl mx-auto p-4 sm:p-8 pt-6 sm:pt-10">
                {/* 上傳區域 —— 玻璃感虛線框 */}
                <div
                    className={`relative border-2 border-dashed rounded-cv-lg p-5 sm:p-10 mb-4 sm:mb-6 transition-colors backdrop-blur-xl ${dragActive
                            ? 'border-corphia-bronze bg-accent/10 supports-[backdrop-filter]:bg-accent/8'
                            : 'border-white/40 dark:border-white/10 bg-bg-base/60 supports-[backdrop-filter]:bg-bg-base/45 hover:border-corphia-bronze/50'
                        } shadow-[0_8px_28px_rgb(0_0_0/0.06)] dark:shadow-[0_8px_28px_rgb(0_0_0/0.32)]`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        onChange={handleFileSelect}
                        accept={ACCEPT_ATTR}
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    <div className="text-center flex flex-col items-center">
                        <div className="text-corphia-bronze mb-2 sm:mb-4">
                            <UploadIcon />
                        </div>
                        <p className="text-text-primary font-medium mb-1.5 sm:mb-2 text-[15px] sm:text-lg leading-tight">
                            {t('documents.dropZoneTitle', '拖放文件到此處，或點擊選擇（可多選）')}
                        </p>
                        <p className="text-[12px] sm:text-sm text-text-secondary leading-relaxed">
                            {t(
                                'documents.dropZoneSubtitle',
                                '支援 PDF、Word、Excel、PowerPoint、TXT、Markdown · 最大 50MB',
                            )}
                        </p>
                        <a
                            href={sampleHref}
                            download
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            {t('documents.downloadSample', '下載範例檔試試看')}
                        </a>
                    </div>
                </div>

                {/* 上傳佇列 — 每筆檔案一條進度條 */}
                {uploadQueue.length > 0 && (
                    <div className="mb-6 rounded-cv-lg border border-white/40 dark:border-white/10 bg-bg-base/70 supports-[backdrop-filter]:bg-bg-base/55 backdrop-blur-xl shadow-[0_8px_28px_rgb(0_0_0/0.06)] dark:shadow-[0_8px_28px_rgb(0_0_0/0.32)] shadow-sm dark:shadow-none overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
                            <p className="text-sm font-semibold text-text-primary">
                                {t('documents.uploadQueueTitle', '上傳中')}
                                <span className="ml-2 text-text-secondary font-normal">
                                    ({uploadQueue.filter((i) => i.status === 'completed').length}
                                    {' / '}
                                    {uploadQueue.length})
                                </span>
                            </p>
                            {!isUploading && uploadQueue.every((i) => i.status !== 'uploading') && (
                                <button
                                    onClick={() => setUploadQueue([])}
                                    className="text-xs font-medium text-text-secondary hover:text-text-primary transition"
                                >
                                    {t('common.clearAll', '全部清除')}
                                </button>
                            )}
                        </div>
                        <ul className="divide-y divide-border-subtle">
                            {uploadQueue.map((item) => {
                                const ext = getExtension(item.file.name).slice(1)
                                const sizeLabel = formatFileSize(item.file.size)
                                const isFailed = item.status === 'failed'
                                const isDone = item.status === 'completed'
                                const isUploadingNow = item.status === 'uploading'

                                return (
                                    <li key={item.id} className="px-5 py-3">
                                        <div className="flex items-center gap-3 mb-2">
                                            <FileIcon type={ext} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-text-primary truncate">
                                                    {item.file.name}
                                                </p>
                                                <p className="text-xs text-text-secondary">
                                                    {sizeLabel}
                                                    {isFailed && item.error && (
                                                        <span className="text-red-500"> · {item.error}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2">
                                                {/* 狀態指示器 */}
                                                {isDone && (
                                                    <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 inline-flex items-center gap-0.5">
                                                        <MaterialIcon name="check_circle" size={13} aria-hidden />
                                                        {t('documents.uploadDone', '已完成')}
                                                    </span>
                                                )}
                                                {isFailed && (
                                                    <span className="text-[11px] font-semibold text-red-500 inline-flex items-center gap-0.5">
                                                        <MaterialIcon name="error" size={13} aria-hidden />
                                                        {t('documents.uploadFailed', '失敗')}
                                                    </span>
                                                )}
                                                {isUploadingNow && (
                                                    <span className="text-[11px] font-mono tabular-nums text-text-secondary">
                                                        {item.progress}%
                                                    </span>
                                                )}
                                                {item.status === 'queued' && (
                                                    <span className="text-[11px] font-medium text-text-muted">
                                                        {t('documents.uploadQueued', '排隊中')}
                                                    </span>
                                                )}
                                                {(isFailed || isDone) && (
                                                    <button
                                                        onClick={() => dismissUpload(item.id)}
                                                        className="p-1 text-text-muted hover:text-text-primary transition rounded-full"
                                                        title={t('common.dismiss', '關閉')}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {/* 進度條 */}
                                        <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-200 ${
                                                    isFailed
                                                        ? 'bg-red-500'
                                                        : isDone
                                                            ? 'bg-green-500'
                                                            : 'bg-accent'
                                                }`}
                                                style={{
                                                    width: `${
                                                        isFailed
                                                            ? 100
                                                            : isDone
                                                                ? 100
                                                                : item.progress
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                )}

                {/* 錯誤訊息 */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-cv-lg text-red-600 shadow-sm">
                        {error}
                    </div>
                )}

                {/* Onboarding：文件數為 0 時顯示三張說明卡 */}
                {!isLoading && documents.length === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                        {[
                            {
                                step: '01',
                                title: t('documents.onboard1Title', '上傳什麼檔案'),
                                desc: t('documents.onboard1Desc', '支援 PDF、Word、Excel、PowerPoint、純文字與 Markdown。可一次拖入多個檔案。'),
                            },
                            {
                                step: '02',
                                title: t('documents.onboard2Title', '上傳後會發生什麼'),
                                desc: t('documents.onboard2Desc', '系統會自動切塊、向量化並寫入索引，狀態列會顯示處理中／已完成。'),
                            },
                            {
                                step: '03',
                                title: t('documents.onboard3Title', '怎麼用 RAG 問答'),
                                desc: t('documents.onboard3Desc', '切到「專案」對話模式並把檔案加入專案，AI 會自動引用相關段落並標記出處。'),
                            },
                        ].map((card) => (
                            <div
                                key={card.step}
                                className="rounded-cv-lg border border-white/40 dark:border-white/10 bg-bg-base/70 supports-[backdrop-filter]:bg-bg-base/55 backdrop-blur-xl shadow-[0_8px_28px_rgb(0_0_0/0.06)] dark:shadow-[0_8px_28px_rgb(0_0_0/0.32)] p-5 shadow-sm dark:shadow-none"
                            >
                                <p className="text-xs font-semibold tracking-[0.18em] text-text-muted mb-2">{card.step}</p>
                                <h3 className="text-base font-semibold text-text-primary mb-2">{card.title}</h3>
                                <p className="text-[13px] text-text-secondary leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* 文件列表 */}
                <div className="bg-bg-base rounded-cv-lg border border-border-subtle overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="px-8 py-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                        <h2 className="font-semibold text-text-primary">
                            {t('documents.uploadedTitle', '已上傳文件')} ({visibleDocuments.length}
                            {searchQuery.trim() ? ` / ${documents.length}` : ''})
                        </h2>
                        {documents.length > 0 && (
                            <div className="relative max-w-xs w-full">
                                <svg
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16 10a6 6 0 11-12 0 6 6 0 0112 0z" />
                                </svg>
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={t('documents.searchPlaceholder', '搜尋檔名…')}
                                    className="w-full pl-9 pr-3 py-1.5 text-sm rounded-full bg-bg-surface border border-border-subtle text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
                                />
                            </div>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="p-10 text-center text-text-secondary">
                            {t('common.loading', '載入中...')}
                        </div>
                    ) : visibleDocuments.length === 0 ? (
                        <div className="p-10 text-center text-text-secondary">
                            {searchQuery.trim()
                                ? t('documents.noMatch', '沒有符合搜尋的檔案')
                                : t('documents.empty', '尚無上傳的文件')}
                        </div>
                    ) : (
                        <div className="divide-y divide-border-subtle dark:divide-border-subtle">
                            {visibleDocuments.map(doc => (
                                <div key={doc.id} className="px-8 py-5 flex items-center gap-5 hover:bg-bg-base transition-colors">
                                    <FileIcon type={doc.fileType} />

                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[15px] text-text-primary truncate mb-0.5">
                                            {doc.originalFilename}
                                        </p>
                                        <div className="flex items-center gap-2.5 text-sm text-text-secondary">
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
                                        className="p-2 md:p-2.5 ml-4 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
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
