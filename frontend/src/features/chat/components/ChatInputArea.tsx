import { FileText, Paperclip } from '@/components/snow/icons'
import React, { useLayoutEffect, useState } from 'react'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import { SendDotBtn, StopIcon } from './ChatIcons'
import { PromptMenu } from './PromptMenu'
import MaterialIcon from '@/components/icons/MaterialIcon'
import VoiceRecorder from './VoiceRecorder'
import { useToastStore } from '@/store/toastStore'
import { UPLOAD_ACCEPT } from '@/lib/uploadTypes'

interface ChatInputAreaProps {
    selectedFolder: string | null
    chatMode: 'general' | 'project'
    isConnecting: boolean
    isUploading: boolean
    uploadProgress: number
    uploadedFiles: { name: string }[]
    isStreaming: boolean

    input: string
    setInput: React.Dispatch<React.SetStateAction<string>>
    inputRef: React.RefObject<HTMLTextAreaElement | null>
    fileInputRef: React.RefObject<HTMLInputElement | null>

    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    handleStop: () => void
    handleSend: () => void
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    /** 語音訊息送出（可選；若不提供則隱藏麥克風按鈕）。轉錄交給後端 Whisper，前端只送 audio。 */
    handleSendVoice?: (payload: {
        blob: Blob
        url: string
        mimeType: string
        durationMs: number
    }) => void
    /** false 時禁用送出（AI 模型背景載入中） */
    llmReady?: boolean
}

