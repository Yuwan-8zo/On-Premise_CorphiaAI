/**
 * 文件管理頁面
 */

import { ChevronLeft, Download, FileText, Moon, Search, Sun, Trash2, Upload, X } from '@/components/snow/icons'
import { parseServerDate } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { documentsApi } from '@/api/documents'
import MaterialIcon from '@/components/icons/MaterialIcon'
import Tooltip from '@/components/ui/Tooltip'
import WaveBackground from '@/components/ui/WaveBackground'

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
    <Upload className="w-12 h-12" />
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
        <div className={`w-10 h-10 rounded-[16px] bg-[var(--chip)]  flex items-center justify-center ${colors[type] || 'text-text-secondary'}`}>
            <FileText className="w-5 h-5" />
        </div>
    )
}

// 副檔名白名單 — 跟後端能成功解析的格式對齊。
// 舊版 office 格式 (.doc / .xls / .ppt) 後端會拒絕（python-pptx / python-docx 解析
// 不穩或不支援），這邊就不放進 accept 讓使用者能選到。
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.pptx', '.csv', '.txt', '.md']
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
    <Trash2 className="w-4 h-4" />
)

const StatusBadge = ({ status }: { status: Document['status'] }) => {
    const styles = {
        pending: 'tag-orange',
        processing: 'tag-accent',
        completed: 'tag-green',
        failed: 'tag-red',
    }

    const labels = {
        pending: '等待處理',
        processing: '處理中',
        completed: '可讀取', // AI 已經能讀這份檔案
        failed: '讀取失敗',
    }

    return (
        <span className={`tag ${styles[status]}`}>
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
                <WaveBackground />
            </div>
            {/* 頂部導覽列 —— 玻璃感 sticky bar */}
            <header className="relative z-10 h-16 sm:h-[80px] flex items-center justify-between px-4 sm:px-8 bg-[var(--glass-card)] backdrop-blur-2xl transition-colors sticky top-0">
                <div className="flex items-center gap-3">
                    
                        <Link
                            to="/chat"
                            aria-label={t('common.backToChat')}
                            className="btn-icon !w-[34px] !h-[34px] shrink-0 text-text-secondary"
                        >
                            <ChevronLeft className="w-[18px] h-[18px]" />
                        </Link>
                    
                    <h1 className="text-[22px] leading-[28px] font-bold text-text-primary">
                        {t('nav.documents')}
                    </h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="btn-icon !w-[40px] !h-[40px] text-text-secondary"
                >
                    {theme === 'dark' ? (
                        <Sun className="w-5 h-5" />
                    ) : (
                        <Moon className="w-5 h-5" />
                    )}
                </button>
            </header>

            <div className="relative z-10 max-w-5xl mx-auto p-4 sm:p-8 pt-6 sm:pt-10">
                {/* 上傳區域 —— 玻璃感虛線框 */}
                <div
                    className={`relative border-2 border-dashed rounded-[18px] p-5 sm:p-10 mb-4 sm:mb-6 transition-colors backdrop-blur-xl ${dragActive
                            ? 'border-accent bg-accent/10 supports-[backdrop-filter]:bg-accent/8'
                            : 'border-[var(--paper-line)] bg-[var(--glass-card)]'
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
                        <div className="text-accent mb-2 sm:mb-4">
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
                            className="relative z-10 mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent "
                        >
                            <Download className="w-3.5 h-3.5" />
                            {t('documents.downloadSample', '下載範例檔試試看')}
                        </a>
                    </div>
                </div>

                {/* 上傳佇列 — 每筆檔案一條進度條 */}
                {uploadQueue.length > 0 && (
                    <div className="mb-6 paper !rounded-[25px]  overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[var(--paper-line)] px-5 py-3">
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
                                    className="text-xs font-medium text-text-secondary  transition"
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
                                                    <span className="text-[12px] font-semibold text-green-600 dark:text-green-400 inline-flex items-center gap-0.5">
                                                        <MaterialIcon name="check_circle" size={13} aria-hidden />
                                                        {t('documents.uploadDone', '已完成')}
                                                    </span>
                                                )}
                                                {isFailed && (
                                                    <span className="text-[12px] font-semibold text-red-500 inline-flex items-center gap-0.5">
                                                        <MaterialIcon name="error" size={13} aria-hidden />
                                                        {t('documents.uploadFailed', '失敗')}
                                                    </span>
                                                )}
                                                {isUploadingNow && (
                                                    <span className="text-[12px] tabular-nums text-text-secondary">
                                                        {item.progress}%
                                                    </span>
                                                )}
                                                {item.status === 'queued' && (
                                                    <span className="text-[12px] font-medium text-text-secondary">
                                                        {t('documents.uploadQueued', '排隊中')}
                                                    </span>
                                                )}
                                                {(isFailed || isDone) && (
                                                    <Tooltip label={t('common.dismiss', '關閉')}>
                                                        <button
                                                            onClick={() => dismissUpload(item.id)}
                                                            className="btn-icon btn-icon-plain !w-8 !h-8 text-text-muted"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                        {/* 進度條 */}
                                        <div className="h-1.5 bg-[var(--chip)] rounded-full overflow-hidden">
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
                    <div className="mb-8 p-4 glass-chip rounded-[18px] text-red-600 dark:text-red-400 ">
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
                                className="paper !rounded-[25px] p-5 "
                            >
                                <span className="mb-3 w-[26px] h-[26px] rounded-full bg-[var(--chip)] text-[13px] font-semibold text-text-primary flex items-center justify-center">{Number(card.step)}</span>
                                <h3 className="text-[17px] leading-[22px] font-semibold text-text-primary mb-1">{card.title}</h3>
                                <p className="text-[13px] text-text-secondary leading-relaxed">{card.desc}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* 文件列表（Apple 分組清單：組名＋搜尋在卡片上方，每個檔案一列，分隔線從文字起點開始） */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
                    <h2 className="set-header !p-0 sm:pl-4 sm:!pl-4">
                        {t('documents.uploadedTitle', '已上傳文件')}（{visibleDocuments.length}
                        {searchQuery.trim() ? ` / ${documents.length}` : ''}）
                    </h2>
                    {documents.length > 0 && (
                        <div className="relative max-w-xs w-full mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('documents.searchPlaceholder', '搜尋檔名…')}
                                aria-label={t('documents.searchPlaceholder', '搜尋檔名…')}
                                className="w-full h-9 pl-9 pr-3 text-[15px] rounded-[10px] bg-[var(--chip)] text-text-primary placeholder:text-text-secondary outline-none"
                            />
                        </div>
                    )}
                </div>
                <div className="paper !rounded-[25px] overflow-hidden">
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
                        <div className="py-1">
                            {visibleDocuments.map(doc => (
                                <div key={doc.id} className="set-row has-icon !py-3 !px-5">
                                    <FileIcon type={doc.fileType} />
                                    <span className="set-label">
                                        <span className="block truncate font-medium">{doc.originalFilename}</span>
                                        <span className="set-sub">
                                            {formatFileSize(doc.fileSize)} · {doc.chunkCount} {t('documents.chunks', '分塊')} · {parseServerDate(doc.createdAt).toLocaleDateString('zh-TW')}
                                        </span>
                                    </span>
                                    <StatusBadge status={doc.status} />
                                    <Tooltip label={t('common.delete', '刪除')}>
                                        <button
                                            onClick={() => deleteDocument(doc.id)}
                                            aria-label={t('common.delete', '刪除')}
                                            className="btn-icon btn-icon-plain !w-9 !h-9 text-text-secondary"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </Tooltip>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
