/**
 * 聊天的即時連線（WebSocket）：每個對話一條，切換對話就換一條
 *   收到的字交給 messageStreamHandlers 處理；只接受「目前畫面上這個對話」的訊息
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createChatWebSocket, type ChatWebSocket } from '@/api/websocket'
import { useChatStore } from '@/store/chatStore'
import { useToastStore } from '@/store/toastStore'
import { buildStreamDispatcher } from './messageStreamHandlers'

export function useChatSocket() {
    const wsRef = useRef<ChatWebSocket | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const toast = useToastStore()
    const { appendToLastMessage, setStreaming, setSourcesToLastMessage } = useChatStore()

    // 封包分派表固定成同一個函式，connect 才不會每次重新訂閱
    const handleMessage = useCallback(
        buildStreamDispatcher({ appendToLastMessage, setStreaming, setSourcesToLastMessage, toast }),
        [appendToLastMessage, setStreaming, setSourcesToLastMessage, toast],
    )

    const connect = useCallback(async (conversationId: string) => {
        if (wsRef.current) {
            wsRef.current.disconnect()
            // 換對話時舊的回答會被中斷，不會再收到「完成」；不重設的話畫面會一直停在生成中
            if (useChatStore.getState().isStreaming) setStreaming(false)
        }

        const ws = createChatWebSocket(conversationId)
        ws.onMessage((data) => {
            const current = useChatStore.getState().currentConversation
            if (current && current.id !== conversationId) return // 舊連線晚到的字不能接到別的對話上
            handleMessage(data)
        })
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
    }, [handleMessage, setStreaming])

    useEffect(() => () => wsRef.current?.disconnect(), [])

    return { wsRef, isConnecting, connect }
}