export default function ChatInputArea({
    selectedFolder, chatMode,
    isConnecting, isUploading, uploadProgress, uploadedFiles, isStreaming,
    input, setInput, inputRef, fileInputRef,
    handleKeyDown, handleStop, handleSend, handleFileUpload, handleSendVoice,
    llmReady = true,
}: ChatInputAreaProps) {
    const { t } = useTranslation()
    const toast = useToastStore()
    const [isRecording, setIsRecording] = useState(false)
    // 輸入內容超過欄位最大高度（160）時，送出鈕左邊出現「放大」鈕；放大後欄位變高，方便編輯長文
    const [overflowing, setOverflowing] = useState(false)
    const [expanded, setExpanded] = useState(false)
    useLayoutEffect(() => {
        const el = inputRef.current
        if (!el) return
        if (!input && expanded) {
            setExpanded(false) // 送出、清空（含全選刪除）後自動縮回；縮回後這段會再跑一次重算高度
            return
        }
        if (!expanded) {
            // 依實際內容重算高度（放大狀態剛取消時，先前算的高度還是放大時的，要重算才會正常縮回）
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`
        }
        setOverflowing(el.scrollHeight > 162)
    }, [input, expanded, inputRef])

    // 當進入「專案資料夾管理視圖」時，隱藏聊天輸入框，
    // 但仍要保留隱藏的 <input type="file">，
    // 這樣資料夾右上角的「新增來源」按鈕透過 fileInputRef 才能觸發檔案選擇對話框。
    // 隱藏的上傳欄位（聊天畫面與資料夾管理畫面共用）
    const fileInput = (
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept={UPLOAD_ACCEPT}
            multiple
        />
    )

    if (selectedFolder) {
        return fileInput
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease:"easeOut" }}
                className="shrink-0 pt-2 pb-4 md:pb-[var(--gutter)] md:px-[var(--gutter)] w-full z-20"
            >
                {!llmReady && (
                    <p className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 text-center text-xs text-[var(--sys-orange)] dark:text-[var(--sys-orange)] mb-2">
                        {t('chat.llmWarming', 'AI 模型載入中，完成後即可對話…')}
                    </p>
                )}
                {/* Mobile RWD: tighter horizontal padding + min-w-0 so flex-1 children shrink */}
                <div data-tour="chat-input" className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 w-full relative flex items-end gap-1.5 sm:gap-2 min-w-0">
                    {isRecording ? (
                        <div className="flex-1 mb-1">
                            <VoiceRecorder
                                onCancel={() => setIsRecording(false)}
                                onSend={(payload) => {
                                    setIsRecording(false)
                                    handleSendVoice?.(payload)
                                }}
                                onError={(msg) => toast.error(msg)}
                            />
                        </div>
                    ) : (
                        <div className="relative flex-1 min-w-0 flex flex-col glass-field">

                            {/* Tags / Files Row */}
                            {(uploadedFiles.length > 0 || isUploading) && (
                                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                                    {uploadedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-1.5 snow-well px-3 py-1.5 rounded-full text-[length:var(--fs-13)] animate-fade-in-up">
                                            <FileText className="w-4 h-4 text-text-secondary" />
                                            <span className="truncate max-w-[var(--sz-120)] text-text-primary">{f.name}</span>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="flex items-center gap-2 snow-well px-3 py-1.5 rounded-full text-[length:var(--fs-13)] text-accent">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--paper-line)] border-t-transparent animate-spin" />
                                            <span>上傳中... {uploadProgress}%</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input Row: smaller padding on mobile so buttons fit
                                左右對稱 padding：原本只有 pl 沒有 pr，導致 Stop / Send 按鈕貼到 bubble 右邊緣，
                                看起來像「凸出來」沒包住的 spacing。pr-3 sm:pr-4 讓右側留 12-16px 視覺呼吸。 */}
                            <div className="flex items-end gap-1 sm:gap-1.5 p-[var(--field-pad)] min-w-0">
                                {/* 提示詞模版：放在欄位內左側，38 圓鈕、四邊內距 6，與外框同心 */}
                                <PromptMenu
                                    inline
                                    disabled={isConnecting || isUploading}
                                    onSelect={(prompt: string) => {
                                        setInput((prev) => prev ? prompt + prev : prompt)
                                        setTimeout(() => inputRef.current?.focus(), 0)
                                    }}
                                />

                                {chatMode === 'project' && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isConnecting || isUploading}
                                        className="btn-icon btn-icon-plain !w-[var(--field-btn)] !h-[var(--field-btn)] text-text-secondary disabled:opacity-50"
                                    >
                                        <Paperclip className="w-[calc(var(--sz-22)*var(--field-bk,1))] h-[calc(var(--sz-22)*var(--field-bk,1))]" />
                                    </button>
                                )}

                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={chatMode === 'project' ? t('chat.projectInputPlaceholder') : t('chat.inputPlaceholder')}
                                    rows={1}
                                    disabled={isConnecting || !llmReady}
                                    className={`flex-1 min-w-0 resize-none bg-transparent text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted outline-none px-1.5 sm:px-2 py-[calc((var(--field-btn)-1.4em)/2)] min-h-[var(--field-btn)] disabled:opacity-50 text-[length:var(--fs-15)] sm:text-[length:var(--fs-16)] border-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-[height] duration-300 ease-apple ${expanded ? '!h-[min(55vh,480px)] !max-h-none' : 'max-h-[var(--sz-160)]'}`}
                                    style={{ lineHeight: '1.4' }}
                                />

                                {/* 麥克風按鈕：輸入為空時才顯示，避免干擾送出按鈕 */}
                                {handleSendVoice && !isStreaming && !input.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => setIsRecording(true)}
                                        disabled={isConnecting || isUploading}
                                        className="btn-icon btn-icon-plain !w-[var(--field-btn)] !h-[var(--field-btn)] text-text-secondary disabled:opacity-50"
                                        aria-label={t('chat.voice.startRecording')}
                                    >
                                        <MaterialIcon name="mic" className="w-[calc(var(--sz-22)*var(--field-bk,1))] h-[calc(var(--sz-22)*var(--field-bk,1))]" />
                                    </button>
                                )}

                                {/* 放大／縮小：內容超出欄位高度（或已放大）時才出現，在送出鈕左邊 */}
                                {!isStreaming && (overflowing || expanded) && (
                                    <button
                                        type="button"
                                        onClick={() => { setExpanded((v) => !v); setTimeout(() => inputRef.current?.focus(), 0) }}
                                        className="btn-icon btn-icon-plain !w-[var(--field-btn)] !h-[var(--field-btn)] text-text-secondary"
                                        aria-label={expanded ? t('chat.collapseInput', '縮小輸入欄') : t('chat.expandInput', '放大輸入欄')}
                                        aria-pressed={expanded}
                                    >
                                        {expanded ? (
                                            <svg viewBox="0 0 512 512" className="w-[calc(var(--sz-20)*var(--field-bk,1))] h-[calc(var(--sz-20)*var(--field-bk,1))]" fill="none" stroke="currentColor" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M304 416V304h112M314.2 314.23L432 432M208 96v112H96M197.8 197.77L80 80" /></svg>
                                        ) : (
                                            <svg viewBox="0 0 512 512" className="w-[calc(var(--sz-20)*var(--field-bk,1))] h-[calc(var(--sz-20)*var(--field-bk,1))]" fill="none" stroke="currentColor" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M432 320v112H320M421.8 421.77L304 304M80 192V80h112M90.2 90.23L208 208" /></svg>
                                        )}
                                    </button>
                                )}

                                <div className="shrink-0 flex">
                                    {isStreaming ? (
                                        <button onClick={handleStop} className="flex transition-transform active:scale-95">
                                            <StopIcon />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSend()}
                                            disabled={!input.trim() || isConnecting || !llmReady}
                                            className="flex transition-transform active:scale-95"
                                        >
                                            <SendDotBtn disabled={!input.trim() || isConnecting || !llmReady} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* hidden upload specific for chat view */}
            {fileInput}
        </>
    )
}
