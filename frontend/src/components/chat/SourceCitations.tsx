/**
 * 來源引用元件
 * 
 * 顯示 RAG 檢索到的文件來源
 */

import { useState } from 'react'
import type { MessageSource } from '../../types/chat'

interface SourceCitationsProps {
    sources: MessageSource[]
}

const DocumentIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
)

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg
        className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
)

export default function SourceCitations({ sources }: SourceCitationsProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

    if (!sources || sources.length === 0) {
        return null
    }

    const toggleItem = (id: string) => {
        const newExpanded = new Set(expandedItems)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedItems(newExpanded)
    }

    return (
        <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {/* 標題列 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <DocumentIcon />
                    <span>參考來源 ({sources.length})</span>
                </div>
                <ChevronIcon isOpen={isExpanded} />
            </button>

            {/* 來源列表 */}
            {isExpanded && (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sources.map((source, index) => (
                        <div key={source.chunkId} className="bg-white dark:bg-slate-900">
                            {/* 來源標題 */}
                            <button
                                onClick={() => toggleItem(source.chunkId)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded text-xs font-medium">
                                        {index + 1}
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-300 truncate">
                                        {source.documentName}
                                    </span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500">
                                        ({Math.round(source.score * 100)}% 相關)
                                    </span>
                                </div>
                                <ChevronIcon isOpen={expandedItems.has(source.chunkId)} />
                            </button>

                            {/* 來源內容 */}
                            {expandedItems.has(source.chunkId) && (
                                <div className="px-3 pb-3">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {source.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
