/**
 * 對話主頁面（Corphia Custom 特製版）
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useUIStore } from '../store/uiStore'
import { conversationsApi } from '../api/conversations'
import { documentsApi, type DocumentResponse } from '../api/documents'
import modelsApi, { type ModelItem } from '../api/models'
import { foldersApi } from '../api/folders'
import { createChatWebSocket, type ChatWebSocket, type StreamResponse } from '../api/websocket'
import { useToastStore } from '../store/toastStore'
import type { Message } from '../types/chat'

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
                textArea.style.position = "absolute"
                textArea.style.left = "-999999px"
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    const handleWebSocketMessage = useCallback((data: StreamResponse) => {
        switch (data.type) {
            case 'stream':
                if (data.content) {
                    appendToLastMessage(data.content)
                }
                break
            case 'done': {
                setStreaming(false)
                // 重新載入訊息以取得剛建立的 message 的真實 UUID，這樣編輯重新生成才能正常運作
                const currentConvId = useChatStore.getState().currentConversation?.id
                if (currentConvId) {
                    conversationsApi.getMessages(currentConvId)
                        .then(msgs => useChatStore.getState().setMessages(msgs))
                        .catch(err => console.error('同步訊息失敗:', err))
                }
                break
            }
            case 'error':
                console.error('WebSocket 錯誤:', data.message)
                setStreaming(false)
                break
            case 'sources':
                if (data.sources) {
                    setSourcesToLastMessage(data.sources as any)
                }
                // C2: 儲存 RAG debug 資訊
                if (data.debug) {
                    useChatStore.getState().setRAGDebug(data.debug)
                }
                break
            // A1: PII 遮罩警告
            case 'pii_warning':
                useChatStore.getState().addSecurityWarning({
                    type: 'pii',
                    message: data.message || '偵測到敏感資訊已自動遮罩',
                    data: { mask_map: data.mask_map || [] },
                    timestamp: Date.now(),
                })
                break
            // A2: Prompt Injection 偵測警告
            case 'injection_warning':
                useChatStore.getState().addSecurityWarning({
                    type: 'injection',
                    message: data.message || '偵測到可疑的 Prompt Injection 模式',
                    data: {
                        risk_level: data.risk_level || 'medium',
                        matched_patterns: data.matched_patterns || [],
                    },
                    timestamp: Date.now(),
                })
                break
            // A3: DLP 黑名單命中 → 後端已攔阻，不會有 stream 內容
            case 'dlp_block':
                setStreaming(false)
                useChatStore.getState().addSecurityWarning({
                    type: 'dlp',
                    message: data.message || '訊息包含列管字詞，已依 DLP 策略攔阻送出。',
                    data: {
                        matched_terms_count: data.matched_terms_count || 0,
                    },
                    timestamp: Date.now(),
                })
                toast.error(data.message || '訊息已被 DLP 策略攔阻')
                break
        }
    }, [appendToLastMessage, setStreaming, setSourcesToLastMessage, toast])

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
        setCurrentConversation(conversation)
        setSelectedFolder(null)
        if (window.innerWidth < 768) {
            setSidebarOpen(false)
        }
        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
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
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setUploadProgress(0)

        const targetFolder = selectedFolder || (currentConversation?.settings?.folderName as string) || '新資料夾'

        try {
            await documentsApi.upload(file, targetFolder, (progressEvent) => {
                const progress = progressEvent.total
                    ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    : 0
                setUploadProgress(progress)
            })
            
            if (selectedFolder) {
                await loadFolderDocuments(selectedFolder)
            } else {
                setUploadedFiles(prev => [...prev, { name: file.name }])
            }
        } catch (err) {
            console.error('上傳失敗:', err)
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
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
                // 此資料夾內尚無檢索文件，自動提示上傳
                const promptMsg: Message = {
                    id: `auto-${Date.now()}`,
                    role: 'assistant',
                    content: `您好！此專案資料夾「${folderName}」內目前尚未上傳任何檔案。\n\nCorphia 需要芳您提供參考資料才能回答專案相關問題。\n\n**請在右側點擊「📎 附件」按鈕，先上傳相關檔案（支援 PDF、DOCX、XLSX、TXT 等格式）。**`,
                    tokens: 0,
                    createdAt: new Date().toISOString(),
                }
                addMessage(promptMsg)
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
                // We won't block UI logic to show the "move up" action, so we still push UI state below if failed.
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
            handleFileUpload
        },
        modalProps: {
            activeMenu, 
            menuRef, 
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
            ragDebugMode, 
            messagesEndRef,
            scrollContainerRef, 
            topObserverRef, 
            isLoadingMore, 
            fileInputRef, 
            documentsApi, 
            loadFolderDocuments
        }
    }
}

