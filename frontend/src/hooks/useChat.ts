import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { ChatStreamResponse } from '../types/chat'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1/ws'

export const useChat = (conversationId: string | null) => {
    const { accessToken } = useAuthStore()
    const {
        addMessage,
        appendToLastMessage,
        setStreaming,
        updateMessage,
        messages
    } = useChatStore()

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

    const connect = useCallback(() => {
        if (!conversationId || !accessToken) return

        // 關閉舊連線
        if (wsRef.current) {
            wsRef.current.close()
        }

        const wsUrl = `${WS_URL}/${conversationId}?token=${accessToken}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log('WebSocket Connected')
        }

        ws.onmessage = (event) => {
            try {
                const data: ChatStreamResponse = JSON.parse(event.data)

                switch (data.type) {
                    case 'start':
                        // 收到開始訊號，建立一個空的 Assistant 訊息
                        // 注意：這裡假設 User 訊息已經先被樂觀更新(Optimistic UI) 加入了
                        addMessage({
                            id: Date.now().toString(), // 暫時 ID
                            role: 'assistant',
                            content: '',
                            tokens: 0,
                            createdAt: new Date().toISOString(),
                        })
                        setStreaming(true)
                        break

                    case 'stream':
                        if (data.content) {
                            appendToLastMessage(data.content)
                        }
                        break

                    case 'done':
                        setStreaming(false)
                        // 可以在此更新完整的訊息內容或統計數據
                        if (data.sources && messages.length > 0) {
                            // 更新最後一則訊息的來源引用
                            const lastMsg = messages[messages.length - 1]
                            updateMessage(lastMsg.id, { sources: data.sources })
                        }
                        break

                    case 'error':
                        console.error('WebSocket Error:', data.error)
                        setStreaming(false)
                        // 顯示錯誤訊息
                        appendToLastMessage(`\n\n[系統錯誤: ${data.message || '未知錯誤'}]`)
                        break
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err)
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error)
            setStreaming(false)
        }

        ws.onclose = () => {
            console.log('WebSocket Disconnected')
            // 可以在此實作自動重連邏輯
        }

        wsRef.current = ws
    }, [conversationId, accessToken, addMessage, appendToLastMessage, setStreaming, updateMessage, messages])

    // 當 conversationId 改變時重新連線
    useEffect(() => {
        connect()

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [connect])

    const sendMessage = useCallback((content: string, useRag: boolean = true) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // 先在 UI 顯示 User 訊息
            addMessage({
                id: Date.now().toString(),
                role: 'user',
                content,
                tokens: 0,
                createdAt: new Date().toISOString()
            })

            // 發送 WebSocket 訊息
            wsRef.current.send(JSON.stringify({
                message: content,
                useRag
            }))
        } else {
            console.error('WebSocket is not connected')
            // 可以嘗試重連或提示使用者
        }
    }, [addMessage])

    return { sendMessage }
}
