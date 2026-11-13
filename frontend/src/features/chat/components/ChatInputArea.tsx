import { FileText, Folder, Layers3, Paperclip, Reader, Search, X } from '@/components/snow/icons'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import { SendDotBtn, StopIcon } from './ChatIcons'
import { PromptMenu } from './PromptMenu'
import MaterialIcon from '@/components/icons/MaterialIcon'
import VoiceRecorder from './VoiceRecorder'
import { useToastStore } from '@/store/toastStore'
import { UPLOAD_ACCEPT } from '@/lib/uploadTypes'
import { riseIn } from '@/lib/motionPresets'
import InputActionsMenu, { type InputAction } from '@/components/ui/InputActionsMenu'
import { desktop, OFFICE_APPS, useDesktop, type OfficeApp } from '@/lib/desktop'
import { getErrorMessage } from '@/lib/errors'
import { BROWSER_FOLDER_MAX_FILES, BROWSER_FOLDER_MAX_TOTAL_MB, pickFolder, supportsFolderPicker } from '@/lib/browserFolder'
import { browserFolderApi } from '@/api/browserFolder'

interface ChatInputAreaProps {
    selectedFolder: string | null
    chatMode: 'general' | 'project'
    /** 目前對話的 id；全新對話（還沒送出第一則訊息）是 undefined，這時候不顯示「附加資料夾」按鈕 */
    conversationId?: string
    /** 還沒有對話時先建一個並回傳它的 id（附加檔案用；沒提供就只有已存在的對話可以附） */
    ensureConversation?: () => Promise<string | undefined>
    /** 深度研究：下一題要不要多查幾輪、寫成報告（沒給這兩個就不顯示這個功能） */
    researchOn?: boolean
    setResearchOn?: React.Dispatch<React.SetStateAction<boolean>>
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
    selectedFolder, chatMode, conversationId, ensureConversation,
    isConnecting, isUploading, uploadProgress, uploadedFiles, isStreaming,
    input, setInput, inputRef, fileInputRef,
    handleKeyDown, handleStop, handleSend, handleFileUpload, handleSendVoice,
    llmReady = true, researchOn, setResearchOn,
}: ChatInputAreaProps) {
    const { t } = useTranslation()
    const isDesktop = useDesktop()
    /** 桌面版：把 Word／Excel／PowerPoint 目前的內容接到輸入框後面（標明來源），使用者接著打問題再送出 */
    const readFromOffice = async (app: OfficeApp) => {
        const toast = useToastStore.getState().add
        try {
            const r = await desktop.read(app)
            const head = t(r.truncated ? 'ui.office.quoteHeadTruncated' : 'ui.office.quoteHead', { app: t(`ui.office.app.${app}`), name: r.name, n: r.chars })
            setInput((prev) => `${prev ? prev.trimEnd() + '\n\n' : ''}${head}\n${r.text}\n\n`)
            toast(t('ui.office.readDone', { n: r.chars }), 'success')
            setTimeout(() => inputRef.current?.focus(), 0)
        } catch (err) {
            toast(getErrorMessage(err), 'error')
        }
    }
    const toast = useToastStore()
    const [isRecording, setIsRecording] = useState(false)

    /** 瀏覽器臨時資料夾：已附加、等著送給下一則訊息的（只到使用者送出訊息或按移除為止）
     *  name 是 null 時表示重新整理頁面後恢復的狀態（伺服器只記得檔名清單，不記得資料夾本身叫什麼） */
    const [attachedFolder, setAttachedFolder] = useState<{ name: string | null; count: number; files?: boolean } | null>(null)
    /** 「附加檔案」用的隱藏檔案選取器（和上傳到專案的那一個分開：這個只附給下一則訊息，不留底） */
    const attachInputRef = useRef<HTMLInputElement>(null)
    const [folderBusy, setFolderBusy] = useState(false)
    const showFolderButton = Boolean(conversationId) && supportsFolderPicker()

    // 換了對話（或重新整理頁面）：查一下這個對話是不是已經有剛附上、還沒送出的資料夾（恢復畫面上的小標籤）
    useEffect(() => {
        setAttachedFolder(null)
        if (!conversationId) return
        let stale = false
        browserFolderApi.pending(conversationId).then((p) => {
            if (!stale && p.files.length > 0) setAttachedFolder({ name: null, count: p.files.length })
        }).catch(() => undefined)
        return () => { stale = true }
    }, [conversationId])

    const pickAndAttachFolder = async () => {
        if (!conversationId || folderBusy) return
        setFolderBusy(true)
        try {
            const picked = await pickFolder()
            if (picked.files.length === 0) { toast.error(t('chat.browserFolder.empty')); return }
            const result = await browserFolderApi.attach(conversationId, picked.files)
            if (result.accepted.length === 0) { toast.error(t('chat.browserFolder.empty')); return }
            setAttachedFolder({ name: picked.name, count: result.accepted.length })
            const suffix = picked.tooManyFiles ? t('chat.browserFolder.tooMany') : ''
            if (result.skipped.length > 0) {
                toast.info(t('chat.browserFolder.attachedSkipped', { name: picked.name, n: result.accepted.length, skipped: result.skipped.length }) + suffix)
            } else {
                toast.success(t('chat.browserFolder.attached', { name: picked.name, n: result.accepted.length }) + suffix)
            }
        } catch (err) {
            if ((err as { name?: string })?.name !== 'AbortError') toast.error(getErrorMessage(err)) // 使用者自己按取消：不用顯示成錯誤
        } finally {
            setFolderBusy(false)
        }
    }
    /** 提示詞模板面板的開關（入口在「＋」選單裡） */
    const [promptOpen, setPromptOpen] = useState(false)
    const hasPrompts = Array.isArray(t('chat.promptLibrary', { returnObjects: true }))
    /** 「＋」選單的內容：依目前的情況列出用得到的功能 */
    const actions: InputAction[] = [
        ...(hasPrompts ? [{ key: 'prompt', icon: <Reader />, label: t('chat.promptTemplatesTitle'), onSelect: () => setPromptOpen(true) }] : []),
        // 桌面版：讀取這台電腦上 Office 目前的內容（選取範圍；沒選就整份）
        ...(isDesktop ? OFFICE_APPS.map((app) => ({
            key: `office-${app}`, icon: <Layers3 />, label: t('chat.actionReadOffice', { app: t(`ui.office.app.${app}`) }),
            disabled: isStreaming, onSelect: () => readFromOffice(app),
        })) : []),
        // 附加檔案：只附給下一則訊息（不留底），所有瀏覽器和手機都能用
        ...(conversationId || ensureConversation ? [{ key: 'files', icon: <FileText />, label: t('chat.attachFiles.button'), disabled: folderBusy, onSelect: () => attachInputRef.current?.click() }] : []),
        ...(chatMode === 'project' ? [{ key: 'upload', icon: <Paperclip />, label: t('chat.actionUpload'), onSelect: () => fileInputRef.current?.click() }] : []),
        // 深度研究：下一題多查幾輪、寫成有出處的報告（只管那一題）。專案模式只根據文件回答，不提供
        ...(setResearchOn && chatMode === 'general' ? [{ key: 'research', icon: <Search />, label: t('chat.research.button'), checked: Boolean(researchOn), onSelect: () => setResearchOn((v) => !v) }] : []),
        // 附加這台電腦的資料夾（只有 Chromium 系瀏覽器支援；只附給下一則訊息，不留底）
        ...(showFolderButton ? [{ key: 'folder', icon: <Folder />, label: t('chat.browserFolder.button'), disabled: folderBusy, onSelect: pickAndAttachFolder }] : []),
    ]

    /**
     * 附加檔案：任何對話、任何瀏覽器（含手機）都能用，和附加資料夾走同一條路——
     * 只附給下一則訊息，內容先過伺服器的安全檢查，送出後就丟掉，不存進文件庫。
     */
    const attachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = '' // 同一個檔案可以再選一次
        if (files.length === 0 || folderBusy) return
        if (files.length > BROWSER_FOLDER_MAX_FILES) { toast.error(t('chat.attachFiles.tooMany', { max: BROWSER_FOLDER_MAX_FILES })); return }
        if (files.reduce((sum, f) => sum + f.size, 0) > BROWSER_FOLDER_MAX_TOTAL_MB * 1024 * 1024) { toast.error(t('chat.attachFiles.tooBig', { max: BROWSER_FOLDER_MAX_TOTAL_MB })); return }
        setFolderBusy(true)
        try {
            const id = conversationId ?? await ensureConversation?.()
            if (!id) { toast.error(t('chat.attachFiles.noConversation')); return }
            const result = await browserFolderApi.attach(id, files)
            if (result.accepted.length === 0) { toast.error(t('chat.attachFiles.empty')); return }
            setAttachedFolder({ name: result.accepted.length === 1 ? result.accepted[0] : null, count: result.accepted.length, files: true })
            if (result.skipped.length > 0) toast.info(t('chat.attachFiles.attachedSkipped', { n: result.accepted.length, skipped: result.skipped.length }))
            else toast.success(t('chat.attachFiles.attached', { n: result.accepted.length }))
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setFolderBusy(false)
        }
    }

    const removeAttachedFolder = async () => {
        if (!conversationId) return
        setAttachedFolder(null)
        try {
            await browserFolderApi.cancel(conversationId)
            toast.success(t('chat.browserFolder.removed'))
        } catch {
            // 取消失敗不影響使用者：暫存內容最多留到過期時間，不會一直卡著
        }
    }
    // 送出訊息時後端會自動把附加的資料夾內容用掉（只用一次），畫面上的小標籤跟著清掉
    const researchChip = Boolean(researchOn) && chatMode === 'general'
    const sendAndClearFolder = () => { setAttachedFolder(null); handleSend() }
    const onKeyDownClearFolder = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (attachedFolder && e.key === 'Enter' && !e.shiftKey) setAttachedFolder(null)
        handleKeyDown(e)
    }
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
                {...riseIn}
                className="chat-input-wrap shrink-0 pt-2 pb-4 md:pb-8 w-full z-20"
            >
                {!llmReady && (
                    <p className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 text-center text-xs text-[var(--ink-orange)] dark:text-[var(--ink-orange)] mb-2">
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
                            {(uploadedFiles.length > 0 || isUploading || attachedFolder || researchChip) && (
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
                                            <span>{t('ui.misc.uploading', { percent: uploadProgress })}</span>
                                        </div>
                                    )}
                                    {/* 深度研究開著：讓使用者看得到「這一題會做研究」（比較久），也可以直接取消 */}
                                    {researchChip && (
                                        <div className="flex items-center gap-1.5 snow-well pl-3 pr-1.5 py-1.5 rounded-full text-[length:var(--fs-13)] animate-fade-in-up">
                                            <Search className="w-4 h-4 text-accent" />
                                            <span className="text-text-primary">{t('chat.research.chip')}</span>
                                            <button type="button" onClick={() => setResearchOn?.(false)} aria-label={t('chat.research.remove')} className="icon-tap !w-5 !h-5 text-text-secondary">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    {/* 瀏覽器臨時資料夾：只附這一次，所以多一顆移除鈕（上面的上傳檔案是長期存到專案的，不能這樣取消） */}
                                    {attachedFolder && (
                                        <div className="flex items-center gap-1.5 snow-well pl-3 pr-1.5 py-1.5 rounded-full text-[length:var(--fs-13)] animate-fade-in-up">
                                            {attachedFolder.files ? <FileText className="w-4 h-4 text-accent" /> : <Folder className="w-4 h-4 text-accent" />}
                                            <span className="truncate max-w-[var(--sz-120)] text-text-primary">
                                                {attachedFolder.files
                                                    ? (attachedFolder.name ?? t('chat.attachFiles.chip', { n: attachedFolder.count }))
                                                    : t('chat.browserFolder.chip', { name: attachedFolder.name ?? t('chat.browserFolder.restoredName'), n: attachedFolder.count })}
                                            </span>
                                            <button type="button" onClick={removeAttachedFolder} aria-label={t('chat.browserFolder.remove')} className="icon-tap !w-5 !h-5 text-text-secondary">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input Row: smaller padding on mobile so buttons fit
                                左右對稱 padding：原本只有 pl 沒有 pr，導致 Stop / Send 按鈕貼到 bubble 右邊緣，
                                看起來像「凸出來」沒包住的 spacing。pr-3 sm:pr-4 讓右側留 12-16px 視覺呼吸。 */}
                            <div className="flex items-end gap-1 sm:gap-1.5 p-[var(--field-pad)] min-w-0">
                                {/* 左邊只有一顆「＋」：提示詞模板、讀取 Office、上傳文件、對外搜尋、附加資料夾都收在它的選單裡 */}
                                <PromptMenu
                                    inline
                                    hideButton
                                    open={promptOpen}
                                    onOpenChange={setPromptOpen}
                                    disabled={isConnecting || isUploading}
                                    onSelect={(prompt: string) => {
                                        setInput((prev) => prev ? prompt + prev : prompt)
                                        setTimeout(() => inputRef.current?.focus(), 0)
                                    }}
                                />
                                <InputActionsMenu label={t('chat.moreActions')} items={actions} disabled={isConnecting || isUploading} />
                                <input ref={attachInputRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={attachFiles} aria-hidden tabIndex={-1} />

                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKeyDownClearFolder}
                                    placeholder={chatMode === 'project' ? t('chat.projectInputPlaceholder') : t('chat.inputPlaceholder')}
                                    rows={1}
                                    disabled={isConnecting || !llmReady}
                                    className={`flex-1 min-w-0 resize-none bg-transparent text-text-primary placeholder:text-text-muted dark:placeholder:text-text-muted outline-none px-1.5 sm:px-2 py-[calc((var(--field-btn)-var(--sz-38))/2+var(--sp-8))] min-h-[var(--field-btn)] disabled:opacity-50 text-[length:var(--fs-15)] sm:text-[length:var(--fs-16)] border-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-[height] duration-300 ease-apple ${expanded ? '!h-[min(55vh,480px)] !max-h-none' : 'max-h-[var(--sz-160)]'}`}
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
                                        <button onClick={handleStop} aria-label={t('chat.stopGeneration')} className="flex transition-transform active:scale-95">
                                            <StopIcon />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={sendAndClearFolder}
                                            disabled={!input.trim() || isConnecting || !llmReady}
                                            aria-label={t('chat.sendMessage')}
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
