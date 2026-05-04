/**
 * 對話主頁面（Corphia Custom 特製版）
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'
import { conversationsApi } from '@/api/conversations'
import { documentsApi, type DocumentResponse } from '@/api/documents'
import modelsApi, { type ModelItem } from '@/api/models'
import { foldersApi } from '@/api/folders'
import { createChatWebSocket, type ChatWebSocket } from '@/api/websocket'
import { useToastStore } from '@/store/toastStore'
import type { Message } from '@/types/chat'
import { buildStreamDispatcher } from './messageStreamHandlers'

// D2: 拆出的元件和 Hooks

// 預設資料夾名稱常數（集中定義，避免字元編碼問題）
const DEFAULT_FOLDER = '新資料夾'


export function useChatLogic() {
    const { t } = useTranslation()
    const toast = useToastStore()
    const { user } = useAuthStore()
    const {
        conversations,
        currentConversation,
        messages,
        isStreaming,
        setConversations,
        addConversation,
        updateConversation,
        setCurrentConversation,
        setMessages,
        addMessage,
        setStreaming,
        appendToLastMessage,
        setSourcesToLastMessage,
        deleteConversation
    } = useChatStore()
    const { sidebarOpen, toggleSidebar, setSidebarOpen, showConfirm, setSettingsOpen, language, ragDebugMode } = useUIStore()

    const [input, setInput] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const wsRef = useRef<ChatWebSocket | null>(null)
    
    // GGUF Model Dropdown State
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
    const [availableModels, setAvailableModels] = useState<ModelItem[]>([])
    const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null)

    // Header Options Menu State
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
    const [isModelLoading, setIsModelLoading] = useState(false)

    // Sidebar Logo Hover State
    const [isSidebarHovered, setIsSidebarHovered] = useState(false)

    // Mode Toggle (UI Only)
    const [chatMode, setChatMode] = useState<'general' | 'project'>('general')

    // Folder View 相關
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [folderDocuments, setFolderDocuments] = useState<DocumentResponse[]>([])

    // 檔案上傳相關狀態
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadedFiles, setUploadedFiles] = useState<{name: string}[]>([])

    // Dropdown Menu 狀態
    const [activeMenu, setActiveMenu] = useState<{ convId: string, x: number, y: number } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // 重新命名 Modal 狀態
    const [renameModal, setRenameModal] = useState<{ convId: string, title: string } | null>(null)
    const [renameInput, setRenameInput] = useState('')
    const renameInputRef = useRef<HTMLInputElement>(null)

    // 移至專案 Modal 狀態
    const [moveModal, setMoveModal] = useState<{ convId: string, isProject: boolean, folderName: string } | null>(null)
    const [moveInput, setMoveInput] = useState('')

    // 新建資料夾 Modal 狀態
    const [newFolderModal, setNewFolderModal] = useState(false)
    const [newFolderInput, setNewFolderInput] = useState('')
    const newFolderInputRef = useRef<HTMLInputElement>(null)

    // 持久化儲存的資料夾清單（從後端 API 取得）
    const [savedFolders, setSavedFolders] = useState<string[]>([])
    
    // UI 相關：無限捲動
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const topObserverRef = useRef<HTMLDivElement>(null)

    // 載入資料夾
    const loadFolders = useCallback(async () => {
        try {
            const data = await foldersApi.list()
            setSavedFolders(data.map(f => f.name))
        } catch (error) {
            console.error('Failed to load folders:', error)
        }
    }, [])

    useEffect(() => {
        loadFolders()
    }, [loadFolders])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveMenu(null)
            }
        }
        // 使用 capture 階段確保比其他 onClick 先觸發
        document.addEventListener('mousedown', handleClickOutside, true)
        return () => document.removeEventListener('mousedown', handleClickOutside, true)
    }, [])

    const handleOpenMenu = (e: React.MouseEvent, convId: string) => {
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        // 浮動選單放置在按鈕正下方
        setActiveMenu({ convId, x: rect.left, y: rect.bottom + 4 })
    }

    const closeMenu = () => setActiveMenu(null)

    const handleRenameConversation = (convId: string) => {
        const conv = conversations.find(c => c.id === convId)
        if (!conv) return
        setRenameInput(conv.title)
        setRenameModal({ convId, title: conv.title })
        // 等 modal render 後 focus
        setTimeout(() => renameInputRef.current?.focus(), 100)
    }

    const submitRename = async () => {
        if (!renameModal) return
        const newTitle = renameInput.trim()
        if (!newTitle || newTitle === renameModal.title) { setRenameModal(null); return }
        try {
            await conversationsApi.update(renameModal.convId, { title: newTitle })
            updateConversation(renameModal.convId, { title: newTitle })
        } catch (error) {
            console.error('Rename failed:', error)
        }
        setRenameModal(null)
    }

    const handleMoveToProject = (convId: string) => {
        const conv = conversations.find(c => c.id === convId)
        if (!conv) return
        const isProject = Boolean(conv.settings?.isProject)
        const folderName = (conv.settings?.folderName as string) || '新資料夾'
        setMoveInput(isProject ? '' : folderName)
        setMoveModal({ convId, isProject, folderName })
    }

    const submitMove = async (targetFolder?: string) => {
        if (!moveModal) return
        try {
            if (moveModal.isProject && !targetFolder) {
                // 移回一般聊天
                const newSettings = { ...conversations.find(c => c.id === moveModal.convId)?.settings, isProject: false }
                await conversationsApi.update(moveModal.convId, { settings: newSettings })
                updateConversation(moveModal.convId, { settings: newSettings })
                setChatMode('general')
            } else {
                // 移至專案
                const folderName = (targetFolder || moveInput).trim() || '新資料夾'
                const newSettings = { ...conversations.find(c => c.id === moveModal.convId)?.settings, isProject: true, folderName }
                await conversationsApi.update(moveModal.convId, { settings: newSettings })
                updateConversation(moveModal.convId, { settings: newSettings })
                setChatMode('project')
            }
        } catch (error) {
            console.error('Move failed:', error)
        }
        setMoveModal(null)
    }

    const handleShareConversation = async (convId: string) => {
        const link = `${window.location.origin}/share/${convId}`
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link)
            } else {
                const textArea = document.createElement("textarea")
                textArea.value = link
                textArea.style.position ="absolute"
                textArea.style.left ="-999999px"
                document.body.appendChild(textArea)
                textArea.select()
                try {
                    document.execCommand('copy')
                } catch (error) {
                    console.error('Fallback copy failed', error)
                } finally {
                    textArea.remove()
                }
            }
            toast.success('已成功複製對話分享連結！')
        } catch {
            toast.error('複製失敗，請手動複製連結：' + link)
        }
    }

    const submitNewFolder = async () => {
        const folderName = newFolderInput.trim() || DEFAULT_FOLDER
        setNewFolderModal(false)
        setNewFolderInput('')

        // 將資料夾儲存到後端
        try {
            await foldersApi.create(folderName)
            await loadFolders()
        } catch (err) {
            console.error('Failed to create folder:', err)
            toast.error('建立資料夾失敗')
        }
        
        setChatMode('project')
        // 清空目前選取的對話，顯示空資料夾內容
        setCurrentConversation(null)
        setMessages([])
    }
    const loadFolderDocuments = useCallback(async (folderName: string) => {
        try {
            // BUG-09 修正：documentsApi.list() 固定回傳 {data: [], total}
            const res = await documentsApi.list()
            const docs = res.data.filter((d: DocumentResponse) => d.doc_metadata?.folderName === folderName)
            setFolderDocuments(docs)
        } catch (error) {
            console.error('Failed to load documents:', error)
        }
    }, [])

    useEffect(() => {
        if (selectedFolder) {
            loadFolderDocuments(selectedFolder)
        }
    }, [selectedFolder, loadFolderDocuments])

    const loadModels = useCallback(async () => {
        try {
            const res = await modelsApi.getModels()
            setAvailableModels(res.models)
            
            // Set current model from API if exists
            if (res.current_model) {
                const current = res.models.find((m) => m.name === res.current_model)
                if (current) setSelectedModel(current)
                else if (res.models.length > 0) setSelectedModel(res.models[0])
            } else if (res.models.length > 0) {
                setSelectedModel(res.models[0])
            }
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }, [])

    useEffect(() => {
        loadModels()
    }, [loadModels])


    useEffect(() => {
        const loadConversations = async () => {
            try {
                const result = await conversationsApi.list()
                setConversations(result.data)
            } catch (error) {
                console.error('載入對話列表失敗:', error)
            }
        }
        loadConversations()
    }, [setConversations])

    /*
     * 自動滾動策略：
     *   1. 預設 autoFollowRef = true，AI 串流新訊息時自動跟隨到底部
     *   2. 使用者「主動往上捲」（離底部 > 60px）→ autoFollowRef = false，停止自動跟隨
     *   3. 使用者再「捲回底部」（離底部 ≤ 60px）→ autoFollowRef = true，重新啟動自動跟隨
     *
     * 之所以用 ref 不用 state：
     *   - state 變動會觸發重新 render；但這個邏輯只是 useEffect 內部判斷用，沒必要 re-render
     *   - 用 ref 也避免閉包過時的問題
     */
    const autoFollowRef = useRef(true)

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight
            // 60px 容忍：彈性下捲動畫、ResizeObserver 抖動不會誤判
            autoFollowRef.current = distanceFromBottom <= 60
        }

        container.addEventListener('scroll', handleScroll, { passive: true })
        // 初始化一次（剛進對話可能已經捲在某處）
        handleScroll()
        return () => container.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
        // 訊息改變時 → 只有「使用者目前還貼在底部」才自動往下；否則尊重使用者閱讀位置
        if (!autoFollowRef.current) return
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    /*
     * Memoize the WebSocket packet dispatcher. The actual switch table lives in
     * ./messageStreamHandlers.ts as a pure factory; useCallback keeps the same
     * function reference across renders so connectWebSocket below doesn't
     * resubscribe every time.
     */
    const handleWebSocketMessage = useCallback(
        buildStreamDispatcher({
            appendToLastMessage,
            setStreaming,
            setSourcesToLastMessage,
            toast,
        }),
        [appendToLastMessage, setStreaming, setSourcesToLastMessage, toast],
    )

    const connectWebSocket = useCallback(async (conversationId: string) => {
        if (wsRef.current) {
            wsRef.current.disconnect()
        }

        const ws = createChatWebSocket(conversationId)
        ws.onMessage(handleWebSocketMessage)
        ws.onClose(() => console.log('WebSocket 已斷開'))

        try {
            setIsConnecting(true)
            await ws.connect()
            wsRef.current = ws
        } catch (error) {
            console.error('WebSocket 連接失敗:', error)
        } finally {
            setIsConnecting(false)
        }
    }, [handleWebSocketMessage])

    const selectConversation = useCallback(async (conversation: typeof currentConversation) => {
        if (!conversation) return

        const previousConv = useChatStore.getState().currentConversation
        const isSameConv = previousConv?.id === conversation.id
        const isStreamingNow = useChatStore.getState().isStreaming

        setSelectedFolder(null)
        if (window.innerWidth < 768) {
            setSidebarOpen(false)
        }

        // 唯一允許「不重新載入」的場景：完全相同對話 + 還在串流（避免把進行中的回覆中斷）
        // 其他情況一律重新撈訊息，確保不同對話的內容完全隔開
        if (isSameConv && isStreamingNow) {
            return
        }

        // 切換對話 = 一個全新的 view → 先清空訊息陣列再撈，避免閃出舊對話的內容
        setCurrentConversation(conversation)
        setMessages([])
        autoFollowRef.current = true

        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
            // 若 await 期間使用者又切去別的對話，store 的 currentConversation 已不是這次 fetch 的對象 → 丟掉這次結果
            if (useChatStore.getState().currentConversation?.id !== conversation.id) {
                return
            }
            setMessages(msgs)
            setHasMoreMessages(msgs.length === 50)
            await connectWebSocket(conversation.id)
        } catch (error) {
            console.error('載入訊息失敗:', error)
        }
    }, [setCurrentConversation, setMessages, connectWebSocket, setSidebarOpen])

    const loadMoreMessages = useCallback(async () => {
        const convId = useChatStore.getState().currentConversation?.id
        const currentMsgs = useChatStore.getState().messages
        if (!convId || currentMsgs.length === 0 || isLoadingMore || !hasMoreMessages) return

        try {
            setIsLoadingMore(true)
            const firstMsgId = currentMsgs[0].id
            const olderMsgs = await conversationsApi.getMessages(convId, { beforeId: firstMsgId })
            
            if (olderMsgs.length > 0) {
                // 保存捲動高度
                const scrollContainer = scrollContainerRef.current
                const oldScrollHeight = scrollContainer?.scrollHeight || 0
                
                useChatStore.getState().setMessages([...olderMsgs, ...currentMsgs])
                setHasMoreMessages(olderMsgs.length === 50)
                
                // 恢復捲動位置
                requestAnimationFrame(() => {
                    if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight - oldScrollHeight
                    }
                })
            } else {
                setHasMoreMessages(false)
            }
        } catch (error) {
            console.error('載入舊訊息失敗:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }, [isLoadingMore, hasMoreMessages])

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreMessages()
                }
            },
            { root: scrollContainerRef.current, threshold: 0.1 }
        )
        const target = topObserverRef.current
        if (target) observer.observe(target)
        return () => observer.disconnect()
    }, [loadMoreMessages])

    // --- 檔案上傳處理 ---
    /**
     * 多檔上傳：依序跑（chat 場景同時要送訊息，上傳體驗以「整批進度」呈現即可）。
     * 進度條 = 已完成檔數 / 總檔數，比逐檔顯示更不擁擠。
     */
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files
        if (!fileList || fileList.length === 0) return
        const files = Array.from(fileList)

        setIsUploading(true)
        setUploadProgress(0)

        const targetFolder =
            selectedFolder ||
            (currentConversation?.settings?.folderName as string) ||
            '新資料夾'

        const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
        let bytesDoneOfFinishedFiles = 0

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                try {
                    await documentsApi.upload(file, targetFolder, (progressEvent) => {
                        // 整批進度 = (已完成檔的 bytes + 當前檔目前 bytes) / 總 bytes
                        const currentLoaded = progressEvent.loaded ?? 0
                        const overall = totalBytes
                            ? Math.round(
                                  ((bytesDoneOfFinishedFiles + currentLoaded) * 100) /
                                      totalBytes,
                              )
                            : 0
                        setUploadProgress(Math.min(overall, 99))
                    })
                    bytesDoneOfFinishedFiles += file.size

                    if (selectedFolder) {
                        await loadFolderDocuments(selectedFolder)
                    } else {
                        setUploadedFiles((prev) => [...prev, { name: file.name }])
                    }
                } catch (err) {
                    console.error(`上傳失敗 [${file.name}]:`, err)
                    // 單檔失敗不中斷整批 — 繼續下一個
                }
            }
            setUploadProgress(100)
        } finally {
            setIsUploading(false)
            setTimeout(() => setUploadProgress(0), 400)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleToggleDocActive = async (doc: DocumentResponse) => {
        const isActive = doc.doc_metadata?.isActive ?? true
        try {
            await documentsApi.updateMetadata(doc.id, {
                ...doc.doc_metadata,
                isActive: !isActive
            })
            if (selectedFolder) {
                loadFolderDocuments(selectedFolder)
            }
        } catch (e) {
            console.error('Failed to toggle doc metadata:', e)
        }
    }

    const createNewConversation = async () => {
        if (chatMode === 'project') {
            // 專案模式：開啟新建資料夾 Modal
            setNewFolderInput('')
            setNewFolderModal(true)
            setTimeout(() => newFolderInputRef.current?.focus(), 100)
        } else {
            // 一般模式：建立新對話
            try {
                const conversation = await conversationsApi.create({ 
                    title: '新對話',
                    settings: { isProject: false }
                })
                addConversation(conversation)
                setUploadedFiles([])
                await selectConversation(conversation)
            } catch (error) {
                console.error('建立對話失敗:', error)
            }
        }
    }

    /** 在指定資料夾內新增對話 */
    const createConvInFolder = async (folderName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const conversation = await conversationsApi.create({
                title: '新對話',
                settings: { isProject: true, folderName }
            })
            addConversation(conversation)
            setUploadedFiles([])
            await selectConversation(conversation)

            // 偵測資料夾是否有文件，若無檔案則自動模擬 AI 回覆
            // BUG-09 修正：documentsApi.list() 固定回傳 {data: [], total}
            const res = await documentsApi.list()
            const docList = res.data
            const folderDocs = docList.filter((d: DocumentResponse) => d.doc_metadata?.folderName === folderName && (d.doc_metadata?.isActive ?? true))
            if (folderDocs.length === 0) {
                // 此資料夾內尚無檢索文件，串流提示上傳（模擬 AI 打字效果）
                const emptyAssistantMsg: Message = {
                    id: `auto-${Date.now()}`,
                    role: 'assistant',
                    content: '',
                    tokens: 0,
                    createdAt: new Date().toISOString(),
                }
                addMessage(emptyAssistantMsg)
                setStreaming(true)

                const noDocsText = `您好！此專案資料夾「${folderName}」內目前尚未上傳任何檔案。\n\nCorphia 需要您提供參考資料才能回答專案相關問題。\n\n**請點擊輸入區左側的「附件」按鈕，先上傳相關檔案（支援 PDF、DOCX、XLSX、TXT 等格式）。**`
                // 以每 3 字元為單位打字，間距 30ms（與 sendMessage 的串流體驗一致）
                const chunkSize = 3
                const delay = 30
                for (let i = 0; i < noDocsText.length; i += chunkSize) {
                    const chunk = noDocsText.slice(i, i + chunkSize)
                    appendToLastMessage(chunk)
                    await new Promise<void>((resolve) => setTimeout(resolve, delay))
                }
                setStreaming(false)
            }
        } catch (error) {
            console.error('新增對話失敗:', error)
        }
    }

    const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        showConfirm(t('common.confirmDelete'), async () => {
            try {
                if (!id.startsWith('temp-')) {
                    await conversationsApi.delete(id)
                }
                deleteConversation(id)
                if (currentConversation?.id === id) {
                    setCurrentConversation(null)
                    setMessages([])
                }
            } catch (error) {
                console.error('刪除對話失敗:', error)
            }
        })
    }

    const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
        e.stopPropagation()

        showConfirm(t('common.confirmDelete'), async () => {
            try {
                const relatedConvs = conversations.filter(c => Boolean(c.settings?.isProject) && ((c.settings?.folderName as string) || DEFAULT_FOLDER) === folderName)
                for (const conv of relatedConvs) {
                    if (!conv.id.startsWith('temp-')) {
                        await conversationsApi.delete(conv.id)
                    }
                    deleteConversation(conv.id)
                    if (currentConversation?.id === conv.id) {
                        setCurrentConversation(null)
                        setMessages([])
                    }
                }

                // BUG-09 修正：documentsApi.list() 固定回傳 {data: [], total}
                const res = await documentsApi.list()
                const docList = res.data
                const relatedDocs = docList.filter((d: DocumentResponse) => ((d.doc_metadata?.folderName as string) || DEFAULT_FOLDER) === folderName)
                for (const doc of relatedDocs) {
                    await documentsApi.delete(doc.id)
                }

                // 從後端資料庫刪除資料夾
                try {
                    await foldersApi.delete(folderName)
                    await loadFolders()
                } catch (err) {
                    console.error('刪除資料夾失敗:', err)
                    toast.error('無法刪除資料夾')
                }
                if (selectedFolder === folderName) {
                    setSelectedFolder(null)
                    setFolderDocuments([])
                }
            } catch (error) {
                console.error('刪除資料夾失敗:', error)
            }
        })
    }

    const handleVerifyChain = async (convId: string) => {
        try {
            const res = await conversationsApi.verifyChain(convId)
            if (res.valid) {
                toast.success(`對話完整性驗證通過！\n共 ${res.total_messages} 則訊息皆未被竄改。`)
            } else {
                toast.error(`對話紀錄遭竄改！\n在第 ${res.first_broken_index} 則訊息發生斷鏈\n(ID: ${(res as any).first_broken_message_id})`)
            }
        } catch (err) {
            console.error('驗證失敗', err)
            toast.error('無法進行對話完整性驗證')
        }
    }

    const handleSend = async (overrideValue?: string) => {
        const text = overrideValue ?? input
        if (!text.trim() || isStreaming || isConnecting) return

        const userMessage = text.trim()
        if (!overrideValue) setInput('')

        let conversationId = currentConversation?.id
        if (!conversationId) {
            try {
                const conversation = await conversationsApi.create({ 
                    title: userMessage.slice(0, 50),
                    settings: { isProject: chatMode === 'project' }
                })
                addConversation(conversation)
                setCurrentConversation(conversation)
                conversationId = conversation.id
                await connectWebSocket(conversationId)
            } catch (error) {
                console.error('建立對話失敗:', error)
                // For UI testing even backend offline:
                // We won't block UI logic to show the"move up" action, so we still push UI state below if failed.
            }
        }

        const tempUserMessage: Message = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: userMessage,
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
        addMessage(tempUserMessage)
        // 使用者剛送訊息 → 重置自動跟隨：AI 回覆過程中要看到內容捲入
        autoFollowRef.current = true

        const tempAssistantMessage: Message = {
            id: `temp-${Date.now() + 1}`,
            role: 'assistant',
            content: '',
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
        addMessage(tempAssistantMessage)
        setStreaming(true)

        const shouldUseRag = chatMode === 'project'

        // ── 專案模式：傳訊前先偵測資料夾是否有可用文件 ──────────────────────
        // 若資料夾尚無任何已啟用的文件，模擬串流打字效果輸出提示訊息，不觸發後端 LLM
        if (shouldUseRag) {
            const folderName = (currentConversation?.settings?.folderName as string | undefined) ?? selectedFolder ?? ''
            if (folderName) {
                try {
                    const res = await documentsApi.list()
                    const activeDocs = res.data.filter(
                        (d: DocumentResponse) =>
                            d.doc_metadata?.folderName === folderName &&
                            (d.doc_metadata?.isActive ?? true)
                    )
                    if (activeDocs.length === 0) {
                        // 無可用文件 → 保持串流狀態，逐段 append 提示訊息（模擬打字效果）
                        const noDocsText = `您好！此專案資料夾「${folderName}」內目前尚未上傳任何檔案。\n\nCorphia 需要您提供參考資料才能回答專案相關問題。\n\n**請點擊輸入區左側的「附件」按鈕，先上傳相關檔案（支援 PDF、DOCX、XLSX、TXT 等格式）。**`
                        // 以每 3 字元為單位打字，間距 30ms
                        const chunkSize = 3
                        const delay = 30
                        for (let i = 0; i < noDocsText.length; i += chunkSize) {
                            const chunk = noDocsText.slice(i, i + chunkSize)
                            appendToLastMessage(chunk)
                            await new Promise<void>((resolve) => setTimeout(resolve, delay))
                        }
                        setStreaming(false)
                        return
                    }
                } catch (err) {
                    // 偵測失敗時繼續正常送出，避免阻塞使用者
                    console.warn('無法偵測資料夾文件數量，繼續送出訊息:', err)
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────

        if (wsRef.current?.isConnected) {
            wsRef.current.sendMessage(userMessage, shouldUseRag, 0.7, language)
        } else {
            // Frontend fallback flow
            try {
                if (conversationId) {
                    const response = await conversationsApi.sendMessage(conversationId, {
                        content: userMessage,
                        useRag: shouldUseRag,
                    })
                    useChatStore.setState((state) => {
                        const newMessages = [...state.messages]
                        newMessages[newMessages.length - 1] = response
                        return { messages: newMessages }
                    })
                }
            } catch (error) {
                console.error('發送訊息失敗:', error)
                // Remove the typing indicator if backend totally failed
                useChatStore.setState((state) => ({
                    messages: state.messages.slice(0, -1)
                }))
            } finally {
                setStreaming(false)
            }
        }
    }

    /**
     * 重新生成指定 AI 訊息的回覆。
     * 找到此 AI 訊息上方最近的一則使用者訊息，並用其內容重新提交。
     */
    const handleRegenerate = async (assistantMessageId: string) => {
        if (isStreaming) return
        const all = useChatStore.getState().messages
        const idx = all.findIndex((m) => m.id === assistantMessageId)
        if (idx === -1) return
        // 往上找最近的 user 訊息
        let prevUserIdx = -1
        for (let i = idx - 1; i >= 0; i -= 1) {
            if (all[i].role === 'user') {
                prevUserIdx = i
                break
            }
        }
        if (prevUserIdx === -1) return
        const userMsg = all[prevUserIdx]
        await handleResubmit(userMsg.id, userMsg.content)
    }

    const handleResubmit = async (messageId: string, editedContent: string) => {
        if (isStreaming) return

        // 1. Truncate local message state
        useChatStore.setState((state) => {
            const index = state.messages.findIndex(m => m.id === messageId)
            if (index === -1) return state
            const newMessages = state.messages.slice(0, index + 1)
            newMessages[index] = { ...newMessages[index], content: editedContent }
            
            // Add temp assistant message
            const tempAssistantMessage: Message = {
                id: `temp-${Date.now()}`,
                role: 'assistant',
                content: '',
                tokens: 0,
                createdAt: new Date().toISOString(),
            }
            return { messages: [...newMessages, tempAssistantMessage] }
        })
        
        setStreaming(true)

        // 2. Call backend via WebSocket
        const shouldUseRag = chatMode === 'project'
        if (wsRef.current?.isConnected) {
            wsRef.current.sendResubmit(messageId, editedContent, shouldUseRag, 0.7, language)
        } else {
            console.error('WebSocket 未連接，無法使用重新生成功能')
            setStreaming(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleStop = () => {
        if (wsRef.current) wsRef.current.stop()
        setStreaming(false)
    }

    /**
     * 送出語音訊息：
     *   1. 先在 UI 上加入帶 audio.pending=true 的 user message
     *   2. 把 webm/opus 用 Web Audio API 解碼 + 重採樣成 16kHz mono WAV
     *   3. 上傳到後端 /voice/transcribe（Whisper）取得真實的逐字稿
     *   4. 拿到文字後更新 user message（清掉 pending，填 transcript），
     *      然後跟一般文字訊息一樣交給 LLM 串流回覆
     *   5. 任何一步失敗都不卡住對話：清掉 pending、用 fallback 文字當 AI 回覆
     */
    const handleSendVoice = async (payload: {
        blob: Blob
        url: string
        mimeType: string
        durationMs: number
    }) => {
        if (isStreaming || isConnecting) return

        // 確保已連線到對話
        let conversationId = currentConversation?.id
        if (!conversationId) {
            try {
                const conversation = await conversationsApi.create({
                    title: t('chat.voice.defaultTitle'),
                    settings: { isProject: chatMode === 'project' },
                })
                addConversation(conversation)
                setCurrentConversation(conversation)
                conversationId = conversation.id
                await connectWebSocket(conversationId)
            } catch (error) {
                console.error('建立對話失敗:', error)
            }
        }

        // 1. 先在 UI 顯示語音訊息（pending 狀態），同時加入 assistant placeholder + 進入 streaming
        const userMessageId = `temp-${Date.now()}`
        const tempUserMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: t('chat.voice.placeholderContent'),
            tokens: 0,
            createdAt: new Date().toISOString(),
            audio: {
                url: payload.url,
                mimeType: payload.mimeType,
                durationMs: payload.durationMs,
                pending: true,
            },
        }
        addMessage(tempUserMessage)
        autoFollowRef.current = true

        const tempAssistantMessage: Message = {
            id: `temp-${Date.now() + 1}`,
            role: 'assistant',
            content: '',
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
        addMessage(tempAssistantMessage)
        setStreaming(true)

        // 2. 解碼 + 重採樣 + 上傳到後端 Whisper
        let transcript = ''
        let transcriptionError: string | null = null
        try {
            const { blobToWav16kMono } = await import('@/lib/audioToWav')
            const { voiceApi } = await import('@/api/voice')
            const wavBlob = await blobToWav16kMono(payload.blob)
            const result = await voiceApi.transcribe(wavBlob, { language })
            transcript = (result.text || '').trim()
        } catch (err: any) {
            transcriptionError = err?.response?.data?.detail || err?.message || String(err)
            console.error('[voice] 轉錄失敗:', err)
        }

        // 3. 更新 user message：清掉 pending，填上 transcript / error
        const userMessageUpdate: Partial<Message> = {
            audio: {
                url: payload.url,
                mimeType: payload.mimeType,
                durationMs: payload.durationMs,
                transcript: transcript || undefined,
                error: transcriptionError || undefined,
                pending: false,
            },
            content: transcript || t('chat.voice.placeholderContent'),
        }
        useChatStore.getState().updateMessage(userMessageId, userMessageUpdate)

        // 4. 沒有轉錄文字（後端失敗或音訊太短）→ 用 fallback 串 AI 回應
        if (!transcript) {
            const fallbackText = transcriptionError
                ? t('chat.voice.aiFallbackError', { error: transcriptionError })
                : t('chat.voice.aiFallback')
            const chunkSize = 3
            const delay = 28
            for (let i = 0; i < fallbackText.length; i += chunkSize) {
                const chunk = fallbackText.slice(i, i + chunkSize)
                appendToLastMessage(chunk)
                await new Promise<void>((resolve) => setTimeout(resolve, delay))
            }
            setStreaming(false)
            return
        }

        // 5. 有轉錄 → 跟文字訊息一樣交給 LLM
        const shouldUseRag = chatMode === 'project'
        if (wsRef.current?.isConnected) {
            wsRef.current.sendMessage(transcript, shouldUseRag, 0.7, language)
        } else {
            try {
                if (conversationId) {
                    const response = await conversationsApi.sendMessage(conversationId, {
                        content: transcript,
                        useRag: shouldUseRag,
                    })
                    useChatStore.setState((state) => {
                        const newMessages = [...state.messages]
                        newMessages[newMessages.length - 1] = response
                        return { messages: newMessages }
                    })
                }
            } catch (error) {
                console.error('語音轉文字後送出失敗:', error)
                useChatStore.setState((state) => ({
                    messages: state.messages.slice(0, -1),
                }))
            } finally {
                setStreaming(false)
            }
        }
    }


    useEffect(() => {
        return () => wsRef.current?.disconnect()
    }, [])
    // --- Props 打包回傳 ---
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
            expandedFolders, 
            setExpandedFolders,
            setSelectedFolder, 
            toggleFolderExpand: (folder: string) => {
                setExpandedFolders(prev => {
                    const next = new Set(prev)
                    if (next.has(folder)) next.delete(folder)
                    else next.add(folder)
                    return next
                })
            }, 
            savedFolders, 
            createNewConversation, 
            selectConversation: selectConversation as any,
            setCurrentConversation: () => setCurrentConversation(null),
            handleRenameConversation, 
            handleOpenMenu, 
            createConvInFolder, 
            handleDeleteConversation, 
            handleDeleteFolder,
            openNewFolderModal: () => {
                setNewFolderInput('')
                setNewFolderModal(true)
                setTimeout(() => newFolderInputRef.current?.focus(), 100)
            },
            activeMenuConvId: activeMenu?.convId ?? null
        },
        headerProps: {
            sidebarOpen, 
            toggleSidebar, 
            modelDropdownOpen, 
            setModelDropdownOpen, 
            isModelLoading, 
            setIsModelLoading,
            selectedModel, 
            setSelectedModel, 
            availableModels, 
            setAvailableModels, 
            headerMenuOpen, 
            setHeaderMenuOpen,
            currentConversation, 
            handleShareConversation, 
            handleRenameConversation, 
            handleMoveToProject, 
            handleVerifyChain,
            handleDeleteConversation
        },
        inputProps: {
            selectedFolder, 
            chatMode, 
            isConnecting, 
            isUploading, 
            uploadProgress, 
            uploadedFiles: uploadedFiles as any, 
            isStreaming,
            input, 
            setInput, 
            inputRef, 
            fileInputRef, 
            handleKeyDown,
            handleStop,
            handleSend,
            handleFileUpload,
            handleSendVoice
        },
        modalProps: {
            activeMenu, 
            menuRef, 
            closeMenu,
            handleRenameConversation, 
            handleMoveToProject, 
            handleShareConversation, 
            handleDeleteConversation,
            
            renameModal, 
            renameInput, 
            renameInputRef, 
            setRenameInput, 
            setRenameModal, 
            submitRename,
            
            moveModal, 
            moveInput, 
            savedFolders, 
            setMoveInput, 
            setMoveModal, 
            submitMove,
            
            newFolderModal, 
            newFolderInput, 
            newFolderInputRef, 
            setNewFolderInput, 
            setNewFolderModal, 
            submitNewFolder
        },
        mainProps: {
            selectedFolder,
            folderDocuments,
            handleToggleDocActive,
            showConfirm,
            t,
            isUploading,
            uploadProgress,
            createNewConversation,
            user,
            setInput,
            messages,
            isStreaming,
            handleResubmit,
            handleRegenerate,
            ragDebugMode,
            messagesEndRef,
            scrollContainerRef,
            topObserverRef,
            isLoadingMore,
            fileInputRef,
            documentsApi,
            loadFolderDocuments,
            selectedModel
        }
    }
}

