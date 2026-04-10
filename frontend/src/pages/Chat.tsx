/**
 * 對話主頁面（ChatGPT UI 復刻版）
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useUIStore } from '../store/uiStore'
import { conversationsApi } from '../api/conversations'
import { createChatWebSocket, type ChatWebSocket, type StreamResponse } from '../api/websocket'
import { MessageBubble } from '../components/chat'
import type { Message } from '../types/chat'

// --- ChatGPT Icons ---
const SidebarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
)

const NewChatIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
)

const AttachmentIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-400">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

const SendIcon = ({ disabled }: { disabled?: boolean }) => (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${disabled ? 'bg-[#676767]' : 'bg-white'}`}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={`w-5 h-5 ${disabled ? 'text-gray-400' : 'text-black'}`}>
            <path d="M12 18V6M12 6L7 11M12 6L17 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    </div>
)

const StopIcon = () => (
    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="black">
            <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
    </div>
)

const DownArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 text-gray-400">
        <path d="M6 9l6 6 6-6"/>
    </svg>
)

const LargeLogoIcon = () => (
    <div className="w-12 h-12 rounded-full border border-gray-600 bg-transparent flex items-center justify-center mb-4">
        <svg fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8 text-gray-200">
            <path d="M12 2l2.4 7.6H22l-6.2 4.5 2.4 7.6-6.2-4.5-6.2 4.5 2.4-7.6L2 9.6h7.6L12 2z" />
        </svg>
    </div>
)

export default function Chat() {
    const { t } = useTranslation()
    const { user, clearAuth } = useAuthStore()
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
        appendToLastMessage
    } = useChatStore()
    const { sidebarOpen, toggleSidebar } = useUIStore()

    const [input, setInput] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const wsRef = useRef<ChatWebSocket | null>(null)

    // 載入對話列表
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

    // 自動滾動到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // 自動調整輸入框高度
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto'
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    // 處理 WebSocket 訊息
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
                console.log('收到來源:', data.sources)
                break
        }
    }, [appendToLastMessage, setStreaming])

    // 連接 WebSocket
    const connectWebSocket = useCallback(async (conversationId: string) => {
        if (wsRef.current) {
            wsRef.current.disconnect()
        }

        const ws = createChatWebSocket(conversationId)
        ws.onMessage(handleWebSocketMessage)
        ws.onClose(() => {
            console.log('WebSocket 已斷開')
        })

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

    // 選擇對話
    const selectConversation = useCallback(async (conversation: typeof currentConversation) => {
        if (!conversation) return

        setCurrentConversation(conversation)

        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
            setMessages(msgs)
            await connectWebSocket(conversation.id)
        } catch (error) {
            console.error('載入訊息失敗:', error)
        }
    }, [setCurrentConversation, setMessages, connectWebSocket])

    // 建立新對話
    const createNewConversation = async () => {
        try {
            const conversation = await conversationsApi.create({ title: '新對話' })
            addConversation(conversation)
            await selectConversation(conversation)
        } catch (error) {
            console.error('建立對話失敗:', error)
        }
    }

    // 發送訊息
    const handleSend = async (promptOverride?: string) => {
        const textToSend = promptOverride || input
        if (!textToSend.trim() || isStreaming) return

        const userMessage = textToSend.trim()
        if (!promptOverride) setInput('')

        // 如果沒有當前對話，先建立一個
        let conversationId = currentConversation?.id
        if (!conversationId) {
            try {
                const conversation = await conversationsApi.create({ title: userMessage.slice(0, 50) })
                addConversation(conversation)
                setCurrentConversation(conversation)
                conversationId = conversation.id
                await connectWebSocket(conversationId)
            } catch (error) {
                console.error('建立對話失敗:', error)
                return
            }
        }

        // 添加使用者訊息到 UI
        const tempUserMessage: Message = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: userMessage,
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
        addMessage(tempUserMessage)

        // 添加空的助手訊息（準備接收串流）
        const tempAssistantMessage: Message = {
            id: `temp-${Date.now() + 1}`,
            role: 'assistant',
            content: '',
            tokens: 0,
            createdAt: new Date().toISOString(),
        }
        addMessage(tempAssistantMessage)
        setStreaming(true)

        // 透過 WebSocket 發送訊息
        if (wsRef.current?.isConnected) {
            wsRef.current.sendMessage(userMessage, true)
        } else {
            // 回退到 HTTP API
            try {
                const response = await conversationsApi.sendMessage(conversationId, {
                    content: userMessage,
                    useRag: true,
                })

                useChatStore.setState((state) => {
                    const newMessages = [...state.messages]
                    newMessages[newMessages.length - 1] = response
                    return { messages: newMessages }
                })
            } catch (error) {
                console.error('發送訊息失敗:', error)
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
        if (wsRef.current) {
            wsRef.current.stop()
        }
        setStreaming(false)
    }

    const handleLogout = () => {
        if (wsRef.current) {
            wsRef.current.disconnect()
        }
        clearAuth()
    }

    // 清理 WebSocket
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.disconnect()
            }
        }
    }, [])
    
    // 幾個預設提示詞
    const suggestedPrompts = [
        "Explain quantum computing",
        "How to learn React efficiently",
        "Write a python script",
        "Help me debug an issue"
    ]

    return (
        // ChatGPT 背景：主畫面 #212121
        <div className="flex h-screen bg-[#212121] text-white overflow-hidden font-sans">
            {/* 側邊欄 Sidebar (背景 #171717) */}
            <aside
                className={`${sidebarOpen ? 'w-[260px] translate-x-0' : 'w-0 -translate-x-full'
                    } bg-[#171717] transition-all duration-300 ease-in-out shrink-0 flex flex-col z-20 absolute md:relative h-full`}
            >
                {/* 頂端小工具列 */}
                <div className="p-3 flex items-center justify-between">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#202123] rounded-lg transition-colors"
                        title="Close sidebar"
                    >
                        <SidebarIcon />
                    </button>
                    <button
                        onClick={createNewConversation}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#202123] rounded-lg transition-colors"
                        title="New Chat"
                    >
                        <NewChatIcon />
                    </button>
                </div>

                {/* 對話列表列 */}
                <div className="flex-1 overflow-y-auto px-3 space-y-1 mt-2 custom-scrollbar">
                    {conversations.length === 0 ? (
                        <p className="text-[#666] text-xs px-2 py-4">No recent chats</p>
                    ) : (
                        conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => selectConversation(conv)}
                                className={`w-full flex items-center text-left px-3 py-2.5 rounded-lg text-[14px] truncate transition-colors ${currentConversation?.id === conv.id
                                    ? 'bg-[#202123] text-white'
                                    : 'text-gray-300 hover:bg-[#202123]'
                                    }`}
                            >
                                <span className="truncate">{conv.title}</span>
                            </button>
                        ))
                    )}
                </div>

                {/* 使用者區塊 (底部) */}
                <div className="p-3">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#202123] transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] text-gray-200 font-medium truncate">{user?.name || 'Local User'}</p>
                        </div>
                    </button>
                </div>
            </aside>

            {/* 主聊天區 Main Content */}
            <main className="flex-1 flex flex-col min-w-0 relative">
                {/* 頂端 Header (懸浮透明感) */}
                <header className="h-14 flex items-center justify-between px-3 md:px-4 z-10 sticky top-0 bg-[#212121]">
                    <div className="flex items-center">
                        {!sidebarOpen && (
                            <button
                                onClick={toggleSidebar}
                                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors mr-2 hidden md:block"
                            >
                                <SidebarIcon />
                            </button>
                        )}
                        {/* 手機版強制顯示 Menu 按鈕 */}
                        {!sidebarOpen && (
                            <button
                                onClick={toggleSidebar}
                                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors mr-2 md:hidden"
                            >
                                <SidebarIcon />
                            </button>
                        )}
                        <button className="flex items-center gap-2 text-[18px] font-semibold text-gray-200 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg transition-colors">
                            {currentConversation?.title || 'Corphia AI'}
                            <DownArrowIcon />
                        </button>
                    </div>
                </header>

                {/* 聊天訊息或空狀態區 */}
                <div className="flex-1 overflow-y-auto w-full relative">
                    {messages.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                            <LargeLogoIcon />
                            <h2 className="text-2xl md:text-[32px] font-semibold text-gray-100 mb-8 tracking-tight">
                                How can I help you today?
                            </h2>
                        </div>
                    ) : (
                        <div className="w-full mx-auto max-w-3xl pb-32 pt-6 px-4 md:px-0 space-y-6">
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

                    {/* 置底提示詞建議 (僅空狀態顯示，放於對話區之下但緊貼輸入框) */}
                    {messages.length === 0 && (
                        <div className="absolute bottom-28 left-0 right-0 max-w-3xl mx-auto px-4 w-full z-10">
                           <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                                {suggestedPrompts.map((prompt, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(prompt)}
                                        className="text-left px-4 py-3 bg-[#212121] border border-gray-700 hover:bg-[#2f2f2f] text-[13.5px] text-gray-300 rounded-xl transition-all"
                                    >
                                        <p className="truncate line-clamp-2 white-space-normal leading-tight">"{prompt}"</p>
                                    </button>
                                ))}
                           </div>
                        </div>
                    )}
                </div>

                {/* 底部輸入框區域 */}
                <div className="w-full absolute bottom-0 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-6 pb-2 md:pb-6">
                    <div className="max-w-3xl mx-auto w-full px-4 md:px-0">
                        <div className="relative flex items-end gap-2 bg-[#2f2f2f] rounded-[26px] p-2 pr-3">
                            {/* 附件圖示 */}
                            <button className="p-2 text-gray-400 hover:text-white rounded-full transition-colors mb-0.5">
                                <AttachmentIcon />
                            </button>
                            
                            {/* 關鍵輸入框 */}
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message Corphia AI..."
                                rows={1}
                                disabled={isConnecting}
                                className="flex-1 resize-none bg-transparent text-gray-100 placeholder-gray-400 outline-none px-1 py-3 max-h-[200px] disabled:opacity-50 text-[15.5px]"
                                style={{ lineHeight: '1.5' }}
                            />
                            
                            {/* 發送 / 停止 按鈕 */}
                            <div className="mb-1 ml-1 flex items-center justify-center">
                                {isStreaming ? (
                                    <button
                                        onClick={handleStop}
                                        className="transition-transform active:scale-95"
                                    >
                                        <StopIcon />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={!input.trim() || isConnecting}
                                        className="transition-transform active:scale-95"
                                    >
                                        <SendIcon disabled={!input.trim() || isConnecting} />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* 免責聲明 */}
                        <div className="text-center mt-3">
                            <p className="text-[12px] text-gray-500">
                                Corphia AI can make mistakes. Check important info.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
