/**
 * 對話主頁面（Corphia Custom 特製版）
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useUIStore } from '../store/uiStore'
import { conversationsApi } from '../api/conversations'
import { createChatWebSocket, type ChatWebSocket, type StreamResponse } from '../api/websocket'
import { MessageBubble } from '../components/chat'
import { motion } from 'framer-motion'
import type { Message } from '../types/chat'

// --- Custom UI Icons ---
const PlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
)

const InputPlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
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

const SidebarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 hover:text-white">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
)

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
        appendToLastMessage
    } = useChatStore()
    const { sidebarOpen, toggleSidebar } = useUIStore()

    const navigate = useNavigate()
    const [input, setInput] = useState('')
    const [isConnecting, setIsConnecting] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const wsRef = useRef<ChatWebSocket | null>(null)

    // Mode Toggle (UI Only)
    const [chatMode, setChatMode] = useState<'general' | 'project'>('general')


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
                console.log('收到來源:', data.sources)
                break
        }
    }, [appendToLastMessage, setStreaming])

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
        try {
            const msgs = await conversationsApi.getMessages(conversation.id)
            setMessages(msgs)
            await connectWebSocket(conversation.id)
        } catch (error) {
            console.error('載入訊息失敗:', error)
        }
    }, [setCurrentConversation, setMessages, connectWebSocket])

    const createNewConversation = async () => {
        try {
            const conversation = await conversationsApi.create({ 
                title: '新對話',
                settings: { isProject: chatMode === 'project' } 
            })
            addConversation(conversation)
            await selectConversation(conversation)
        } catch (error) {
            console.error('建立對話失敗:', error)
        }
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

        if (wsRef.current?.isConnected) {
            wsRef.current.sendMessage(userMessage, true)
        } else {
            // Frontend fallback flow
            try {
                if (conversationId) {
                    const response = await conversationsApi.sendMessage(conversationId, {
                        content: userMessage,
                        useRag: true,
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
        <div className="flex fixed inset-0 w-full h-[100dvh] bg-[#f0f2f5] dark:bg-[#1a1a1a] text-gray-900 dark:text-white overflow-hidden font-sans selection:bg-[#1877F2]/30">
            
            {/* --- Mobile Sidebar Overlay --- */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-transparent backdrop-blur-md z-30 md:hidden transition-opacity"
                    onClick={toggleSidebar}
                />
            )}

            {/* --- 左側邊欄 Sidebar --- */}
            <aside
                className={`${sidebarOpen ? 'w-[75vw] max-w-[260px] md:w-[280px] translate-x-0' : 'w-0 -translate-x-full'
                    } overflow-hidden bg-white dark:bg-[#111111] rounded-r-[44px] md:rounded-r-none transition-all duration-300 ease-in-out shrink-0 flex flex-col z-40 absolute md:relative h-full border-gray-200 dark:border-[#222] md:border-r`}
            >
                {/* 頂端控制區（包含新對話按鈕與切換器） */}
                <div className="pl-4 pr-6 md:pr-4 space-y-4 pt-6 pb-2 w-full">
                    {/* 新對話按鈕 */}
                    <button
                        onClick={createNewConversation}
                        className="w-full flex items-center justify-start gap-3 px-4 py-3 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] 
                                   text-gray-800 dark:text-white rounded-full transition-colors font-medium"
                    >
                        <PlusIcon />
                        <span className="text-[15px]">新對話</span>
                    </button>

                    {/* 一般 / 專案 切換膠囊 (與 Login 頁面相同樣式) */}
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
                </div>

                {/* 對話列表列 */}
                <div className="flex-1 overflow-y-auto px-4 mt-2 custom-scrollbar w-full">
                    {/* 分類標籤：依據聊天模式 */}
                    <div className="mb-2 pl-2 mt-1">
                        <span className="text-[12px] text-gray-500 tracking-wider font-medium">{chatMode === 'general' ? '一般聊天' : '專案聊天室'}</span>
                    </div>
                    {/* 時間線指示器邊距效果 */}
                    <div className="border-l border-gray-200 dark:border-[#333] ml-2 pl-2 space-y-1 transition-colors">
                        {(() => {
                            const filteredConversations = conversations.filter(conv => {
                                const isProject = Boolean(conv.settings?.isProject)
                                return chatMode === 'project' ? isProject : !isProject
                            })

                            if (filteredConversations.length === 0) {
                                return <p className="text-gray-400 dark:text-[#666] text-xs py-4 pl-2">No recent chats</p>
                            }

                            return filteredConversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => selectConversation(conv)}
                                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-[14px] transition-colors group ${currentConversation?.id === conv.id
                                        ? 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white font-medium'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#222] hover:text-gray-900 dark:hover:text-gray-200'
                                        }`}
                                >
                                    <span className="truncate pr-2">{conv.title}</span>
                                </button>
                            ))
                        })()}
                    </div>
                </div>

                {/* 底部滿版膠囊使用者卡片 */}
                <div className="pl-4 pr-6 md:pr-4 pb-6 pt-2 w-full">
                    <button 
                        onClick={() => navigate('/settings')}
                        title="前往設定"
                        className="w-full flex items-center gap-3 p-1.5 pr-4 rounded-full bg-gray-50 dark:bg-[#1e1e1e] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors text-left"
                    >
                        {/* 圓形頭像框 */}
                        <div className="w-[34px] h-[34px] rounded-full bg-white dark:bg-[#111] flex items-center justify-center shrink-0 border border-gray-200 dark:border-[#333]">
                            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-gray-400 dark:text-gray-500">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4ZM6 8C6 4.68629 8.68629 2 12 2C15.3137 2 18 4.68629 18 8C18 11.3137 15.3137 14 12 14C8.68629 14 6 11.3137 6 8ZM12 15C7.58172 15 4 18.5817 4 23C4 23.5523 4.44772 24 5 24H19C19.5523 24 20 23.5523 20 23C20 18.5817 16.4183 15 12 15ZM6.04631 22C6.54145 19.1673 8.98926 17 12 17C15.0107 17 17.4586 19.1673 17.9537 22H6.04631Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] text-gray-700 dark:text-gray-300 font-medium truncate">{user?.name || 'Local User'}</p>
                        </div>
                    </button>
                </div>
            </aside>

            {/* --- 右側主聊天視窗 Main Section --- */}
            <main className="flex-1 flex flex-col relative w-full min-h-0 overflow-hidden">
                {/* 固定的頂部 Header (Top Bar) */}
                <header className="shrink-0 w-full p-4 md:p-6 flex items-center justify-between z-20 bg-[#f0f2f5] dark:bg-[#1a1a1a]">
                    <div className="flex items-center">
                        {!sidebarOpen && (
                            <button
                                onClick={toggleSidebar}
                                className="mr-4 p-2 rounded-lg hover:bg-gray-200/50 dark:hover:bg-[#2a2a2a] transition-colors"
                            >
                                <SidebarIcon />
                            </button>
                        )}
                        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-gray-200 tracking-wide">
                            Corphia
                        </h1>
                    </div>
                </header>

                {/* 內容區：滑動區域（根據空狀態或聊天動態渲染） */}
                <div className="flex-1 flex flex-col overflow-y-auto w-full relative z-10 custom-scrollbar px-4 md:px-0 pb-4 min-h-0">
                    
                    {messages.length === 0 ? (
                        // 空狀態：改為置頂與上方留白，讓內容可以自然向上滾動，不要用 flex-center 死鎖
                        <div className="w-full max-w-3xl mx-auto pb-8 pt-[15vh]">
                            {/* Greeting */}
                            <h2 className="text-[28px] md:text-3xl font-semibold mb-8 text-gray-800 dark:text-gray-100 tracking-tight text-center leading-snug">
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
                                        <div className="font-semibold text-[15px] mb-1.5 text-gray-800 dark:text-gray-200 group-hover:text-[#1877F2] transition-colors">{item.title}</div>
                                        <div className="text-[13.5px] text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 leading-relaxed">{item.desc}</div>
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

                {/* 固定的底部輸入框區（不管有沒有訊息都在最底下） */}
                <div className="shrink-0 pt-2 pb-6 md:pb-8 w-full bg-gradient-to-t from-[#f0f2f5] via-[#f0f2f5] dark:from-[#1a1a1a] dark:via-[#1a1a1a] to-transparent z-20">
                    <div className="max-w-3xl mx-auto px-4 md:px-0 w-full relative">
                        {/* 這裡的 rounded-[28px] 近似 56px 高度的 1/2 */}
                        <div className="relative flex items-end gap-3 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#333]/50 rounded-[28px] p-2 pl-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-colors ring-1 ring-black/5 dark:ring-white/5 focus-within:ring-2 focus-within:ring-[#1877F2]/20">
                            <button className="p-2 transition-transform active:scale-95 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-white mb-1">
                                <InputPlusIcon />
                            </button>
                            
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Message Corphia AI..."
                                rows={1}
                                disabled={isConnecting}
                                className="flex-1 resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none px-2 py-3.5 max-h-[160px] disabled:opacity-50 text-[16px] custom-scrollbar border-0"
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
            </main>
        </div>
    )
}
