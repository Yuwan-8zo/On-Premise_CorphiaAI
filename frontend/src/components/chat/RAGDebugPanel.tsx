/**
 * RAG 除錯面板 (C2 差異化功能)
 *
 * 展示每次檢索到的 chunks、相似度分數、路由決策、
 * 最後送進 prompt 的 context 長度——口試老師會愛。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface RAGSource {
    chunk_id: string
    content: string
    score: number
    distance?: number
    document_id?: string
    document_name?: string
}

interface RAGDebugInfo {
    route: string
    context_length: number
    prompt_length: number
    chunks_count: number
}

interface RAGDebugPanelProps {
    sources: RAGSource[]
    debug?: RAGDebugInfo | null
}

/** 相似度分數的色彩對應 */
function scoreColor(score: number): string {
    if (score >= 0.8) return 'text-green-500'
    if (score >= 0.6) return 'text-yellow-500'
    if (score >= 0.4) return 'text-orange-500'
    return 'text-red-500'
}

function scoreBg(score: number): string {
    if (score >= 0.8) return 'bg-green-500/10 border-green-500/20'
    if (score >= 0.6) return 'bg-yellow-500/10 border-yellow-500/20'
    if (score >= 0.4) return 'bg-orange-500/10 border-orange-500/20'
    return 'bg-red-500/10 border-red-500/20'
}

/** 路由決策的中文 */
const ROUTE_LABELS: Record<string, { label: string; icon: string }> = {
    rag: { label: '知識庫檢索', icon: '📚' },
    web_search: { label: '網路搜尋', icon: '🌐' },
    chat: { label: '一般對話', icon: '💬' },
}

export function RAGDebugPanel({ sources, debug }: RAGDebugPanelProps) {
    const { t } = useTranslation()
    const [isExpanded, setIsExpanded] = useState(false)

    if (!sources || sources.length === 0) return null

    const routeInfo = debug?.route ? ROUTE_LABELS[debug.route] : null

    return (
        <div className="mt-2 mb-1">
            {/* 收合/展開按鈕 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-light-text-muted hover:text-light-text-primary dark:hover:text-gray-200 transition-colors group"
            >
                <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="font-mono">
                    🔍 RAG Debug — {sources.length} chunks
                    {routeInfo && <span className="ml-2">{routeInfo.icon} {routeInfo.label}</span>}
                </span>
            </button>

            {/* 展開的除錯面板 */}
            {isExpanded && (
                <div className="mt-2 space-y-2 border border-light-border-secondary dark:border-dark-border-primary rounded-xl p-3 bg-corphia-beige/50 dark:bg-dark-bg-secondary/50 backdrop-blur-sm">
                    {/* 統計概覽 */}
                    {debug && (
                        <div className="flex flex-wrap gap-3 text-xs font-mono mb-3 pb-2 border-b border-light-border-secondary dark:border-dark-border-primary">
                            <span className="px-2 py-1 rounded-md bg-light-accent/10 text-light-accent dark:text-dark-accent">
                                Route: {debug.route}
                            </span>
                            <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                Context: {debug.context_length} chars
                            </span>
                            <span className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                Prompt: {debug.prompt_length} chars
                            </span>
                        </div>
                    )}

                    {/* Chunk 列表 */}
                    {sources.map((source, index) => (
                        <div
                            key={source.chunk_id}
                            className={`rounded-lg border p-3 ${scoreBg(source.score)}`}
                        >
                            {/* Header: 分數 + 文件名 */}
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary">
                                        #{index + 1}
                                    </span>
                                    <span className="text-xs text-light-text-secondary dark:text-light-text-muted truncate max-w-[200px]">
                                        {source.document_name || '未知文件'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs font-mono font-bold ${scoreColor(source.score)}`}>
                                        {(source.score * 100).toFixed(1)}%
                                    </span>
                                    {source.distance !== undefined && (
                                        <span className="text-[10px] font-mono text-light-text-muted">
                                            d={source.distance}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Content 預覽 */}
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed line-clamp-3">
                                {source.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default RAGDebugPanel
