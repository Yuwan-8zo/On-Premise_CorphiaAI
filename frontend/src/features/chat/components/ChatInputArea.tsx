import React, { useState } from 'react'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import { SendDotBtn, StopIcon } from './ChatIcons'
import { PromptMenu } from './PromptMenu'
import MaterialIcon from '@/components/icons/MaterialIcon'
import VoiceRecorder from './VoiceRecorder'
import { useToastStore } from '@/store/toastStore'

interface ChatInputAreaProps {
    selectedFolder: string | null
    chatMode: 'general' | 'project'
    isConnecting: boolean
    isUploading: boolean
    uploadProgress: number
    uploadedFiles: File[]
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
}

export default function ChatInputArea({
    selectedFolder, chatMode,
    isConnecting, isUploading, uploadProgress, uploadedFiles, isStreaming,
    input, setInput, inputRef, fileInputRef,
    handleKeyDown, handleStop, handleSend, handleFileUpload, handleSendVoice,
}: ChatInputAreaProps) {
    const { t } = useTranslation()
    const toast = useToastStore()
    const [isRecording, setIsRecording] = useState(false)

    // 當進入「專案資料夾管理視圖」時，隱藏聊天輸入框，
    // 但仍要保留隱藏的 <input type="file">，
    // 這樣資料夾右上角的「新增來源」按鈕透過 fileInputRef 才能觸發檔案選擇對話框。
    if (selectedFolder) {
        return (
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
                multiple
            />
        )
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease:"easeOut" }}
                className="shrink-0 pt-2 pb-4 md:pb-8 w-full z-20"
            >
                {/* Mobile RWD: tighter horizontal padding + min-w-0 so flex-1 children shrink */}
                <div data-tour="chat-input" className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 w-full relative flex items-end gap-1.5 sm:gap-2 min-w-0">
                    {/* 顯示提示詞選擇器（手機板 < sm 時隱藏，騰出 textarea 空間）
                        mb-1.5 對齊 input bubble 內的 Send / Stop 按鈕底部位置（line 160 的 mb-1.5），
                        原本 mb-3.5 會把 sparkle 按鈕推到 bubble 中央偏上，視覺看起來「飄」起來。 */}
                    {!isRecording && (
                        <div className="hidden sm:block shrink-0 mb-1.5">
                            <PromptMenu
                                disabled={isConnecting || isUploading}
                                onSelect={(prompt: string) => {
                                    setInput((prev) => prev ? prompt + prev : prompt)
                                    setTimeout(() => inputRef.current?.focus(), 0)
                                }}
                            />
                        </div>
                    )}

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
                        <div className="relative flex-1 min-w-0 flex flex-col bg-bg-base border border-border-subtle rounded-[30px] shadow-md dark:shadow-black/40 transition-all duration-300 focus-within:border-accent dark:focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(139,115,85,0.15)] focus-within:ring-0 dark:focus-within:ring-0">

                            {/* Tags / Files Row */}
                            {(uploadedFiles.length > 0 || isUploading) && (
                                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                                    {uploadedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-bg-surface px-3 py-1.5 rounded-full text-[13px] border border-transparent animate-fade-in-up">
                                            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <span className="truncate max-w-[120px] text-text-primary">{f.name}</span>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="flex items-center gap-2 bg-bg-surface px-3 py-1.5 rounded-full text-[13px] text-light-accent border border-border-subtle">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-border-subtle border-t-transparent animate-spin" />
                                            <span>上傳中... {uploadProgress}%</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input Row: smaller padding on mobile so buttons fit
                                左右對稱 padding：原本只有 pl 沒有 pr，導致 Stop / Send 按鈕貼到 bubble 右邊緣，
                                看起來像「凸出來」沒包住的 spacing。pr-3 sm:pr-4 讓右側留 12-16px 視覺呼吸。 */}
                            <div className="flex items-end gap-1.5 sm:gap-2 p-2 pl-3 sm:pl-4 pr-3 sm:pr-4 min-w-0">
                                {chatMode === 'project' && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isConnecting || isUploading}
                                        className="p-2 transition-transform active:scale-95 text-text-muted hover:text-corphia-bronze mb-1 disabled:opacity-50"
                                        title="上傳專案文件 (NotebookLM 模式)"
                                    >
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-[22px] h-[22px]">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                    </button>
                                )}

                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={chatMode === 'project' ? t('chat.projectInputPlaceholder') : t('chat.inputPlaceholder')}
                                    rows={1}
                                    disabled={isConnecting}
                                    className="flex-1 min-w-0 resize-none bg-transparent text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted outline-none px-1.5 sm:px-2 py-[10px] max-h-[160px] disabled:opacity-50 text-[15px] sm:text-[16px] border-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                    style={{ lineHeight: '1.4' }}
                                />

                                {/* 麥克風按鈕：輸入為空時才顯示，避免干擾送出按鈕 */}
                                {handleSendVoice && !isStreaming && !input.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => setIsRecording(true)}
                                        disabled={isConnecting || isUploading}
                                        className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 disabled:opacity-50 transition-colors mb-1"
                                        title={t('chat.voice.startRecording')}
                                        aria-label={t('chat.voice.startRecording')}
                                    >
                                        <MaterialIcon name="mic" size={22} />
                                    </button>
                                )}

                                <div className="shrink-0 mb-1.5">
                                    {isStreaming ? (
                                        <button onClick={handleStop} className="transition-transform active:scale-95">
                                            <StopIcon />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSend()}
                                            disabled={!input.trim() || isConnecting}
                                            className="transition-transform active:scale-95"
                                        >
                                            <SendDotBtn disabled={!input.trim() || isConnecting} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* hidden upload specific for chat view */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.docx,.xlsx,.pptx,.txt,.md"
                multiple
            />
        </>
    )
}
