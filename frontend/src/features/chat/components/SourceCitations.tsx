/**
 * 來源引用元件
 * 
 * 顯示 RAG 檢索到的文件來源
 */

import { ChevronDown, FileText } from '@/components/snow/icons'
import { useState } from 'react'
import type { MessageSource } from '@/types/chat'

interface SourceCitationsProps {
    sources: MessageSource[]
}

const DocumentIcon = () => (
    <FileText className="w-4 h-4" />
)

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
)

interface SourceGroup {
    key: string
    name: string
    best: number
    chunks: MessageSource[]
}

/** 同一份文件的多個段落合併成一筆，避免「1 份檔案卻顯示 2 個來源」 */
function groupByDocument(sources: MessageSource[]): SourceGroup[] {
    const map = new Map<string, SourceGroup>()
    for (const s of sources) {
        const key = s.document_id || s.document_name || s.chunk_id
        const g = map.get(key) ?? { key, name: s.document_name || '未知文件', best: 0, chunks: [] }
        g.chunks.push(s)
        g.best = Math.max(g.best, s.score || 0)
        map.set(key, g)
    }
    return [...map.values()].sort((a, b) => b.best - a.best)
}

export default function SourceCitations({ sources }: SourceCitationsProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

    if (!sources || sources.length === 0) {
        return null
    }

    const groups = groupByDocument(sources)

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
        <div className="mt-3 glass-chip rounded-[var(--r-18)] overflow-hidden">
            {/* 標題列：顯示文件數，段落數另外標示 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-3 py-2"
            >
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <DocumentIcon />
                    <span>
                        參考來源：{groups.length} 份文件
                        {sources.length > groups.length && (
                            <span className="text-text-muted">（共引用 {sources.length} 個段落）</span>
                        )}
                    </span>
                </div>
                <ChevronIcon isOpen={isExpanded} />
            </button>

            {isExpanded && (
                <div className="divide-y divide-[var(--paper-line)] border-t border-[var(--paper-line)]">
                    {groups.map((group, index) => (
                        <div key={group.key}>
                            <button
                                onClick={() => toggleItem(group.key)}
                                className="w-full flex items-center justify-between px-3 py-2"
                            >
                                <div className="flex min-w-0 items-center gap-2 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-accent/15 text-accent rounded-[var(--r-6)] text-xs font-medium">
                                        {index + 1}
                                    </span>
                                    <span className="text-text-secondary truncate">{group.name}</span>
                                    <span className="flex-shrink-0 text-xs text-text-muted">
                                        （{group.chunks.length} 個段落・最高 {Math.round(group.best * 100)}% 相關）
                                    </span>
                                </div>
                                <ChevronIcon isOpen={expandedItems.has(group.key)} />
                            </button>

                            {expandedItems.has(group.key) && (
                                <div className="space-y-2 px-3 pb-3">
                                    {group.chunks.map((chunk, i) => (
                                        <div key={chunk.chunk_id} className="p-3 bg-[var(--chip)] rounded-[var(--r-12)] text-sm text-text-secondary leading-relaxed">
                                            <p className="mb-1 text-xs text-text-muted">
                                                段落 {i + 1}・{Math.round((chunk.score || 0) * 100)}% 相關
                                            </p>
                                            {chunk.content}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
