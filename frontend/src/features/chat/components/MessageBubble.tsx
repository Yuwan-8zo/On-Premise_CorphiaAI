/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import AIThinkingIndicator from './AIThinkingIndicator'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import FileAttachments from './FileAttachments'
import OfficeMenu from '@/components/ui/OfficeMenu'
import { desktop, useDesktop, type OfficeApp } from '@/lib/desktop'
import RAGDebugPanel from './RAGDebugPanel'
import AudioMessage from './AudioMessage'
import type { Message } from '@/types/chat'
import { CorphiaLogo, CorphiaThinkingIcon } from '@/components/icons/CorphiaIcons'
import { Edit2, Check, X, RefreshCw, Layers3 } from '@/components/snow/icons'
import { CopyIcon, ItshoverIcon } from '@/components/icons/itshover'
import { conversationsApi } from '@/api/conversations'
import { useChatStore } from '@/store/chatStore'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/components/ui/Tooltip'
import { copyText } from '@/lib/clipboard'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { riseIn } from '@/lib/motionPresets'

/** 操控 Office 的結果提示停留多久（毫秒）：要讓使用者來得及讀「寫到哪、有沒有備份」 */
const OFFICE_TOAST_MS = 6000

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
    <div className="relative w-9 h-9 flex-shrink-0 -mt-[var(--sp-3)]">
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
    const isDesktop = useDesktop()
    /** 寫入 Office：成功說明寫到哪、有沒有備份；失敗顯示原因（例如「Word 沒有開啟的文件」） */
    const writeToOffice = async (app: OfficeApp) => {
        const toast = useToastStore.getState().add
        try {
            const r = await desktop.write(app, message.content)
            toast(r.backup ? t('ui.office.writtenBackup', { detail: r.detail }) : r.detail, 'success', OFFICE_TOAST_MS)
        } catch (err) {
            toast(getErrorMessage(err), 'error', OFFICE_TOAST_MS)
        }
    }
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
        if (await copyText(message.content)) {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
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

    // 複製按鈕（使用者訊息、AI 回覆共用）
    const copyButton = (
        <Tooltip placement="bottom" label={t('ui.message.copy')}><button onClick={handleCopy} aria-label={t('ui.message.copy')} className="btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted">
            {/* 複製圖示保持掛載（只隱藏），避免它的懸停動畫打到已移除的元素 */}
            <span className="relative inline-flex">
                <span className={isCopied ? 'opacity-0' : ''}><ItshoverIcon icon={CopyIcon} size={14} interactive /></span>
                {isCopied && <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-[var(--ink-green)]" aria-hidden />}
            </span>
        </button></Tooltip>
    )

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
            initial={riseIn.initial}
            animate={riseIn.animate}
            transition={riseIn.transition}
            data-role={message.role}
            className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}
        >
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                // 編輯模式：把外層撐到 max-w 的 75%，textarea 才能跟原本訊息氣泡同寬
                // （原本 min-w-[var(--sz-250)] 會讓編輯框比訊息本身還窄，文字被擠成多行）
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
                                <div className="mt-1.5 max-w-full rounded-[var(--r-14)] border border-[color-mix(in_srgb,var(--sys-red)_20%,transparent)] bg-[color-mix(in_srgb,var(--sys-red)_5%,transparent)] px-3 py-1.5 text-xs text-[var(--ink-red)]">
                                    {t('chat.voice.transcribeFailed')}
                                </div>
                            )}
                            {!message.audio.pending && message.audio.transcript && message.content && (
                                <div className="glass-chip text-text-primary rounded-[var(--r-22)] px-5 py-3 mt-1.5 whitespace-pre-wrap text-[length:var(--fs-15d5)] leading-relaxed selectable-text">
                                    {message.content}
                                </div>
                            )}
                        </>
                    ) : (
                        isEditing ? (
                            // 編輯訊息（iMessage 編輯）：整個氣泡就是一個玻璃輸入欄位；右下角兩顆 30 小圓鈕（取消／確認）
                            // 欄位圓角 22 ＝ 按鈕圓角 15 ＋ 離邊 7（同心）
                            <div className="msg-edit glass-field w-full">
                                <textarea
                                    ref={editTextareaRef}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') { setEditContent(message.content); setIsEditing(false) }
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit()
                                    }}
                                    aria-label={t('ui.message.editMessage')}
                                    className="msg-edit-input scrollbar-none"
                                    rows={1}
                                />
                                <div className="msg-edit-actions">
                                    <button
                                        onClick={() => { setEditContent(message.content); setIsEditing(false) }}
                                        aria-label={t('common.cancel')}
                                        className="btn-icon btn-icon-plain msg-edit-btn !bg-[var(--chip)] text-text-primary"
                                    >
                                        <X className="w-[var(--sz-15)] h-[var(--sz-15)]" />
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        aria-label={t('ui.message.saveEdit')}
                                        disabled={!editContent.trim()}
                                        className="btn-icon btn-icon-plain msg-edit-btn !bg-[var(--accent-fill)] !text-[var(--text-on-accent)] disabled:opacity-40"
                                    >
                                        <Check className="w-[var(--sz-15)] h-[var(--sz-15)]" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-chip text-text-primary rounded-[var(--r-22)] px-5 py-3 whitespace-pre-wrap text-[length:var(--fs-15d5)] leading-relaxed relative selectable-text">
                                {message.content}
                            </div>
                        )
                    )}
                    {!isEditing && !hideActions && (
                        <div className="hover-reveal flex items-center gap-1.5 mt-1 text-text-muted mr-2">
                            {copyButton}
                            {/* 編輯：只對「文字訊息」或「有 transcript 的語音訊息」開放 */}
                            {!message.blocked && (!message.audio || message.audio.transcript) && (
                                <Tooltip placement="bottom" label={t('ui.message.edit')}><button aria-label={t('ui.message.edit')} onClick={() => { setEditContent(message.audio?.transcript || message.content); setIsEditing(true); }} className="btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted">
                                    <Edit2 />
                                </button></Tooltip>
                            )}
                            {/*
                              重新傳送：保留原訊息內容，重跑 AI 回覆。
                              直接用 onResubmit(messageId, 原內容)；上層會截斷此訊息之後的歷史並重新送 LLM。
                              無轉錄的純語音訊息沒有可送 LLM 的文字，直接隱藏此按鈕。
                            */}
                            {onResubmit && !message.blocked && !message.id.startsWith('temp-') && (!message.audio || message.audio.transcript) && (
                                <button
                                    onClick={() => onResubmit(message.id, message.audio?.transcript || message.content)}
                                    className="btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted"
                                >
                                    <RefreshCw />
                                </button>
                            )}
                            {message.tokens > 0 && (
                                <span
                                    className="ml-1 text-[length:var(--fs-11)] tabular-nums text-text-muted/80"
                                >
                                    {message.tokens.toLocaleString()} tok
                                </span>
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
                    <div className="flex-1 min-w-0 text-text-primary text-[length:var(--fs-15d5)] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-[var(--chip)] dark:prose-pre:bg-[var(--chip)] prose-pre:rounded-[var(--r-12)] prose-pre:border prose-pre:border-[var(--paper-line)] dark:prose-pre:border-[var(--paper-line)] max-w-none [&_.markdown-body>*:first-child]:!mt-0 selectable-text">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            // 串流前置期：依 message.sources 是否已回傳，動態顯示「思考中 / 檢索 / 生成中」
                            <AIThinkingIndicator
                                making={message.making}
                                phase={message.sources && message.sources.length > 0 ? 'generating' : 'thinking'}
                                ragEnabled={Boolean(message.sources !== undefined)}
                                readingDocs={Boolean(message.sources && message.sources.length > 0)}
                            />
                        ) : null}

                        {/* AI 產出的檔案（Word、Excel、簡報）：檔案卡片＋下載 */}
                        {message.attachments && message.attachments.length > 0 && <FileAttachments files={message.attachments} />}

                        {/* 來源引用：回答完成後才顯示，避免還沒回答就先出現「參考了哪些段落」 */}
                        {!isStreaming && message.sources && message.sources.length > 0 && (
                            <div className="mt-4">
                                <SourceCitations sources={message.sources} />
                            </div>
                        )}

                        {/* C2: RAG 除錯面板 — 僅在最後一則 AI 訊息且開啟 Debug Mode 時顯示 */}
                        {showRAGDebug && !isStreaming && message.sources && message.sources.length > 0 && (
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

                        {/* 工具列：滑鼠裝置移入才浮現，手機一直顯示（.hover-reveal） */}
                        {message.content && !isStreaming && !hideActions && (
                            <div className="hover-reveal flex items-center gap-1.5 mt-2 text-text-muted">
                                {copyButton}
                                {onRegenerate && !message.blocked && (
                                    <button
                                        onClick={() => onRegenerate(message.id)}
                                        className="btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted"
                                        >
                                        <RefreshCw />
                                    </button>
                                )}
                                {/* 桌面版：把這則回答寫進這台電腦的 Word（游標處）／Excel（目前儲存格起）／PowerPoint（新增一張） */}
                                {isDesktop && !message.blocked && (
                                    <OfficeMenu
                                        label={t('ui.office.write')}
                                        icon={<Layers3 />}
                                        buttonClassName="btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted"
                                        onPick={writeToOffice}
                                    />
                                )}
                                {/* token 用量：來自 chatStream usage 寫回 message.tokens */}
                                {message.tokens > 0 && (
                                    <Tooltip placement="bottom" label={t('ui.message.tokensUsed', { n: message.tokens.toLocaleString() })}>
                                        <span
                                            className="ml-1 text-[length:var(--fs-11)] tabular-nums text-text-muted/80"
                                        >
                                            {message.tokens.toLocaleString()} tok
                                        </span>
                                    </Tooltip>
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
