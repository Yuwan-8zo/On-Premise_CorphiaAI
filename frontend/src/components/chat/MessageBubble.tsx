/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo, useState, useEffect } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import RAGDebugPanel from './RAGDebugPanel'
import type { Message } from '../../types/chat'
import { CorphiaLogo, CorphiaThinkingIcon } from '../icons/CorphiaIcons'
import { Copy, Edit2, Check, X, ShieldCheck } from 'lucide-react'
import { conversationsApi } from '../../api/conversations'
import { useChatStore } from '../../store/chatStore'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
    onResubmit?: (messageId: string, content: string) => void
    hideActions?: boolean
    /**
     * C2: 是否顯示 RAG 除錯面板（通常僅在「最後一則 AI 訊息」且開啟 Debug Mode 時為 true）。
     * 除錯資訊來自 chatStore.ragDebug，僅反映最近一次回應。
     */
    showRAGDebug?: boolean
}

/**
 * AI 品牌頭像
 *
 * 動態與靜態 icon 疊放在同一個容器中，透過 opacity + transition 做 cross-fade：
 * - isStreaming=true  → 動態 thinking icon 可見，靜態 logo 隱藏
 * - isStreaming=false → 靜態 logo 可見，  動態 thinking icon 隱藏
 */
const AIAvatar = ({ isStreaming }: { isStreaming: boolean }) => (
    <div className="relative w-9 h-9 flex-shrink-0 -mt-[3px]">
        {/* 【底層】動態 Thinking Icon — streaming 時可見 */}
        <span
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 text-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))]"
            style={{ opacity: isStreaming ? 1 : 0 }}
        >
            <CorphiaThinkingIcon className="w-6 h-6" />
        </span>

        {/* 【上層】靜態 Logo — streaming 結束後淡入 */}
        <span
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: isStreaming ? 0 : 1 }}
        >
            <CorphiaLogo className="w-9 h-9" />
        </span>
    </div>
)

