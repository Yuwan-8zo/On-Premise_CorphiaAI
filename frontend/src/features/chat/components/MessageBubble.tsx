/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import AIThinkingIndicator from './AIThinkingIndicator'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import RAGDebugPanel from './RAGDebugPanel'
import AudioMessage from './AudioMessage'
import type { Message } from '@/types/chat'
import { CorphiaLogo, CorphiaThinkingIcon } from '@/components/icons/CorphiaIcons'
import { Copy, Edit2, Check, X, ShieldCheck, RefreshCw } from 'lucide-react'
import { conversationsApi } from '@/api/conversations'
import { useChatStore } from '@/store/chatStore'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
    onResubmit?: (messageId: string, content: string) => void
    /** 重新生成這則 AI 回覆。會回到上一則 user 訊息並重送一次。 */
    onRegenerate?: (messageId: string) => void
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
            <CorphiaLogo className="w-9 h-9 text-text-primary" />
        </span>
    </div>
)

const MessageBubble = memo(({ message, isStreaming = false, onResubmit, onRegenerate, hideActions = false, showRAGDebug = false }: MessageBubbleProps) => {
    const isUser = message.role === 'user'
    const { t } = useTranslation()
    // C2: 從 store 取得 RAG 除錯資訊（僅反映最近一次回應，配合 showRAGDebug 使用）
    const ragDebug = useChatStore((s) => s.ragDebug)
    
    // 編輯狀態
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(message.content)
    const editTextareaRef = useRef<HTMLTextAreaElement | null>(null)

    /*
     * 編輯訊息時的 textarea 自動長高：
     *   - 原本只算換行符（split('\n')）→ 長段中文沒換行就被裁切（user 回報）
     *   - 改成依 scrollHeight 自動長高，配合上層 max-h-[40vh] + overflow-y-auto 上限
     *
     * 注意要點：
     *   - 用 useLayoutEffect（DOM 變動完同步測量），避免 useEffect 跟不上斷行 layout
     *   - 同時掛 ResizeObserver：textarea 寬度改變（視窗 resize、字體 reflow）時要重算
     *   - 沒有 ResizeObserver 的話，使用者打字到一半換行寬度變了，高度會抓錯一格
     */
    const recomputeEditHeight = () => {
        const el = editTextareaRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }

    useLayoutEffect(() => {
        if (!isEditing) return
        recomputeEditHeight()
    }, [editContent, isEditing])

    useEffect(() => {
        if (!isEditing) return
        const el = editTextareaRef.current
        if (!el) return
        const observer = new ResizeObserver(() => recomputeEditHeight())
        observer.observe(el)
        return () => observer.disconnect()
    }, [isEditing])
    
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

    /*
     * 訊息進場動畫：
     *   參考 Atheros AI Chat 的 spring 彈進效果。
     *   gsapMotion 的 ease 字串會直接被 GSAP 解析，
     *   `back.out(1.4)` 會在尾段微微 overshoot，得到自然的彈性感。
     *   訊息已經顯示過後不要再重播（streaming 中追加文字時）。
     */
    return (
        <motion.div
            id={`msg-${message.id}`}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: 'back.out(1.4)' }}
            className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}
        >
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                // 編輯模式：把外層撐到 max-w 的 75%，textarea 才能跟原本訊息氣泡同寬
                // （原本 min-w-[250px] 會讓編輯框比訊息本身還窄，文字被擠成多行）
                <div className={`flex flex-col items-end max-w-[75%] group ${isEditing ? 'w-[75%]' : ''}`}>
                    {/*
                     * 語音訊息渲染策略：
                     *   - 有附件、無轉錄：只渲染 AudioMessage 卡片，不要再多一個「[語音訊息]」文字氣泡（重複）。
                     *   - 有附件、有轉錄：先 AudioMessage，下面再接一顆轉錄文字氣泡（讓使用者也能讀文字）。
                     *   - 無附件：純文字訊息（與舊行為相同）。
                     */}
                    {message.audio && !isEditing ? (
                        <>
                            <AudioMessage audio={message.audio} />
                            {/*
                             * 狀態指示：
                             *   - pending: 後端正在跑 Whisper → 顯示「轉錄中...」帶呼吸動畫
                             *   - error:   轉錄失敗（極短音訊、後端模型未下載完等）→ 顯示錯誤
                             *   - 有 transcript: 顯示轉錄文字氣泡（用 message.content 才能反映編輯後的最新版）
                             */}
                            {message.audio.pending && (
                                <div className="mt-1.5 flex items-center gap-2 text-xs text-text-secondary">
                                    <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                                    <span className="animate-pulse">{t('chat.voice.transcribing')}</span>
                                </div>
                            )}
                            {!message.audio.pending && message.audio.error && (
                                <div className="mt-1.5 max-w-full rounded-cv-md border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-500">
                                    {t('chat.voice.transcribeFailed')}
                                </div>
                            )}
                            {!message.audio.pending && message.audio.transcript && message.content && (
                                <div className="bg-bg-elevated/70 supports-[backdrop-filter]:bg-bg-elevated/55 backdrop-blur-xl border border-white/40 dark:border-white/10 text-text-primary rounded-cv-lg px-5 py-3 mt-1.5 whitespace-pre-wrap text-[15.5px] leading-relaxed selectable-text">
                                    {message.content}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={`bg-bg-elevated/70 supports-[backdrop-filter]:bg-bg-elevated/55 backdrop-blur-xl border border-white/40 dark:border-white/10 text-text-primary rounded-cv-lg px-5 py-3 whitespace-pre-wrap text-[15.5px] leading-relaxed relative selectable-text ${isEditing ? 'w-full' : ''}`}>
                            {isEditing ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <textarea
                                        ref={editTextareaRef}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full bg-bg-base text-text-primary rounded-lg p-2 outline-none resize-none border border-border-subtle focus:border-corphia-bronze focus:ring-1 focus:ring-corphia-bronze max-h-[40vh] overflow-y-auto custom-scrollbar"
                                        rows={1}
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
                    )}
                    {!isEditing && !hideActions && (
                        <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-text-muted mr-2">
                            <button onClick={handleCopy} className="p-1 hover:text-text-secondary rounded transition-colors" title="複製">
                                {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {/* 編輯：只對「文字訊息」或「有 transcript 的語音訊息」開放 */}
                            {(!message.audio || message.audio.transcript) && (
                                <button onClick={() => { setEditContent(message.audio?.transcript || message.content); setIsEditing(true); }} className="p-1 hover:text-text-secondary rounded transition-colors" title="編輯">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {/*
                              重新傳送：保留原訊息內容，重跑 AI 回覆。
                              直接用 onResubmit(messageId, 原內容)；上層會截斷此訊息之後的歷史並重新送 LLM。
                              無轉錄的純語音訊息沒有可送 LLM 的文字，直接隱藏此按鈕。
                            */}
                            {onResubmit && !message.id.startsWith('temp-') && (!message.audio || message.audio.transcript) && (
                                <button
                                    onClick={() => onResubmit(message.id, message.audio?.transcript || message.content)}
                                    className="p-1 hover:text-text-secondary rounded transition-colors"
                                    title="重新生成"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {message.tokens > 0 && (
                                <span
                                    className="ml-1 text-[11px] tabular-nums text-text-muted/80"
                                    title={`本則訊息消耗 ${message.tokens.toLocaleString()} tokens`}
                                >
                                    {message.tokens.toLocaleString()} tok
                                </span>
                            )}
                            {message.content_hash && (
                                <div className="p-1 group/hash relative cursor-help" title={`防篡改雜湊驗證\nHash: ${message.content_hash}`}>
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover/hash:block bg-[#1A1A1A] dark:bg-[#E5E5E5] text-white dark:text-black text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl z-50 border border-black/10 dark:border-white/10">
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
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-bg-surface dark:prose-pre:bg-bg-surface prose-pre:rounded-[12px] prose-pre:border prose-pre:border-border-subtle dark:prose-pre:border-border-subtle max-w-none [&_.markdown-body>*:first-child]:!mt-0 selectable-text">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            // 串流前置期：依 message.sources 是否已回傳，動態顯示「思考中 / 檢索 / 生成中」
                            <AIThinkingIndicator
                                phase={message.sources && message.sources.length > 0 ? 'generating' : 'thinking'}
                                ragEnabled={Boolean(message.sources !== undefined)}
                            />
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
                                {onRegenerate && (
                                    <button
                                        onClick={() => onRegenerate(message.id)}
                                        className="p-1 hover:text-text-secondary rounded transition-colors"
                                        title="重新生成"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {/* token 用量：來自 chatStream usage 寫回 message.tokens */}
                                {message.tokens > 0 && (
                                    <span
                                        className="ml-1 text-[11px] tabular-nums text-text-muted/80"
                                        title={`本則回覆消耗 ${message.tokens.toLocaleString()} tokens`}
                                    >
                                        {message.tokens.toLocaleString()} tok
                                    </span>
                                )}
                                {message.content_hash && (
                                    <div className="p-1 group/hash relative cursor-help" title={`防篡改雜湊驗證\nHash: ${message.content_hash}`}>
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover/hash:block bg-[#1A1A1A] dark:bg-[#E5E5E5] text-white dark:text-black text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl z-50 border border-black/10 dark:border-white/10">
                                            Verified: {message.content_hash.substring(0, 16)}...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    )
})

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
