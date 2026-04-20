/**
 * Chat 頁面自訂 Hooks
 *
 * 從 Chat.tsx 拆出的業務邏輯 Hooks，
 * 讓主元件 focus 在 JSX 呈現，邏輯層獨立管理。
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { conversationsApi } from '../../api/conversations'
import { createChatWebSocket, type ChatWebSocket, type StreamResponse } from '../../api/websocket'
import { useUIStore } from '../../store/uiStore'
import type { Message } from '../../types/chat'

/**
 * WebSocket 連線與訊息處理 Hook
 *
 * 管理 WS 連線生命週期、串流訊息處理、安全警告擷取
 */
export function useChatWebSocket() {
    const wsRef = useRef<ChatWebSocket | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)

    const {
        appendToLastMessage,
        setStreaming,
        setSourcesToLastMessage,
    } = useChatStore()

    const handleWebSocketMessage = useCallback((data: StreamResponse) => {
        switch (data.type) {
            case 'stream':
                if (data.content) {
                    appendToLastMessage(data.content)
                }
                break
            case 'done': {
                setStreaming(false)
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
                    setSourcesToLastMessage(data.sources)
                }
                if (data.debug) {
                    useChatStore.getState().setRAGDebug(data.debug)
                }
                break
            case 'pii_warning':
                useChatStore.getState().addSecurityWarning({
                    type: 'pii',
                    message: data.message || '偵測到敏感資訊已自動遮罩',
                    data: { mask_map: data.mask_map || [] },
                    timestamp: Date.now(),
                })
                break
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

    // 元件卸載時斷開連線
    useEffect(() => {
        return () => wsRef.current?.disconnect()
    }, [])

    return { wsRef, isConnecting, connectWebSocket }
}

/**
 * 無限捲動 Hook
 *
 * 管理往上滾動時的歷史訊息載入
 */
export function useInfiniteScroll(scrollContainerRef: React.RefObject<HTMLDivElement | null>) {
    const [hasMoreMessages, setHasMoreMessages] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const topObserverRef = useRef<HTMLDivElement>(null)

    const loadMoreMessages = useCallback(async () => {
        const convId = useChatStore.getState().currentConversation?.id
        const currentMsgs = useChatStore.getState().messages
        if (!convId || currentMsgs.length === 0 || isLoadingMore || !hasMoreMessages) return

        try {
            setIsLoadingMore(true)
            const firstMsgId = currentMsgs[0].id
            const olderMsgs = await conversationsApi.getMessages(convId, { beforeId: firstMsgId })

            if (olderMsgs.length > 0) {
                const scrollContainer = scrollContainerRef.current
                const oldScrollHeight = scrollContainer?.scrollHeight || 0

                useChatStore.getState().setMessages([...olderMsgs, ...currentMsgs])
                setHasMoreMessages(olderMsgs.length === 50)

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
    }, [isLoadingMore, hasMoreMessages, scrollContainerRef])

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
    }, [loadMoreMessages, scrollContainerRef])

    return { hasMoreMessages, setHasMoreMessages, isLoadingMore, topObserverRef }
}

/**
 * 對話選擇 Hook
 *
 * 管理選擇對話、載入訊息與 WebSocket 連線
 */
export function useConversationSelect(connectWebSocket: (id: string) => Promise<void>, setHasMoreMessages: (v: boolean) => void) {
    const { setCurrentConversation, setMessages } = useChatStore()
    const { setSidebarOpen } = useUIStore()

    const selectConversation = useCallback(async (conversation: ReturnType<typeof useChatStore.getState>['currentConversation']) => {
        if (!conversation) return
        setCurrentConversation(conversation)
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
    }, [setCurrentConversation, setMessages, connectWebSocket, setSidebarOpen, setHasMoreMessages])

    return { selectConversation }
}