const MessageBubble = memo(({ message, isStreaming = false, onResubmit, hideActions = false, showRAGDebug = false }: MessageBubbleProps) => {
    const isUser = message.role === 'user'
    // C2: 從 store 取得 RAG 除錯資訊（僅反映最近一次回應，配合 showRAGDebug 使用）
    const ragDebug = useChatStore((s) => s.ragDebug)
    
    // 編輯狀態
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(message.content)
    
    // NOTE: 當上層 re-fetch 訊息後更新 message.content 時（如 resubmit 後同步），同步到 editContent
    // 避免下次再點「編輯」時 textarea 還顯示舊內容
    useEffect(() => {
        if (!isEditing) {
            setEditContent(message.content)
        }
    }, [message.content, isEditing])
    
    // 複製狀態
    const [isCopied, setIsCopied] = useState(false)

    // 處理複製
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('複製失敗:', err)
        }
    }

    // 處理儲存編輯
    const handleSaveEdit = async () => {
        if (!editContent.trim() || editContent === message.content) {
            setIsEditing(false)
            return
        }
        
        try {
            // 先樂觀更新 UI
            useChatStore.getState().updateMessage(message.id, { content: editContent })
            setIsEditing(false)
            
            if (onResubmit) {
                // 如果有提供 onResubmit，代表此為重新生成流程，由上層處理截斷與重送
                onResubmit(message.id, editContent)
            } else {
                // 實際呼叫 API 更新後端資料庫 (單純更新文字，不重新生成)
                if (!message.id.startsWith('temp-')) {
                    await conversationsApi.updateMessageText(message.id, editContent)
                }
            }
        } catch (err) {
            console.error('更新訊息失敗:', err)
            // 若失敗可選擇回復原狀態
            useChatStore.getState().updateMessage(message.id, { content: message.content })
        }
    }

    return (
        <div id={`msg-${message.id}`} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                <div className="flex flex-col items-end max-w-[75%] group">
                    <div className="bg-bg-elevated text-text-primary rounded-[20px] px-5 py-3 whitespace-pre-wrap text-[15.5px] leading-relaxed relative">
                        {isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[250px]">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full bg-bg-base text-text-primary rounded-lg p-2 outline-none resize-none border border-border-subtle focus:border-corphia-bronze focus:ring-1 focus:ring-corphia-bronze"
                                    rows={Math.min(5, editContent.split('\n').length || 1)}
                                />
                                <div className="flex justify-end gap-2 mt-1">
                                    <button onClick={() => { setEditContent(message.content); setIsEditing(false); }} className="p-1.5 text-text-secondary hover:text-text-primary bg-bg-surface bg-bg-surface rounded-full transition-colors flex items-center justify-center shadow-sm" title="取消">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleSaveEdit} className="p-1.5 text-text-primary bg-accent hover:opacity-80 rounded-full transition-colors flex items-center justify-center shadow-sm" title="儲存修改">
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            message.content
                        )}
                    </div>
                    {!isEditing && !hideActions && (
                        <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-text-muted mr-2">
                            <button onClick={handleCopy} className="p-1 hover:text-text-secondary rounded transition-colors" title="複製">
                                {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => { setEditContent(message.content); setIsEditing(true); }} className="p-1 hover:text-text-secondary rounded transition-colors" title="編輯">
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {message.content_hash && (
                                <div className="p-1 group/hash relative cursor-help" title={`防篡改雜湊驗證\nHash: ${message.content_hash}`}>
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover/hash:block bg-bg-surface text-text-primary text-[11px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                        Verified: {message.content_hash.substring(0, 16)}...
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                // AI 訊息：無背景框，流暢文字排版，包含頭像，靠左
                <div className="w-full flex items-start gap-3 group">
                    {/* 頭像固定靠左，與文字首段齊平 */}
                    <div className="flex-shrink-0">
                        <AIAvatar isStreaming={isStreaming && !message.content} />
                    </div>

                    {/* 內容區塊 */}
                    <div className="flex-1 min-w-0 text-text-primary text-[15.5px] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-bg-surface dark:prose-pre:bg-bg-surface prose-pre:rounded-[12px] prose-pre:border prose-pre:border-border-subtle dark:prose-pre:border-border-subtle max-w-none [&_.markdown-body>*:first-child]:!mt-0">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            // NOTE: 空白佔位，讓動態 icon 撐起高度，避免訊息列高度 = 0
                            <div className="h-8" />
                        ) : null}

                        {/* 來源引用 */}
                        {message.sources && message.sources.length > 0 && (
                            <div className="mt-4">
                                <SourceCitations sources={message.sources} />
                            </div>
                        )}

                        {/* C2: RAG 除錯面板 — 僅在最後一則 AI 訊息且開啟 Debug Mode 時顯示 */}
                        {showRAGDebug && message.sources && message.sources.length > 0 && (
                            <RAGDebugPanel
                                sources={message.sources.map((s) => ({
                                    chunk_id: s.chunk_id,
                                    content: s.content,
                                    score: s.score,
                                    document_id: s.document_id,
                                    document_name: s.document_name,
                                }))}
                                debug={ragDebug}
                            />
                        )}

                        {/* 工具列，滑鼠移入 (group-hover) 時浮現 */}
                        {message.content && !isStreaming && !hideActions && (
                            <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-text-muted">
                                <button onClick={handleCopy} className="p-1 hover:text-text-secondary rounded transition-colors" title="複製">
                                    {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                {message.content_hash && (
                                    <div className="p-1 group/hash relative cursor-help" title={`防篡改雜湊驗證\nHash: ${message.content_hash}`}>
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover/hash:block bg-bg-surface text-text-primary text-[11px] px-2 py-1 rounded whitespace-nowrap shadow-lg z-10">
                                            Verified: {message.content_hash.substring(0, 16)}...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
