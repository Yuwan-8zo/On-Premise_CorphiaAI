/**
 * 對話主頁面
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useUIStore } from '../store/uiStore'

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

export default function Chat() {
    const { t } = useTranslation()
    const { user, clearAuth } = useAuthStore()
    const { messages, isStreaming, addMessage, setStreaming } = useChatStore()
    const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore()

    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

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

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return

        const userMessage = input.trim()
        setInput('')

        // 添加使用者訊息
        addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: userMessage,
            tokens: 0,
            createdAt: new Date().toISOString(),
        })

        // 模擬 AI 回應
        setStreaming(true)
        addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            tokens: 0,
            createdAt: new Date().toISOString(),
        })

        // 模擬串流回應 (實際開發需要連接 WebSocket)
        const response = `這是一個模擬的 AI 回應。

您說: "${userMessage}"

**Corphia AI Platform v2.2** 已成功建立基礎架構！

### 目前已完成：
- ✅ 後端 FastAPI 應用程式
- ✅ 前端 React + TypeScript
- ✅ 多語言支援 (繁中/英文/日文)
- ✅ 認證系統
- ✅ 狀態管理 (Zustand)

### 接下來：
1. 連接後端 API
2. 實作 WebSocket 串流
3. 整合 RAG 功能`

        let currentText = ''
        for (const char of response) {
            await new Promise((resolve) => setTimeout(resolve, 20))
            currentText += char
            useChatStore.setState((state) => {
                const newMessages = [...state.messages]
                newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content: currentText,
                }
                return { messages: newMessages }
            })
        }

        setStreaming(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleLogout = () => {
        clearAuth()
    }

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
                        className="w-full flex items-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 
                     text-white rounded-lg transition-colors"
                    >
                        <PlusIcon />
                        <span>{t('chat.newChat')}</span>
                    </button>
                </div>

                {/* 對話列表 */}
                <div className="flex-1 overflow-y-auto p-2">
                    <p className="text-slate-400 text-sm text-center py-8">
                        {t('chat.noConversations')}
                    </p>
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
                        Corphia AI
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
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                                ? 'bg-primary-600 text-white'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                    </div>
                                </div>
                            ))}
                            {isStreaming && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                                        <span className="animate-pulse text-slate-700 dark:text-slate-200">
                                            {t('chat.thinking')}
                                        </span>
                                    </div>
                                </div>
                            )}
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
                                className="flex-1 resize-none bg-transparent text-slate-700 dark:text-slate-200 
                         placeholder-slate-400 outline-none px-2 py-2 max-h-52"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isStreaming}
                                className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <SendIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
