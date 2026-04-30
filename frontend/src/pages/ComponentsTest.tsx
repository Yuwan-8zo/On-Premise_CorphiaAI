import React, { useState } from 'react'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useToastStore } from '../store/toastStore'
import { useUIStore } from '../store/uiStore'
import { useTranslation } from 'react-i18next'
import MessageBubble from '../components/chat/MessageBubble'
import { AlertCircle, CheckCircle2, MessageSquare, PanelLeftClose, Settings } from 'lucide-react'

export default function ComponentsTest() {
    const { t } = useTranslation()
    const { toasts, add, remove } = useToastStore()
    const { showConfirm } = useUIStore()
    const [events, setEvents] = useState<string[]>([])
    
    // Test states
    const [bubbleContent, setBubbleContent] = useState('你好！這是一個測試聊天氣泡。')
    const [isStreaming, setIsStreaming] = useState(false)

    const logEvent = (msg: string) => {
        setEvents(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10))
    }

    const testAddToast = (type: 'success' | 'error' | 'info') => {
        add(t('common.success', '操作成功測試！'), type)
        logEvent(`Triggered ${type} toast`)
    }

    return (
        <div className="min-h-screen bg-bg-base text-text-primary p-8 flex gap-8">
            {/* Left Panel: Controls */}
            <div className="flex-1 space-y-12 overflow-y-auto pr-4">
                <div className="mb-8 border-b border-border-subtle pb-4">
                    <h1 className="text-3xl font-bold mb-2">Corphia Component Sandbox</h1>
                    <p className="text-text-secondary">Interactive testing environment for UI components.</p>
                </div>

                {/* 1. Toasts */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-accent" />
                        Toast Notifications
                    </h2>
                    <div className="flex gap-4">
                        <button onClick={() => testAddToast('success')} className="px-4 py-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-colors">Success Toast</button>
                        <button onClick={() => testAddToast('error')} className="px-4 py-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors">Error Toast</button>
                        <button onClick={() => testAddToast('info')} className="px-4 py-2 bg-blue-500/20 text-blue-500 rounded-lg hover:bg-blue-500/30 transition-colors">Info Toast</button>
                    </div>
                </section>

                {/* 2. Modals */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <PanelLeftClose className="w-5 h-5 text-accent" />
                        Modals & Dialogs
                    </h2>
                    <button 
                        onClick={() => { 
                            logEvent('Opened ConfirmModal')
                            showConfirm(
                                t('settings.confirmDeleteFolder', '這是一個測試對話框，是否確定執行此操作？'),
                                () => {
                                    logEvent('Clicked Confirm on ConfirmModal')
                                    add(t('common.success', '確認操作成功！'), 'success')
                                }
                            )
                        }}
                        className="px-4 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors"
                    >
                        Open ConfirmModal
                    </button>
                </section>

                {/* 3. Message Bubble */}
                <section>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-accent" />
                        Message Bubble
                    </h2>
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium">Content:</label>
                            <input 
                                type="text" 
                                value={bubbleContent}
                                onChange={(e) => setBubbleContent(e.target.value)}
                                className="flex-1 bg-bg-surface border border-border-subtle rounded-lg px-3 py-2"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={isStreaming}
                                    onChange={(e) => setIsStreaming(e.target.checked)}
                                    className="rounded border-border-subtle"
                                />
                                <span className="text-sm font-medium">Is Streaming</span>
                            </label>
                        </div>
                    </div>
                    <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl max-w-2xl">
                        <MessageBubble
                            message={{
                                id: 'test-msg-1',
                                role: 'assistant',
                                content: bubbleContent,
                                createdAt: new Date().toISOString(),
                                tokens: 0,
                            }}
                            isStreaming={isStreaming}
                        />
                    </div>
                </section>
            </div>

            {/* Right Panel: Event Log */}
            <div className="w-80 shrink-0 h-[calc(100vh-4rem)] sticky top-8 bg-bg-surface border border-border-subtle rounded-xl p-4 flex flex-col">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-text-secondary">
                    <Settings className="w-4 h-4" />
                    Event Log
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                    <AnimatePresence>
                        {events.length === 0 ? (
                            <p className="text-sm text-text-tertiary italic text-center mt-4">No events recorded yet.</p>
                        ) : (
                            events.map((event, i) => (
                                <motion.div
                                    key={`${i}-${event}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="text-xs font-mono p-2 bg-bg-base rounded border border-border-subtle/50 text-text-secondary"
                                >
                                    {event}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Global Toasts rendering since this is isolated from App.tsx layout */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md
                                ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                                'bg-blue-500/10 border-blue-500/20 text-blue-500'}
                            `}
                        >
                            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
                            <p className="text-sm font-medium">{toast.message}</p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
