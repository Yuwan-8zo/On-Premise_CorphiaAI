import { useEffect, useState, useRef } from 'react'
import { ArrowLeft } from '@/components/snow/icons'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { conversationsApi } from '@/api/conversations'
import { useTranslation } from 'react-i18next'
import type { Conversation, Message } from '@/types/chat'
import MessageBubble from '@/features/chat/components/MessageBubble'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { SkelMessages } from '@/components/ui/Skeleton'
import { displayTitle } from '@/lib/conversationTitle'

export default function Share() {
    const { t } = useTranslation()
    const { conversationId } = useParams<{ conversationId: string }>()
    const { isAuthenticated } = useAuthStore()
    const { theme } = useUIStore()
    const navigate = useNavigate()

    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ownerName, setOwnerName] = useState('')

    const scrollRef = useRef<HTMLDivElement>(null)

    // 如果未登入，顯示提示並允許跳轉登入
    useEffect(() => {
        if (!isAuthenticated) return

        const fetchChat = async () => {
            if (!conversationId) return
            try {
                setIsLoading(true)
                // 唯讀分享：主人自己，或主人已分享且同租戶的人才拿得到
                const shared = await conversationsApi.getShared(conversationId)
                setConversation(shared.conversation)
                setMessages(shared.messages)
                setOwnerName(shared.isOwner ? '' : shared.ownerName)
                
                // 捲動到底部
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight)
                    }
                }, 100)
            } catch (err) {
                console.error(err)
                setError((err as { response?: { status?: number } })?.response?.status === 404 ? t('ui.share.notShared') : t('share.loadError'))
            } finally {
                setIsLoading(false)
            }
        }
        fetchChat()
    }, [conversationId, isAuthenticated, t])

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-bg-base p-6">
                <div className="max-w-md w-full paper !rounded-[var(--r-32)] p-8 text-center">
                    <h2 className="text-xl font-bold mb-4 text-text-primary">{t('share.loginRequired')}</h2>
                    <p className="text-text-secondary mb-8">
                        {t('share.loginDesc')}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="btn btn-lg btn-primary w-full"
                    >
                        {t('share.goToLogin')}
                    </button>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="min-h-[100dvh] bg-bg-base">
                <SkelMessages count={5} className="mx-auto max-w-3xl px-4 pt-[var(--sp-96)]" />
            </div>
        )
    }

    if (error || !conversation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-bg-base p-6 text-center">
                <h2 className="text-xl font-bold mb-2 text-text-primary">{t('share.loadFailed')}</h2>
                <p className="text-text-secondary mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="btn btn-secondary"
                >
                    {t('share.backToHome')}
                </button>
            </div>
        )
    }

    return (
        <div className={`flex flex-col h-[100dvh] bg-bg-base  ${theme === 'dark' ? 'dark' : ''}`}>
            {/* Header */}
            <header className="shrink-0 h-[var(--sz-60)] flex items-center justify-between px-4 border-b border-[var(--paper-line)] bg-[var(--glass-card)] backdrop-blur-xl z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        aria-label={t('share.backToHome')}
                        className="p-2 -ml-2 rounded-full text-text-secondary transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="font-semibold text-text-primary text-[length:var(--fs-15)]">
                            {displayTitle(conversation.title)}
                        </h1>
                        <p className="text-[length:var(--fs-12)] text-text-secondary">{ownerName ? t('ui.share.byOwner', { name: ownerName }) : t('share.readonly')}</p>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-smooth"
            >
                <div className="max-w-[var(--sz-800)] mx-auto px-4 sm:px-6 md:px-8 py-8 flex flex-col gap-6">
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
