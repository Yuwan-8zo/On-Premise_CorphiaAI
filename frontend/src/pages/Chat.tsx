/**
 * 對話主頁面（已整合 WebSocket）
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

// Icons
const SendIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
)

const MenuIcon = () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
)

const PlusIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
)

const LogoutIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
)

const StopIcon = () => (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
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
    const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore()

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
                // TODO: 處理來源引用
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
    const handleSend = async () => {
        if (!input.trim() || isStreaming) return

        const userMessage = input.trim()
        setInput('')

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

                // 更新助手訊息
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

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            {/* 側邊欄 */}
            <aside
                className={`${sidebarOpen ? 'w-72' : 'w-0'
                    } bg-slate-800 dark:bg-slate-950 transition-all duration-300 overflow-hidden flex flex-col`}
            >
                {/* 新對話按鈕 */}
                <div className="p-4">
                    <button
                        onClick={createNewConversation}
                        className="w-full flex items-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 
                     text-white rounded-lg transition-colors"
                    >
                        <PlusIcon />
                        <span>{t('chat.newChat')}</span>
                    </button>
                </div>

                {/* 對話列表 */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-8">
                            {t('chat.noConversations')}
                        </p>
                    ) : (
                        conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => selectConversation(conv)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${currentConversation?.id === conv.id
                                    ? 'bg-slate-700 text-white'
                                    : 'text-slate-300 hover:bg-slate-700/50'
                                    }`}
                            >
                                {conv.title}
                            </button>
                        ))
                    )}
                </div>

                {/* 使用者資訊 */}
                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{user?.name}</p>
                            <p className="text-slate-400 text-sm truncate">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title={t('auth.logout')}
                        >
                            <LogoutIcon />
                        </button>
                    </div>
                </div>
            </aside>

            {/* 主內容區 */}
            <main className="flex-1 flex flex-col">
                {/* 頂部導覽列 */}
                <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                        <MenuIcon />
                    </button>
                    <h1 className="text-lg font-medium text-slate-700 dark:text-slate-200">
                        {currentConversation?.title || 'Corphia AI'}
                    </h1>
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </header>

                {/* 訊息區域 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                                    👋 {t('auth.welcomeBack')}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400">
                                    {t('chat.startNewChat')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6">
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

                {/* 輸入區域 */}
                <div className="border-t border-slate-200 dark:border-slate-800 p-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="relative flex items-end gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('chat.placeholder')}
                                rows={1}
                                disabled={isConnecting}
                                className="flex-1 resize-none bg-transparent text-slate-700 dark:text-slate-200 
                         placeholder-slate-400 outline-none px-2 py-2 max-h-52
                         disabled:opacity-50"
                            />
                            {isStreaming ? (
                                <button
                                    onClick={handleStop}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
                                >
                                    <StopIcon />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isConnecting}
                                    className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <SendIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
