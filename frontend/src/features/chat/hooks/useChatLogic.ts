/**
 * 聊天頁的總控：把各個小 hook 組起來，處理「對話」本身的動作（選取、新增、刪除、送出、重新生成、語音）
 * 再整理成各區塊元件要的 props（側欄／頂端列／輸入列／彈窗／訊息區）
 *
 *   useChatSocket            即時連線
 *   useChatScroll            訊息區捲動、往上載入舊訊息
 *   useModels                模型選單
 *   useFolders               專案資料夾與文件
 *   useFileUpload            上傳文件
 *   useConversationDialogs   「⋯」選單、重新命名／移動／新資料夾彈窗、分享、驗證
 *   chatHelpers              共用小工具（暫時訊息、模擬打字、資料夾文件查詢）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { conversationsApi } from '@/api/conversations'
import { documentsApi } from '@/api/documents'
import { foldersApi } from '@/api/folders'
import { webSearchApi } from '@/api/webSearch'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useSystemStore, selectLlmReady } from '@/store/systemStore'
import { useToastStore } from '@/store/toastStore'
import { getErrorMessage } from '@/lib/errors'
import { useStableCallback } from '@/lib/useStableCallback'
import { useUIStore } from '@/store/uiStore'
import type { Conversation } from '@/types/chat'
import {
    MESSAGE_PAGE_SIZE, dropLastMessage, folderOf, listFolderDocs, noDocsText, replaceLastMessage, tempMessage, typeOut,
} from './chatHelpers'
import { useChatScroll } from './useChatScroll'
import { useChatSocket } from './useChatSocket'
import { useConversationDialogs } from './useConversationDialogs'
import { useFileUpload } from './useFileUpload'
import { useFolders } from './useFolders'
import { useModels } from './useModels'
import i18n from '@/i18n'
import { DEFAULT_CONVERSATION_TITLE } from '@/lib/conversationTitle'
import { isDesktop } from '@/lib/useMediaQuery'

type ChatMode = 'general' | 'project'

export function useChatLogic() {
    const llmReady = useSystemStore(selectLlmReady)
    const { t } = useTranslation()
    const toast = useToastStore()
    const { user } = useAuthStore()
    const {
        conversations, currentConversation, messages, isStreaming,
        setConversations, addConversation, setCurrentConversation, setMessages, addMessage,
        setStreaming, appendToLastMessage, deleteConversation,
    } = useChatStore()
    const { sidebarOpen, toggleSidebar, setSidebarOpen, showConfirm, language, ragDebugMode } = useUIStore()

    const [input, setInput] = useState('')
    const [chatMode, setChatMode] = useState<ChatMode>('general')
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // 對外搜尋：這個租戶看不看得到開關、要不要每次先問使用者才搜（enabled=false 時整個功能不顯示）
    const [webSearchOn, setWebSearchOn] = useState(false)
    const [searchPolicy, setSearchPolicy] = useState<{ enabled: boolean; auto: boolean }>({ enabled: false, auto: false })
    useEffect(() => {
        webSearchApi.policy().then(setSearchPolicy).catch(() => undefined) // 查不到就當沒開，不影響其他功能
    }, [])

    const socket = useChatSocket()
    const scroll = useChatScroll(messages, currentConversation?.id)
    const models = useModels()
    const folders = useFolders()
    const { selectedFolder, setSelectedFolder, loadFolderDocuments } = folders
    const dialogs = useConversationDialogs({ setChatMode, loadFolders: folders.loadFolders })
    const upload = useFileUpload({
        resolveFolder: () => selectedFolder || folderOf(currentConversation?.settings),
        onUploaded: async (file) => {
            if (selectedFolder) await loadFolderDocuments(selectedFolder)
            else upload.setUploadedFiles((prev) => [...prev, { name: file.name }])
        },
    })

    // 進頁面先載入對話清單
    useEffect(() => {
        conversationsApi.list()
            .then((result) => setConversations(result.data))
            .catch((error) => console.error('載入對話列表失敗:', error))
    }, [setConversations])

    const selectConversation = useCallback(async (conversation: Conversation | null) => {
        if (!conversation) return
        const state = useChatStore.getState()

        setSelectedFolder(null)
        if (!isDesktop()) setSidebarOpen(false)

        // 唯一不重新載入的情況：同一個對話且還在生成中（避免中斷進行中的回覆）
        if (state.currentConversation?.id === conversation.id && state.isStreaming) return

        // 切換對話：舊對話若還在生成，它的訊息與連線留在背景繼續跑（多工）
        setCurrentConversation(conversation)
        scroll.followBottom()

        // 切回背景中還在生成的對話：直接接上它目前的進度，不重新載入（後端還沒存完）
        if (useChatStore.getState().streamingIds[conversation.id]) {
            await socket.connect(conversation.id)
            return
        }

        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
            // 等待期間使用者又切去別的對話 → 丟掉這次結果
            if (useChatStore.getState().currentConversation?.id !== conversation.id) return
            useChatStore.getState().setServerMessages(conversation.id, msgs)
            scroll.setHasMoreMessages(msgs.length === MESSAGE_PAGE_SIZE)
            await socket.connect(conversation.id)
        } catch (error) {
            console.error('載入訊息失敗:', error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCurrentConversation, setMessages, socket.connect, setSidebarOpen, setSelectedFolder])

    /** 還沒有對話時先建一個並連線；回傳對話 id（失敗回傳 undefined，畫面仍照常顯示） */
    const ensureConversation = async (title: string) => {
        if (currentConversation?.id) return currentConversation.id
        try {
            const conversation = await conversationsApi.create({ title, settings: { isProject: chatMode === 'project' } })
            addConversation(conversation)
            setCurrentConversation(conversation)
            await socket.connect(conversation.id)
            return conversation.id
        } catch (error) {
            console.error('建立對話失敗:', error)
            return undefined
        }
    }

    /** 預設標題的對話（用「新對話」按鈕開的）送出第一句話時，改用這句話當標題，清單上才分得出來 */
    const autoTitle = async (conversationId: string | undefined, text: string) => {
        const st = useChatStore.getState()
        const conv = st.conversations.find((c) => c.id === conversationId)
        if (!conversationId || !conv || conv.title !== DEFAULT_CONVERSATION_TITLE || st.messages.length > 0) return
        const title = text.slice(0, 50)
        st.updateConversation(conversationId, { title })
        try {
            await conversationsApi.update(conversationId, { title })
        } catch (err) {
            console.error('更新對話標題失敗:', err)
        }
    }

    /** 把問題交給 AI：有即時連線就串流，沒有就改用一般請求（拿到完整回覆一次換上） */
    const askAI = async (conversationId: string | undefined, text: string, webSearch = false) => {
        const useRag = chatMode === 'project'
        const ws = socket.get(conversationId)
        if (ws) {
            ws.sendMessage(text, useRag, 0.7, language, 2048, webSearch)
            return
        }
        try {
            if (conversationId) replaceLastMessage(await conversationsApi.sendMessage(conversationId, { content: text, useRag, webSearch }))
        } catch (error) {
            console.error('發送訊息失敗:', error)
            dropLastMessage()
        } finally {
            setStreaming(false)
        }
    }

    /** 專案資料夾裡還沒有可用文件：不問 AI，直接用打字效果提示先上傳 */
    const replyNoDocs = async (folderName: string) => {
        await typeOut(noDocsText(folderName), appendToLastMessage)
        setStreaming(false)
    }

    const createNewConversation = async () => {
        if (chatMode === 'project') {
            dialogs.openNewFolderModal()
            return
        }
        // 目前這則還沒有任何訊息時直接沿用，避免連按產生一堆空白「新對話」
        const state = useChatStore.getState()
        if (state.currentConversation && !state.currentConversation.settings?.isProject && state.messages.length === 0) {
            upload.setUploadedFiles([])
            return
        }
        // 已經有一則還沒講過話的一般對話（例如重新整理後回到首頁）就直接打開它
        const emptyConv = state.conversations.find((c) => !c.settings?.isProject && (c.messageCount ?? 0) === 0)
        if (emptyConv) {
            try {
                // 清單上的訊息數不會即時更新，先向後端確認真的沒有訊息
                if ((await conversationsApi.getMessages(emptyConv.id)).length === 0) {
                    upload.setUploadedFiles([])
                    await selectConversation(emptyConv)
                    return
                }
            } catch {
                // 查不到就照常建立新對話
            }
        }
        try {
            const conversation = await conversationsApi.create({ title: DEFAULT_CONVERSATION_TITLE, settings: { isProject: false } })
            addConversation(conversation)
            upload.setUploadedFiles([])
            await selectConversation(conversation)
        } catch (error) {
            console.error('建立對話失敗:', error)
            toast.error(i18n.t('ui.chat.createFailed'))
        }
    }

    /** 在指定資料夾內新增對話；資料夾還沒有文件就直接提示先上傳 */
    const createConvInFolder = async (folderName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const conversation = await conversationsApi.create({ title: DEFAULT_CONVERSATION_TITLE, settings: { isProject: true, folderName } })
            addConversation(conversation)
            upload.setUploadedFiles([])
            folders.setExpandedFolders(new Set([folderName])) // 只展開這個資料夾（其他收起），新對話立刻出現在側欄
            await selectConversation(conversation)

            if ((await listFolderDocs(folderName, true)).length === 0) {
                addMessage(tempMessage('assistant', '', { id: `auto-${Date.now()}` }))
                setStreaming(true)
                await replyNoDocs(folderName)
            }
        } catch (error) {
            console.error('新增對話失敗:', error)
        }
    }

    /** 刪除一則對話（本機的暫時對話不用呼叫後端） */
    const removeConversation = async (id: string) => {
        if (!id.startsWith('temp-')) await conversationsApi.delete(id)
        socket.close(id)
        deleteConversation(id) // 刪的是目前這則時，store 會一併清空訊息、回到首頁
    }

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        showConfirm(t('common.confirmDelete'), async () => {
            try {
                await removeConversation(id)
            } catch (error) {
                console.error('刪除對話失敗:', error)
            }
        })
    }

    /** 刪除資料夾：連同裡面的對話與文件一起刪 */
    const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        showConfirm(t('common.confirmDelete'), async () => {
            try {
                for (const conv of conversations.filter((c) => Boolean(c.settings?.isProject) && folderOf(c.settings) === folderName)) {
                    await removeConversation(conv.id)
                }
                // 後端已依資料夾過濾；這裡再篩一次當保險（刪除是不能復原的動作）
                const docs = (await documentsApi.list({ folder: folderName })).data.filter((d) => folderOf(d.doc_metadata) === folderName)
                for (const doc of docs) await documentsApi.delete(doc.id)

                try {
                    await foldersApi.delete(folderName)
                    await folders.loadFolders()
                } catch (err) {
                    console.error('刪除資料夾失敗:', err)
                    toast.error(i18n.t('ui.chat.folderDeleteFailed'))
                }
                if (selectedFolder === folderName) {
                    setSelectedFolder(null)
                    folders.setFolderDocuments([])
                }
            } catch (error) {
                console.error('刪除資料夾失敗:', error)
            }
        })
    }

    const handleSend = async (overrideValue?: string) => {
        const text = (overrideValue ?? input).trim()
        if (!text || isStreaming || socket.isConnecting) return
        if (!overrideValue) setInput('')

        const doSend = async (webSearch: boolean) => {
            const conversationId = await ensureConversation(text.slice(0, 50))
            void autoTitle(conversationId, text)

            addMessage(tempMessage('user', text))
            scroll.followBottom() // 剛送出 → AI 回覆時要看得到內容捲進來
            addMessage(tempMessage('assistant', '', {}, 1))
            setStreaming(true)

            // 專案模式：資料夾還沒有已啟用的文件就不問 AI，直接提示先上傳
            if (chatMode === 'project') {
                const folderName = (currentConversation?.settings?.folderName as string | undefined) ?? selectedFolder ?? ''
                if (folderName) {
                    try {
                        if ((await listFolderDocs(folderName, true)).length === 0) {
                            await replyNoDocs(folderName)
                            return
                        }
                    } catch (err) {
                        console.warn('無法偵測資料夾文件數量，繼續送出訊息:', err) // 偵測失敗不擋使用者
                    }
                }
            }
            await askAI(conversationId, text, webSearch)
        }

        const useWebSearch = webSearchOn && searchPolicy.enabled
        // 預設「每次先問」：不是管理者設成自動搜尋，就先讓使用者確認一次要送出的關鍵字
        if (useWebSearch && !searchPolicy.auto) {
            showConfirm(t('chat.webSearch.confirm', { query: text }), () => doSend(true))
            return
        }
        await doSend(useWebSearch)
    }

    /** 修改某則使用者訊息後重新生成：截掉它之後的對話，再請 AI 重答（固定同一個函式，訊息泡泡才不會每次都重畫） */
    const handleResubmit = useStableCallback(async (messageId: string, editedContent: string) => {
        if (isStreaming) return

        useChatStore.setState((state) => {
            const index = state.messages.findIndex((m) => m.id === messageId)
            if (index === -1) return state
            const kept = state.messages.slice(0, index + 1)
            kept[index] = { ...kept[index], content: editedContent }
            // 之後被攔截的訊息也一併移除，免得重新載入時又冒出來
            const convId = state.currentConversation?.id
            let blockedByConv = state.blockedByConv
            if (convId && blockedByConv[convId]) {
                const keepIds = new Set(kept.map((m) => m.id))
                blockedByConv = { ...blockedByConv, [convId]: blockedByConv[convId].filter((m) => keepIds.has(m.id)) }
            }
            return { messages: [...kept, tempMessage('assistant')], blockedByConv }
        })
        setStreaming(true)

        const ws = socket.get(useChatStore.getState().currentConversation?.id)
        if (ws) {
            ws.sendResubmit(messageId, editedContent, chatMode === 'project', 0.7, language, 2048, webSearchOn && searchPolicy.enabled)
        } else {
            console.error('WebSocket 未連接，無法使用重新生成功能')
            setStreaming(false)
        }
    })

    /** 重新生成某則 AI 回覆：用它上方最近一則使用者訊息重新送出 */
    const handleRegenerate = useStableCallback(async (assistantMessageId: string) => {
        if (isStreaming) return
        const all = useChatStore.getState().messages
        const idx = all.findIndex((m) => m.id === assistantMessageId)
        for (let i = idx - 1; i >= 0; i -= 1) {
            if (all[i].role === 'user') {
                await handleResubmit(all[i].id, all[i].content)
                return
            }
        }
    })

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    /** 停止畫面上這個對話的生成（背景中的其他對話不受影響） */
    const handleStop = () => {
        socket.get(useChatStore.getState().currentConversation?.id)?.stop()
        setStreaming(false)
    }

    /**
     * 送出語音訊息：
     *   1. 先顯示語音訊息（轉錄中）＋ AI 打字中
     *   2. 錄音轉成 16kHz 單聲道 WAV，交給後端 Whisper 轉成文字
     *   3. 用逐字稿更新訊息；沒有文字（失敗或太短）就用提示文字當 AI 回覆
     *   4. 有文字就跟一般訊息一樣交給 AI
     */
    const handleSendVoice = async (payload: { blob: Blob; url: string; mimeType: string; durationMs: number }) => {
        if (isStreaming || socket.isConnecting) return
        const conversationId = await ensureConversation(t('chat.voice.defaultTitle'))

        const audio = { url: payload.url, mimeType: payload.mimeType, durationMs: payload.durationMs }
        const userMsg = tempMessage('user', t('chat.voice.placeholderContent'), { audio: { ...audio, pending: true } })
        addMessage(userMsg)
        scroll.followBottom()
        addMessage(tempMessage('assistant', '', {}, 1))
        setStreaming(true)

        let transcript = ''
        let transcriptionError: string | null = null
        try {
            const { blobToWav16kMono } = await import('@/lib/audioToWav')
            const { voiceApi } = await import('@/api/voice')
            const result = await voiceApi.transcribe(await blobToWav16kMono(payload.blob), { language })
            transcript = (result.text || '').trim()
        } catch (err) {
            transcriptionError = getErrorMessage(err, String(err))
            console.error('[voice] 轉錄失敗:', err)
        }

        useChatStore.getState().updateMessage(userMsg.id, {
            audio: { ...audio, transcript: transcript || undefined, error: transcriptionError || undefined, pending: false },
            content: transcript || t('chat.voice.placeholderContent'),
        })

        if (!transcript) {
            const fallback = transcriptionError
                ? t('chat.voice.aiFallbackError', { error: transcriptionError })
                : t('chat.voice.aiFallback')
            await typeOut(fallback, appendToLastMessage, 28)
            setStreaming(false)
            return
        }
        await askAI(conversationId, transcript)
    }

    // ── 各區塊元件要的 props ──
    return {
        sidebarProps: {
            sidebarOpen,
            toggleSidebar,
            showConfirm,
            conversations,
            currentConversationId: currentConversation?.id ?? null,
            chatMode,
            setChatMode,
            selectedFolder,
            expandedFolders: folders.expandedFolders,
            setExpandedFolders: folders.setExpandedFolders,
            setSelectedFolder,
            toggleFolderExpand: folders.toggleFolderExpand,
            savedFolders: folders.savedFolders,
            createNewConversation,
            selectConversation,
            handleRenameConversation: dialogs.handleRenameConversation,
            handleOpenMenu: dialogs.handleOpenMenu,
            closeMenu: dialogs.closeMenu,
            createConvInFolder,
            handleDeleteConversation,
            handleDeleteFolder,
            openNewFolderModal: dialogs.openNewFolderModal,
            activeMenuConvId: dialogs.activeMenu?.convId ?? null,
        },
        headerProps: {
            sidebarOpen,
            toggleSidebar,
            ...models,
            currentConversation,
            handleShareConversation: dialogs.handleShareConversation,
            handleUnshareConversation: dialogs.handleUnshareConversation,
            handleRenameConversation: dialogs.handleRenameConversation,
            handleMoveToProject: dialogs.handleMoveToProject,
            handleVerifyChain: dialogs.handleVerifyChain,
            handleDeleteConversation,
        },
        inputProps: {
            selectedFolder,
            chatMode,
            // 瀏覽器臨時資料夾只能附給「已經存在的對話」的下一則訊息；全新對話（還沒送出第一則）沒有 id，按鈕不顯示
            conversationId: currentConversation?.id,
            // 對外搜尋：後端沒開就不顯示切換鈕
            webSearchEnabled: searchPolicy.enabled,
            webSearchOn,
            setWebSearchOn,
            isConnecting: socket.isConnecting,
            isUploading: upload.isUploading,
            uploadProgress: upload.uploadProgress,
            uploadedFiles: upload.uploadedFiles,
            isStreaming,
            input,
            setInput,
            inputRef,
            fileInputRef: upload.fileInputRef,
            handleKeyDown,
            handleStop,
            handleSend,
            handleFileUpload: upload.handleFileUpload,
            handleSendVoice,
            llmReady,
        },
        modalProps: {
            ...dialogs,
            savedFolders: folders.savedFolders,
            handleDeleteConversation,
        },
        mainProps: {
            uploadFiles: upload.uploadFiles,
            selectedFolder,
            folderDocuments: folders.folderDocuments,
            handleToggleDocActive: folders.handleToggleDocActive,
            showConfirm,
            t,
            isUploading: upload.isUploading,
            uploadProgress: upload.uploadProgress,
            createNewConversation,
            user,
            setInput,
            messages,
            isStreaming,
            handleResubmit,
            handleRegenerate,
            ragDebugMode,
            messagesEndRef: scroll.messagesEndRef,
            scrollContainerRef: scroll.scrollContainerRef,
            topObserverRef: scroll.topObserverRef,
            isLoadingMore: scroll.isLoadingMore,
            fileInputRef: upload.fileInputRef,
            documentsApi,
            loadFolderDocuments,
            selectedModel: models.selectedModel,
        },
    }
}
