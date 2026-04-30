import React from 'react'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import { SendDotBtn, StopIcon } from './ChatIcons'
import { PromptMenu } from './PromptMenu'

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
}

export default function ChatInputArea({
    selectedFolder, chatMode,
    isConnecting, isUploading, uploadProgress, uploadedFiles, isStreaming,
    input, setInput, inputRef, fileInputRef,
    handleKeyDown, handleStop, handleSend, handleFileUpload
}: ChatInputAreaProps) {
    const { t } = useTranslation()

    if (selectedFolder) return null // Hide input if in project management folder view

    return (
        <>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3, ease:"easeOut" }}
                className="shrink-0 pt-2 pb-6 md:pb-8 w-full z-20"
            >
                <div className="max-w-3xl mx-auto px-4 md:px-0 w-full relative flex items-end gap-2">
                    {/* 顯示提示詞選擇器 (固定在左側) */}
                    <div className="shrink-0 mb-3.5">
                        <PromptMenu 
                            disabled={isConnecting || isUploading}
                            onSelect={(prompt: string) => {
                                setInput((prev) => prev ? prompt + prev : prompt)
                                setTimeout(() => inputRef.current?.focus(), 0)
                            }} 
                        />
                    </div>

                    <div className="relative flex-1 flex flex-col bg-bg-base border border-border-subtle rounded-[30px] shadow-md dark:shadow-black/40 transition-all duration-300 focus-within:border-accent dark:focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(139,115,85,0.15)] focus-within:ring-0 dark:focus-within:ring-0">
                        
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

                        {/* Input Row */}
                        <div className="flex items-end gap-2 p-2 pl-4">
                            {chatMode === 'project' && (
                                <>
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
                                </>
                            )}
                            
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={chatMode === 'project' ? t('chat.projectInputPlaceholder') : t('chat.inputPlaceholder')}
                                rows={1}
                                disabled={isConnecting}
                                className="flex-1 resize-none bg-transparent text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted outline-none px-2 py-[10px] max-h-[160px] disabled:opacity-50 text-[16px] border-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                style={{ lineHeight: '1.4' }}
                            />
                            
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
                </div>
            </motion.div>
            
            {/* hidden upload specific for chat view */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
                accept=".pdf,.docx,.xlsx,.txt,.md"
            />
        </>
    )
}
