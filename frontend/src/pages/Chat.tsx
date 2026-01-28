import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { conversationsApi } from '../api/conversations'
import { useChat } from '../hooks/useChat'
import { MessageBubble } from '../components/chat/MessageBubble'

// Icons
const SendIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
)

export default function Chat() {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const {
        setConversations,
        currentConversation,
        messages,
        isStreaming,
        setCurrentConversation,
        setMessages,
        addConversation,
    } = useChatStore()

    const [input, setInput] = useState('')
    const [useRag, setUseRag] = useState(true)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // 使用自訂 Hook 處理 WebSocket
    const { sendMessage } = useChat(currentConversation?.id || null)

    // 初始載入對話列表 (給 Store 用，雖然 Sidebar 也會讀取)
    useEffect(() => {
        const loadConversations = async () => {
            try {
                const data = await conversationsApi.list()
                setConversations(data.data)
            } catch (error) {
                console.error('Failed to load conversations:', error)
            }
        }
        loadConversations()
    }, [setConversations])

    // 切換對話時載入訊息
    useEffect(() => {
        const loadMessages = async () => {
            if (currentConversation) {
                try {
                    const msgs = await conversationsApi.getMessages(currentConversation.id)
                    setMessages(msgs)
                } catch (error) {
                    console.error('Failed to load messages:', error)
                    if (error instanceof Error && error.message.includes('404')) {
                        setCurrentConversation(null)
                    }
                }
            } else {
                setMessages([])
            }
        }
        loadMessages()
    }, [currentConversation, setMessages, setCurrentConversation])

    // 自動滾動到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isStreaming])

    // 自動調整輸入框高度
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'inherit'
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    const handleSend = async () => {
        if (!input.trim() || isStreaming) return
        const content = input.trim()
        setInput('')

        try {
            if (!currentConversation) {
                // 建立新對話
                const title = content.slice(0, 30)
                const newConv = await conversationsApi.create(title)

                addConversation(newConv)
                setCurrentConversation(newConv)

                // 延遲發送
                setTimeout(() => sendMessage(content, useRag), 500)
            } else {
                sendMessage(content, useRag)
            }
        } catch (error) {
            console.error('Failed to send message:', error)
            alert(t('errors.networkError'))
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="flex flex-col h-full w-full">
            {/* 訊息區域 */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mb-6">
                            <span className="text-4xl">🤖</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                            {t('auth.welcomeBack')}, {user?.name}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 max-w-md">
                            {t('chat.startNewChat')}
                        </p>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto space-y-6 pb-4">
                        {messages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                        ))}
                        {isStreaming && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 輸入區域 */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                <div className="max-w-3xl mx-auto space-y-3">
                    {/* 功能開關 */}
                    <div className="flex items-center gap-4 px-2">
                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={useRag}
                                onChange={(e) => setUseRag(e.target.checked)}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>啟用知識庫 (RAG)</span>
                        </label>
                        {/* 未來可增加：選擇模型、清除對話等 */}
                    </div>

                    {/* 輸入框 */}
                    <div className="relative flex items-end gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-300 dark:border-slate-700 p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary-500/50 transition-shadow">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('chat.placeholder')}
                            rows={1}
                            className="flex-1 resize-none bg-transparent text-slate-700 dark:text-slate-200 
                       placeholder-slate-400 outline-none px-2 py-3 max-h-52 min-h-[44px]"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isStreaming}
                            className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all
                       shadow-sm hover:shadow-md active:scale-95"
                        >
                            <SendIcon />
                        </button>
                    </div>
                    <p className="text-xs text-center text-slate-400 dark:text-slate-600">
                        AI 模型可能會產生錯誤資訊，請核對重要事實。
                    </p>
                </div>
            </div>
        </div>
    )
}
