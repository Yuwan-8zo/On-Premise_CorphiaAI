import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { conversationsApi } from '../api/conversations'
import type { Conversation, Message } from '../types/chat'
import MessageBubble from '../components/chat/MessageBubble'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

export default function Share() {
    const { conversationId } = useParams<{ conversationId: string }>()
    const { isAuthenticated } = useAuthStore()
    const { theme } = useUIStore()
    const navigate = useNavigate()

    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)

    // 如果未登入，顯示提示並允許跳轉登入
    useEffect(() => {
        if (!isAuthenticated) return

        const fetchChat = async () => {
            if (!conversationId) return
            try {
                setIsLoading(true)
                const [convData, msgsData] = await Promise.all([
                    conversationsApi.get(conversationId),
                    conversationsApi.getMessages(conversationId)
                ])
                setConversation(convData)
                setMessages(msgsData)
                
                // 捲動到底部
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight)
                    }
                }, 100)
            } catch (err) {
                console.error(err)
                setError('無法載入分享的對話。可能是不存在或已被刪除。')
            } finally {
                setIsLoading(false)
            }
        }
        fetchChat()
    }, [conversationId, isAuthenticated])

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-bg-base p-6">
                <div className="max-w-md w-full bg-bg-base rounded-[20px] p-8 shadow-xl text-center">
                    <h2 className="text-xl font-bold mb-4 text-text-primary">需要登入</h2>
                    <p className="text-text-secondary mb-8">
                        請先登入 Corphia AI 以查看該分享對話的內容。
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full h-[50px] rounded-full bg-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] text-text-primary font-semibold"
                    >
                        前往登入
                    </button>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh] bg-bg-base">
                <div className="w-8 h-8 rounded-full border-2 border-corphia-bronze/20 border-t-accent animate-spin" />
            </div>
        )
    }

    if (error || !conversation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-bg-base p-6 text-center">
                <h2 className="text-xl font-bold mb-2 text-text-primary">載入失敗</h2>
                <p className="text-text-secondary mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-2.5 rounded-full bg-bg-surface text-text-primary hover:bg-bg-surface"
                >
                    回首頁
                </button>
            </div>
        )
    }

    return (
        <div className={`flex flex-col h-[100dvh] bg-bg-base  ${theme === 'dark' ? 'dark' : ''}`}>
            {/* Header */}
            <header className="shrink-0 h-[60px] flex items-center justify-between px-4 border-b border-border-subtle bg-bg-base/80 /80 backdrop-blur-xl z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 -ml-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="font-semibold text-text-primary text-[15px]">
                            {conversation.title}
                        </h1>
                        <p className="text-[12px] text-text-secondary">分享的對話 (唯讀)</p>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-smooth"
            >
                <div className="max-w-[800px] mx-auto px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-6">
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="w-full"
                            >
                                <MessageBubble
                                    message={msg}
                                    hideActions={true}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
