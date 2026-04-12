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
import { createChatWebSocket, type ChatWebSocket, type StreamResponse } from '../api/websocket'
import { MessageBubble } from '../components/chat'
import { motion, AnimatePresence } from 'framer-motion'
import type { Message } from '../types/chat'
import { CorphiaLogo } from '../components/icons/CorphiaIcons'

// --- Custom UI Icons ---
const PlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
)



// The blue circle in the reference doesn't clearly show an arrow, but usually it represents send.
const SendDotBtn = ({ disabled }: { disabled?: boolean }) => (
    <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center transition-colors shadow-sm ${disabled ? 'bg-[#3b3b3b]' : 'bg-[#1877F2] hover:bg-[#166fe5]'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${disabled ? 'opacity-30' : 'opacity-100'}`}>
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    </div>
)

const StopIcon = () => (
    <div className="w-[44px] h-[44px] rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
    </div>
)

const SidebarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" {...props}>
        <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
)

const GGUF_MODELS = [
    { id: 'llama3', name: 'Llama-3-8B-Instruct.gguf', desc: 'Local GGUF - 高速推理' },
    { id: 'mistral', name: 'Mistral-Nemo-12B.gguf', desc: 'Local GGUF - 邏輯強化' },
    { id: 'qwen', name: 'Qwen2.5-7B-Instruct.gguf', desc: 'Local GGUF - 中文特化' },
    { id: 'gemma', name: 'Gemma-2-9B-It.gguf', desc: 'Local GGUF - 輕量精準' }
];

export default function Chat() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const {
        conversations,
        currentConversation,
        messages,
        isStreaming,
        setConversations,
        addConversation,
        setCurrentConversation,
        setMessages,
        addMessage,
        setStreaming,
        appendToLastMessage,
        setSourcesToLastMessage,
        deleteConversation
    } = useChatStore()
    const { sidebarOpen, toggleSidebar, showConfirm, setSettingsOpen } = useUIStore()

    const [input, setInput] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const wsRef = useRef<ChatWebSocket | null>(null)
    
    // GGUF Model Dropdown State
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
    const [selectedModel, setSelectedModel] = useState(GGUF_MODELS[0])

    // Header Options Menu State
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

    // Sidebar Logo Hover State
    const [isSidebarHovered, setIsSidebarHovered] = useState(false)

    // Mode Toggle (UI Only)
    const [chatMode, setChatMode] = useState<'general' | 'project'>('general')

    // Folder View 狀態
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [folderDocuments, setFolderDocuments] = useState<DocumentResponse[]>([])

    // 檔案上傳相關狀態
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadedFiles, setUploadedFiles] = useState<{name: string}[]>([])

    // Dropdown Menu 狀態
    const [activeMenu, setActiveMenu] = useState<{ convId: string, x: number, y: number } | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

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
    const loadFolderDocuments = useCallback(async (folderName: string) => {
        try {
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
            case 'done':
                setStreaming(false)
                break
            case 'error':
                console.error('WebSocket 錯誤:', data.message)
                setStreaming(false)
                break
            case 'sources':
                if (data.sources) {
                    setSourcesToLastMessage(data.sources)
                }
                break
        }
    }, [appendToLastMessage, setStreaming, setSourcesToLastMessage])

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
        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
            setMessages(msgs)
            await connectWebSocket(conversation.id)
        } catch (error) {
            console.error('載入訊息失敗:', error)
        }
    }, [setCurrentConversation, setMessages, connectWebSocket])

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
        try {
            const conversation = await conversationsApi.create({ 
                title: '新對話',
                settings: { 
                    isProject: chatMode === 'project',
                    folderName: chatMode === 'project' ? '新資料夾' : undefined
                } 
            })
            addConversation(conversation)
            setUploadedFiles([]) // Reset files for new conversation
            await selectConversation(conversation)
        } catch (error) {
            console.error('建立對話失敗:', error)
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
                const relatedConvs = conversations.filter(c => Boolean(c.settings?.isProject) && ((c.settings?.folderName as string) || '新資料夾') === folderName)
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

                const res = await documentsApi.list()
                const docList = Array.isArray(res) ? res : (res.data || [])
                const relatedDocs = docList.filter((d: DocumentResponse) => ((d.doc_metadata?.folderName as string) || '新資料夾') === folderName)
                for (const doc of relatedDocs) {
                    await documentsApi.delete(doc.id)
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

    const handleSend = async (overrideValue?: string) => {
        const text = overrideValue ?? input
        if (!text.trim() || isStreaming) return

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
            wsRef.current.sendMessage(userMessage, shouldUseRag)
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

    return (
        // 主畫面全區背景 (使用 fixed inset-0 完全鎖定在視窗內部，防止 iOS Safari 整頁回彈拖拉)
        <div className="flex fixed inset-0 w-full h-[100dvh] bg-white dark:bg-[#212121] text-gray-900 dark:text-white overflow-hidden font-sans selection:bg-[#1877F2]/30 relative transition-colors">
            
            {/* --- Mobile Sidebar Overlay --- */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-transparent backdrop-blur-md z-30 md:hidden transition-opacity"
                    onClick={toggleSidebar}
                />
            )}

            {/* --- 左側邊欄 Sidebar --- */}
            <aside
                className={`${sidebarOpen ? 'w-[75vw] max-w-[260px] md:w-[280px] translate-x-0' : 'w-0 -translate-x-full md:w-[72px] md:translate-x-0'
                    } overflow-hidden bg-[#f9f9f9] dark:bg-[#171717] rounded-r-[36px] md:rounded-[36px] md:border border-gray-200 dark:border-[#2a2a2a] transition-[width,transform] duration-300 ease-in-out shrink-0 flex flex-col z-40 absolute md:relative h-full md:h-[calc(100vh-24px)] md:my-3 md:ml-3 shadow-lg md:shadow-sm`}
            >
                {/* 桌面版專屬：側邊欄頂部 Header (Logo + 收合按鈕) */}
                <div className={`hidden md:flex items-center w-full p-4 pb-1 h-[60px] shrink-0 transition-opacity duration-300 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    {sidebarOpen && (
                        <div className="flex items-center px-1">
                            <CorphiaLogo className="w-8 h-8 shrink-0 rounded-[8px] overflow-hidden" />
                        </div>
                    )}
                    <button
                        onClick={toggleSidebar}
                        onMouseEnter={() => setIsSidebarHovered(true)}
                        onMouseLeave={() => setIsSidebarHovered(false)}
                        title={sidebarOpen ? "收合側邊欄" : "開啟側邊欄"}
                        className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#333] transition-colors shrink-0 flex items-center justify-center w-[36px] h-[36px]"
                    >
                        {sidebarOpen || isSidebarHovered ? (
                            <SidebarIcon className="w-[18px] h-[18px]" />
                        ) : (
                            <CorphiaLogo className="w-[22px] h-[22px] rounded-[5px]" />
                        )}
                    </button>
                </div>

                {/* 頂端控制區（包含新對話按鈕與切換器） */}
                <div className={`w-full transition-all duration-300 p-3 space-y-3 ${!sidebarOpen && 'flex flex-col items-center'}`}>
                    {/* 新對話按鈕 */}
                    <button
                        onClick={createNewConversation}
                        className={`flex items-center gap-3 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-800 dark:text-white transition-colors font-medium overflow-hidden ${sidebarOpen ? 'w-full px-4 py-3 justify-start rounded-full' : 'w-12 h-12 justify-center rounded-full shrink-0'}`}
                        style={{ padding: sidebarOpen ? '' : '0' }}
                    >
                        <span className="shrink-0"><PlusIcon /></span>
                        {sidebarOpen && <span className="text-[15px] whitespace-nowrap">新對話</span>}
                    </button>

                    {/* 一般 / 專案 切換膠囊 */}
                    {sidebarOpen ? (
                        <motion.div
                            layout
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="relative flex rounded-full select-none cursor-pointer bg-gray-100 dark:bg-[#2a2a2a] transition-colors shrink-0 w-full"
                            style={{ padding: '4px' }}
                        >
                            {/* 滑動背景 Pill */}
                            <div
                                className="bg-white dark:bg-[#fff] shadow-sm"
                                style={{
                                    position: 'absolute',
                                    top: '4px',
                                    left: chatMode === 'general' ? '4px' : 'calc(50% + 0px)',
                                    width: 'calc(50% - 4px)',
                                    height: 'calc(100% - 8px)',
                                    borderRadius: '999px',
                                    transition: 'left 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
                                    zIndex: 1,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                }}
                            />
                            {/* 一般 */}
                            <button
                                type="button"
                                onClick={() => setChatMode('general')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-1.5 text-[14px] text-center rounded-full font-medium transition-colors duration-300 ${
                                    chatMode === 'general' ? 'text-gray-900 dark:text-[#111]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                一般
                            </button>
                            {/* 專案 */}
                            <button
                                type="button"
                                onClick={() => setChatMode('project')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-1.5 text-[14px] text-center rounded-full font-medium transition-colors duration-300 ${
                                    chatMode === 'project' ? 'text-gray-900 dark:text-[#111]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                專案
                            </button>
                        </motion.div>
                    ) : (
                        <div 
                            className="relative flex flex-col items-center justify-between bg-gray-100 dark:bg-[#2a2a2a] rounded-full p-1 cursor-pointer w-12 shrink-0 transition-colors"
                            style={{ height: '88px' }}
                            onClick={() => setChatMode(prev => prev === 'general' ? 'project' : 'general')}
                        >
                            <div 
                                className="absolute bg-[#fff] w-10 h-10 rounded-full shadow-sm"
                                style={{
                                    top: '4px',
                                    transform: `translateY(${chatMode === 'general' ? '0px' : '40px'})`,
                                    transition: 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
                                    zIndex: 1
                                }}
                            />
                            {/* General Mode Icon (Message) */}
                            <div className={`w-10 h-10 flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'general' ? 'text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                            {/* Project Mode Icon (Folder) */}
                            <div className={`w-10 h-10 flex items-center justify-center z-10 transition-colors duration-300 ${chatMode === 'project' ? 'text-gray-900' : 'text-gray-500 dark:text-gray-400'}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </div>
                        </div>
                    )}
                </div>

                {/* 對話列表列 - 縮起來時完全隱藏 */}
                <div className={`flex-1 overflow-y-auto mt-2 custom-scrollbar w-full transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 px-4' : 'opacity-0 px-0 overflow-hidden pointer-events-none'}`}>
                    {/* 分類標籤與歷史樹狀結構 */}
                    {chatMode === 'general' ? (
                        <>
                            <div className="mb-2 pl-2 mt-1">
                                <span className="text-[12px] text-gray-500 tracking-wider font-medium">一般聊天</span>
                            </div>
                            <div className="border-l border-gray-200 dark:border-[#333] ml-2 pl-2 space-y-1 transition-colors">
                                {(() => {
                                    const filtered = conversations.filter(c => !Boolean(c.settings?.isProject))
                                    if (filtered.length === 0) return <p className="text-gray-400 text-[13px] py-4 pl-3">{t('chat.noChats')}</p>
                                    
                                    return filtered.map((conv) => (
                                        <button
                                            key={conv.id}
                                            onClick={() => selectConversation(conv)}
                                            className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-full text-[14px] transition-colors group ${currentConversation?.id === conv.id
                                                ? 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white font-medium'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#222] hover:text-gray-900 dark:hover:text-gray-200'
                                            }`}
                                        >
                                            <span className="truncate pr-2 pl-1">{conv.title}</span>
                                            <div className={`flex items-center gap-1 transition-opacity ${activeMenu?.convId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <button
                                                    onClick={(e) => handleOpenMenu(e, conv.id)}
                                                    className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#444] ${activeMenu?.convId === conv.id ? 'bg-gray-200 dark:bg-[#444] text-gray-900 dark:text-white' : 'text-gray-400'}`}
                                                    title="選項"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </button>
                                    ))
                                })()}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-2 pl-2 mt-1">
                                <span className="text-[12px] text-gray-400 dark:text-gray-500 tracking-wider font-medium">專案資料夾</span>
                            </div>
                            {(() => {
                                const filtered = conversations.filter(c => Boolean(c.settings?.isProject))
                                if (filtered.length === 0) {
                                    return (
                                        <div className="border-l border-gray-200 dark:border-[#333] ml-2 pl-2 space-y-1 transition-colors">
                                            <p className="text-gray-400 text-[13px] py-4 pl-3">尚無專案</p>
                                        </div>
                                    )
                                }

                                const grouped: Record<string, typeof conversations> = {}
                                filtered.forEach(conv => {
                                    const folder = (conv.settings?.folderName as string) || '新資料夾'
                                    if (!grouped[folder]) grouped[folder] = []
                                    grouped[folder].push(conv)
                                })

                                const folderNames = Object.keys(grouped)
                                
                                return (
                                    <div className="ml-2 pl-1 space-y-2 mt-2">
                                        {folderNames.map((folderName, index) => {
                                            const isLastFolder = index === folderNames.length - 1
                                            return (
                                            <div key={folderName} className="relative">
                                                {/* 主線：連接「專案資料夾」到此資料夾 L型節點 */}
                                                <div 
                                                    className="absolute left-[3px] top-[-16px] w-[12px] border-l border-b border-gray-300 dark:border-[#444] rounded-bl-sm"
                                                    style={{ height: '28px' }}
                                                />
                                                {/* 主線的垂直延伸 (如果不是最後一個資料夾，繼續往下畫) */}
                                                {!isLastFolder && (
                                                    <div className="absolute left-[3px] top-[12px] bottom-[-8px] border-l border-gray-300 dark:border-[#444]" />
                                                )}

                                                <div 
                                                    onClick={() => {
                                                        setSelectedFolder(folderName)
                                                        setCurrentConversation(null) // Reset conversation
                                                    }}
                                                    className={`flex items-center justify-between text-[14px] font-medium pl-[22px] py-1 transition-colors cursor-pointer w-full text-left rounded-md hover:bg-gray-50 dark:hover:bg-[#222] group ${selectedFolder === folderName ? 'text-[#1877F2]' : 'text-gray-700 dark:text-gray-300 hover:text-[#1877F2]'}`}
                                                >
                                                    <span className="truncate pr-2">{folderName}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => handleDeleteFolder(folderName, e)}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            title="刪除資料夾及內容"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* 次層：聊天清單 */}
                                                <div className="relative ml-[22px] mt-1 space-y-1">
                                                    {grouped[folderName].map((conv, cIndex) => {
                                                        const isLastConv = cIndex === grouped[folderName].length - 1
                                                        return (
                                                            <div key={conv.id} className="relative">
                                                                {/* 次層 L 型節點 */}
                                                                <div 
                                                                    className="absolute left-[-11px] top-[-10px] w-[12px] border-l border-b border-gray-300 dark:border-[#444] rounded-bl-sm pointer-events-none"
                                                                    style={{ height: '28px' }}
                                                                />
                                                                {/* 次層垂直延伸 */}
                                                                {!isLastConv && (
                                                                    <div className="absolute left-[-11px] top-[18px] bottom-[-4px] border-l border-gray-300 dark:border-[#444] pointer-events-none" />
                                                                )}
                                                                
                                                                <button
                                                                    onClick={() => selectConversation(conv)}
                                                                    className={`relative z-10 w-full flex items-center justify-between text-left px-3 py-1.5 rounded-full text-[13px] transition-colors group ml-[4px] border border-transparent ${currentConversation?.id === conv.id
                                                                        ? 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white font-medium border-gray-200 dark:border-[#333]'
                                                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#222]'
                                                                    }`}
                                                                    style={{ width: 'calc(100% - 4px)' }}
                                                                >
                                                                    <span className="truncate pr-2 pl-1">{conv.title}</span>
                                                                    <div className={`flex items-center gap-1 transition-opacity ${activeMenu?.convId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                                        <button
                                                                            onClick={(e) => handleOpenMenu(e, conv.id)}
                                                                            className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-[#444] ${activeMenu?.convId === conv.id ? 'bg-gray-200 dark:bg-[#444] text-gray-900 dark:text-white' : 'text-gray-400'}`}
                                                                            title="選項"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                        })}
                                    </div>
                                )
                            })()}
                        </>
                    )}
                </div>

                {/* 底部滿版膠囊使用者卡片 */}
                <div className={`w-full transition-all duration-300 p-3 pb-6 md:pb-3 mt-auto flex ${!sidebarOpen && 'justify-center'}`}>
                    <button 
                        onClick={() => setSettingsOpen(true)}
                        title="前往設定"
                        className={`flex items-center gap-3 p-1.5 rounded-full bg-gray-50 dark:bg-[#1e1e1e] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors text-left overflow-hidden ${sidebarOpen ? 'w-full pr-4' : 'w-12 h-12 justify-center shrink-0'}`}
                    >
                        {/* 圓形頭像框 */}
                        <div className="w-[36px] h-[36px] rounded-full bg-white dark:bg-[#111] flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333]">
                            <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4ZM6 8C6 4.68629 8.68629 2 12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14C8.68629 14 6 11.3137 6 8ZM12 15C7.58172 15 4 18.5817 4 23C4 23.5523 4.44772 24 5 24H19C19.5523 24 20 23.5523 20 23C20 18.5817 16.4183 15 12 15ZM6.04631 22C6.54145 19.1673 8.98926 17 12 17C15.0107 17 17.4586 19.1673 17.9537 22H6.04631Z" fill="currentColor"/>
                            </svg>
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-gray-700 dark:text-gray-300 font-medium truncate">{user?.name || 'Local User'}</p>
                            </div>
                        )}
                    </button>
                </div>
            </aside>

            {/* --- 右側主聊天視窗 Main Section --- */}
            <main className="flex-1 flex flex-col relative w-full min-h-0 overflow-hidden bg-transparent">
                {/* 固定的頂部 Header (Top Bar) */}
                <header className="absolute top-0 left-0 w-full p-4 md:p-6 flex items-center justify-between z-30 bg-white/90 dark:bg-[#212121]/90 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleSidebar}
                            className={`p-2 -ml-2 rounded-xl hover:bg-gray-200/50 dark:hover:bg-[#2a2a2a] transition-colors md:hidden ${sidebarOpen ? 'opacity-0 pointer-events-none' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            <SidebarIcon className="w-5 h-5" />
                        </button>
                        
                        {/* 左側：Corphia Logo 與文字 */}
                        <h1 className={`text-[20px] font-bold text-gray-800 dark:text-gray-200 tracking-wide flex items-center gap-3 transition-opacity ${sidebarOpen ? 'max-md:opacity-0' : 'opacity-100'}`}>
                            <span className="md:hidden flex items-center">
                                <CorphiaLogo className="w-7 h-7 rounded-[7px] overflow-hidden" />
                            </span>
                            Corphia
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 右側：GGUF 模型選擇下拉選單 */}
                        <div className="relative">
                            <button 
                                onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                                className="flex items-center gap-2 transition-opacity px-3 py-1.5 rounded-[12px] hover:bg-gray-100/80 dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-white/5 active:bg-gray-200 dark:active:bg-[#333]"
                            >
                                <span className="text-[14px] font-semibold font-mono tracking-tight sm:max-w-none text-gray-500 dark:text-gray-400">{selectedModel.name}</span>
                                <svg className={`w-4 h-4 text-gray-400 opacity-80 transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                            </button>

                            <AnimatePresence>
                                {modelDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                            className="absolute right-0 top-full mt-2 w-[300px] bg-white dark:bg-[#2a2a2a] rounded-[24px] shadow-xl border border-gray-100 dark:border-[#333] overflow-hidden z-50 p-2"
                                        >
                                            {GGUF_MODELS.map(model => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => {
                                                        setSelectedModel(model);
                                                        setModelDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 rounded-[16px] flex items-center justify-between transition-colors ${selectedModel.id === model.id ? 'bg-gray-50 dark:bg-[#333]' : 'hover:bg-gray-50 dark:hover:bg-[#333]'}`}
                                                >
                                                    <div className="flex flex-col min-w-0">
                                                        <span className={`font-semibold text-[15px] truncate ${selectedModel.id === model.id ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{model.name}</span>
                                                        <span className="text-[13px] text-gray-500 mt-0.5">{model.desc}</span>
                                                    </div>
                                                    {selectedModel.id === model.id && (
                                                        <svg className="w-5 h-5 ml-2 text-gray-800 dark:text-gray-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                    )}
                                                </button>
                                            ))}
                                            
                                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[#333]">
                                                <button className="w-full text-left px-4 py-3 rounded-[16px] flex items-center gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-[#333] text-gray-600 dark:text-gray-400">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                                    <span className="font-semibold text-[15px]">管理 GGUF 模型...</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* 右側：三個點選單 */}
                        <div className="relative">
                            <button 
                                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                                className={`p-2 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-[12px] transition-colors ${headerMenuOpen ? 'text-gray-800 dark:text-white bg-gray-100 dark:bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="5" cy="12" r="1.5"></circle>
                                    <circle cx="12" cy="12" r="1.5"></circle>
                                    <circle cx="19" cy="12" r="1.5"></circle>
                                </svg>
                            </button>

                            <AnimatePresence>
                                {headerMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.2, ease: 'easeOut' }}
                                            className="absolute right-0 top-full mt-2 w-[220px] bg-[#1a1a1a] rounded-[16px] shadow-xl border border-[#333] overflow-hidden z-50 p-1.5 flex flex-col gap-0.5 text-[#e5e5e5]"
                                        >
                                            <button className="w-full text-left px-3 py-2.5 rounded-[10px] flex items-center gap-3 transition-colors hover:bg-white/10 active:bg-white/20">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                                <span className="font-medium text-[15px]">分享</span>
                                            </button>
                                            <button className="w-full text-left px-3 py-2.5 rounded-[10px] flex items-center gap-3 transition-colors hover:bg-white/10 active:bg-white/20">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                <span className="font-medium text-[15px]">重新命名</span>
                                            </button>
                                            <button className="w-full text-left px-3 py-2.5 rounded-[10px] flex items-center gap-3 transition-colors hover:bg-white/10 active:bg-white/20">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                                <span className="font-medium text-[15px]">移至專案</span>
                                            </button>
                                            <div className="my-1 border-t border-[#333]" />
                                            <button className="w-full text-left px-3 py-2.5 rounded-[10px] flex items-center gap-3 transition-colors hover:bg-red-500/10 text-red-500 active:bg-red-500/20">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                <span className="font-medium text-[15px]">刪除</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* 內容區：滑動區域（根據空狀態或聊天動態渲染） */}
                {selectedFolder ? (
                    // 專案管理頁面 Folder View
                    <div className="flex-1 overflow-y-auto px-6 pt-[88px] md:pt-[100px] mb-8 md:px-10 max-w-4xl mx-auto w-full custom-scrollbar pb-32">
                        <div className="mb-8 pl-2">
                            <h2 className="text-[22px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                                <svg className="w-8 h-8 text-[#1877F2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                {selectedFolder}
                            </h2>
                            <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">管理專屬來源文獻，Corphia 將會依據你打勾勾選的檔案作為參考資料來回答對話。</p>
                        </div>
                        
                        <div className="bg-white dark:bg-[#111] rounded-[24px] shadow-sm border border-gray-200 dark:border-[#333] overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-gray-50/50 dark:bg-[#1a1a1a]">
                                <h3 className="font-semibold text-gray-700 dark:text-gray-200">來源文件 ({folderDocuments.length})</h3>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl transition-all shadow-sm shadow-[#1877F2]/20 hover:shadow-[#1877F2]/40 text-sm font-medium"
                                >
                                    <PlusIcon /> <span className="mr-1">新增來源</span>
                                </button>
                            </div>
                            
                            {folderDocuments.length === 0 ? (
                                <div className="p-16 text-center">
                                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-[#444] mb-4 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                    </svg>
                                    <p className="text-[17px] font-semibold text-gray-600 dark:text-gray-300 mb-1">尚無文獻來源</p>
                                    <p className="text-[14px] text-gray-400">點擊右上角新增，建立專案護城河</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                                    {folderDocuments.map((doc) => (
                                        <div key={doc.id} className="p-4 px-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors group">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <label className="relative flex cursor-pointer items-center rounded-full" htmlFor={`checkbox-${doc.id}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        id={`checkbox-${doc.id}`}
                                                        className="before:content[''] peer relative h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all before:absolute before:top-2/4 before:left-2/4 before:block before:h-12 before:w-12 before:-translate-y-2/4 before:-translate-x-2/4 before:rounded-full before:bg-blue-gray-500 before:opacity-0 before:transition-opacity checked:border-[#1877F2] checked:bg-[#1877F2] checked:before:bg-[#1877F2] hover:before:opacity-10 dark:border-[#555]"
                                                        checked={doc.doc_metadata?.isActive ?? true}
                                                        onChange={() => handleToggleDocActive(doc)}
                                                    />
                                                    <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-y-2/4 -translate-x-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                                        </svg>
                                                    </div>
                                                </label>
                                                
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-[15px] text-gray-800 dark:text-gray-200 truncate">{doc.filename || "Unknown"}</span>
                                                    <span className="text-[13px] text-gray-500 mt-0.5">
                                                        {new Date(doc.created_at).toLocaleString()} • {Math.round((doc.size_bytes || 0) / 1024)} KB
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <span className={`text-[12px] px-2.5 py-1 rounded-full font-medium ${
                                                    doc.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    doc.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                    {doc.status === 'completed' ? '已處理' : doc.status === 'failed' ? '失敗' : '處理中'}
                                                </span>
                                                
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        showConfirm(t('common.confirmDelete'), async () => {
                                                            try {
                                                                await documentsApi.delete(doc.id)
                                                                if (selectedFolder) loadFolderDocuments(selectedFolder)
                                                            } catch (error) {
                                                                console.error('刪除文件失敗', error)
                                                            }
                                                        })
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 md:opacity-0 group-hover:opacity-100 transition-all"
                                                    title="刪除"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* 專案上傳進度 */}
                        {isUploading && selectedFolder && (
                            <div className="mt-6 p-4 bg-[#1877F2]/5 dark:bg-[#1877F2]/10 rounded-2xl border border-[#1877F2]/20 flex items-center justify-between shadow-sm animate-fade-in-up">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#1877F2] border-t-transparent animate-spin" />
                                    <span className="text-[#1877F2] text-[15px] font-medium">正在上傳並進行語意分析與 Chunking...</span>
                                </div>
                                <span className="text-[#1877F2] font-semibold">{uploadProgress}%</span>
                            </div>
                        )}
                        
                        {/* New Chat Button at exactly Folder View */}
                        <div className="mt-12 flex justify-center pb-20">
                            <button
                                onClick={async () => {
                                    // Start a chat automatically linked to this folder
                                    try {
                                        const conversation = await conversationsApi.create({ 
                                            title: '新對話',
                                            settings: { 
                                                isProject: true,
                                                folderName: selectedFolder
                                            } 
                                        })
                                        addConversation(conversation)
                                        setUploadedFiles([])
                                        await selectConversation(conversation) // will clear selectedFolder and enter chat view automatically
                                    } catch (error) {
                                        console.error('建立對話失敗:', error)
                                    }
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-900 border-gray-900 border dark:bg-white text-white dark:text-gray-900 rounded-full hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold"
                            >
                                基於此來源開始提問 →
                            </button>
                        </div>
                    </div>
                ) : (
                <div className="flex-1 flex flex-col overflow-y-auto w-full relative z-10 custom-scrollbar px-4 md:px-0 pb-4 min-h-0">
                    
                    {messages.length === 0 ? (
                        // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                        <div className="w-full max-w-3xl mx-auto pb-8 pt-[15vh]">
                            {/* Greeting */}
                            <h2 className="text-[22px] md:text-[26px] font-semibold mb-8 text-gray-800 dark:text-gray-100 tracking-tight text-center leading-snug">
                                {t('chat.emptyGreeting', `What can I help you with, ${user?.name || 'User'}?`)}
                            </h2>

                            {/* Suggested Prompts */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full px-2 md:px-0">
                                {[
                                    { title: "摘要文件", desc: "幫我整理出一份簡單的重點摘要" },
                                    { title: "翻譯內容", desc: "將這段文字翻譯成通順的在地語言" },
                                    { title: "撰寫 Email", desc: "以專業用語撰寫一封商務合作信件" },
                                    { title: "說明程式碼", desc: "幫我詳細解釋這段程式碼的邏輯" }
                                ].map((item, index) => (
                                    <button 
                                        key={index}
                                        onClick={() => setInput(item.desc)}
                                        className="text-left p-4 rounded-[18px] border border-gray-200 dark:border-[#333] bg-white/60 dark:bg-[#222]/60 hover:bg-white dark:hover:bg-[#2a2a2a] shadow-sm hover:shadow-md transition-all duration-200 group active:scale-[0.98]"
                                    >
                                        <div className="font-semibold text-[13px] mb-1.5 text-gray-800 dark:text-gray-200 group-hover:text-[#1877F2] transition-colors">{item.title}</div>
                                        <div className="text-[12px] text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 leading-relaxed">{item.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        // 聊天紀錄
                        <div className="max-w-3xl mx-auto space-y-6 pb-4 w-full">
                            {messages.map((message, index) => (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
                )}

                {/* 固定的底部輸入框區（不管有沒有訊息都在最底下） */}
                <AnimatePresence>
                {!selectedFolder && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="shrink-0 pt-2 pb-6 md:pb-8 w-full z-20"
                >
                    <div className="max-w-3xl mx-auto px-4 md:px-0 w-full relative">
                        {/* 外層圓角與框限 */}
                        <div className="relative flex flex-col bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#333]/50 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-colors ring-1 ring-black/5 dark:ring-white/5 focus-within:ring-2 focus-within:ring-[#1877F2]/20">
                            
                            {/* Tags / Files Row */}
                            {(uploadedFiles.length > 0 || isUploading) && (
                                <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                                    {uploadedFiles.map((f, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#333] px-3 py-1.5 rounded-xl text-[13px] border border-gray-200 dark:border-[#444] animate-fade-in-up">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <span className="truncate max-w-[120px] text-gray-700 dark:text-gray-300">{f.name}</span>
                                        </div>
                                    ))}
                                    {isUploading && (
                                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl text-[13px] text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                                            <span>上傳中 {uploadProgress}%</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input Row */}
                            <div className="flex items-end gap-3 p-2 pl-4">
                                {chatMode === 'project' && (
                                    <>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()} 
                                            disabled={isConnecting || isUploading}
                                            className="p-2 transition-transform active:scale-95 text-gray-400 dark:text-gray-300 hover:text-[#1877F2] dark:hover:text-[#1877F2] mb-1 disabled:opacity-50"
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
                                    placeholder={chatMode === 'project' ? "傳送訊息或上傳資料..." : "Message Corphia AI..."}
                                    rows={1}
                                    disabled={isConnecting}
                                    className="flex-1 resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none px-2 py-3 max-h-[160px] disabled:opacity-50 text-[16px] custom-scrollbar border-0"
                                    style={{ lineHeight: '1.4' }}
                                />
                                
                                <div className="ml-1 mr-1 mb-1">
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
                )}
                </AnimatePresence>
            </main>
            {/* hidden upload specific for chat view */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
                accept=".pdf,.docx,.xlsx,.txt,.md"
            />
            {/* Global Conversation Context Menu */}
            <AnimatePresence>
                {activeMenu && (
                    <motion.div 
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="fixed z-[100] w-[240px] bg-white dark:bg-[#282828] border border-gray-100 dark:border-[#333] shadow-lg dark:shadow-2xl rounded-[16px] overflow-hidden p-1.5 text-[14px] font-medium text-gray-800 dark:text-gray-200"
                        style={{ 
                            left: activeMenu.x, 
                            top: Math.min(activeMenu.y, window.innerHeight - 300) 
                        }}
                    >
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-[#333] transition-colors text-left" onClick={() => setActiveMenu(null)}>
                            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            分享
                        </button>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-[#333] transition-colors text-left" onClick={() => setActiveMenu(null)}>
                            <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            重新命名
                        </button>
                        <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-[#333] transition-colors text-left group" onClick={() => setActiveMenu(null)}>
                            <div className="flex items-center gap-3">
                                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                <span>移至專案</span>
                            </div>
                            <svg className="w-4 h-4 opacity-0 group-hover:opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>

                        <div className="h-[1px] bg-gray-100 dark:bg-[#444] my-1 mx-3" />

                        <button 
                            onClick={(e) => {
                                handleDeleteConversation(activeMenu.convId, e);
                                setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-red-50 dark:hover:bg-[#3a2020] text-red-500 transition-colors text-left group"
                        >
                            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            刪除
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
