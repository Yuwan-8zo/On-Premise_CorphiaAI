/**
 * WebSocket 客戶端
 */

import { useAuthStore } from '../store/authStore'

export interface WebSocketMessage {
    type: 'message' | 'ping' | 'stop'
    content?: string
    useRag?: boolean
    temperature?: number
    maxTokens?: number
}

export interface StreamResponse {
    type: 'stream' | 'done' | 'error' | 'sources' | 'pong'
    content?: string
    messageId?: string
    sources?: Array<{
        chunkId: string
        content: string
        score: number
        metadata: Record<string, unknown>
    }>
    message?: string
}

type MessageHandler = (data: StreamResponse) => void
type ConnectionHandler = () => void
type ErrorHandler = (error: Event) => void

export class ChatWebSocket {
    private ws: WebSocket | null = null
    private conversationId: string
    private reconnectAttempts = 0
    private maxReconnectAttempts = 3
    private reconnectDelay = 1000

    private messageHandlers: MessageHandler[] = []
    private openHandlers: ConnectionHandler[] = []
    private closeHandlers: ConnectionHandler[] = []
    private errorHandlers: ErrorHandler[] = []

    constructor(conversationId: string) {
        this.conversationId = conversationId
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const token = useAuthStore.getState().accessToken
            if (!token) {
                reject(new Error('未登入'))
                return
            }

            // 確定 WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            const url = `${protocol}//${host}/ws/chat/${this.conversationId}?token=${token}`

            this.ws = new WebSocket(url)

            this.ws.onopen = () => {
                console.log('WebSocket 已連接')
                this.reconnectAttempts = 0
                this.openHandlers.forEach((handler) => handler())
                resolve()
            }

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as StreamResponse
                    this.messageHandlers.forEach((handler) => handler(data))
                } catch (e) {
                    console.error('無法解析 WebSocket 訊息:', e)
                }
            }

            this.ws.onclose = () => {
                console.log('WebSocket 已斷開')
                this.closeHandlers.forEach((handler) => handler())

                // 嘗試重連
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++
                    setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts)
                }
            }

            this.ws.onerror = (error) => {
                console.error('WebSocket 錯誤:', error)
                this.errorHandlers.forEach((handler) => handler(error))
                reject(error)
            }
        })
    }

    send(message: WebSocketMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        } else {
            console.error('WebSocket 未連接')
        }
    }

    sendMessage(content: string, useRag = true, temperature = 0.7): void {
        this.send({
            type: 'message',
            content,
            useRag,
            temperature,
        })
    }

    stop(): void {
        this.send({ type: 'stop' })
    }

    ping(): void {
        this.send({ type: 'ping' })
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
    }

    // 事件處理器
    onMessage(handler: MessageHandler): void {
        this.messageHandlers.push(handler)
    }

    onOpen(handler: ConnectionHandler): void {
        this.openHandlers.push(handler)
    }

    onClose(handler: ConnectionHandler): void {
        this.closeHandlers.push(handler)
    }

    onError(handler: ErrorHandler): void {
        this.errorHandlers.push(handler)
    }

    // 移除處理器
    removeMessageHandler(handler: MessageHandler): void {
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }
}

// 建立 WebSocket 連接的工廠函數
export function createChatWebSocket(conversationId: string): ChatWebSocket {
    return new ChatWebSocket(conversationId)
}
