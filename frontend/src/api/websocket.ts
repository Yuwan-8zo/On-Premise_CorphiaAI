/**
 * WebSocket 客戶端
 */

import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

export interface WebSocketMessage {
    type: 'message' | 'ping' | 'stop' | 'resubmit'
    content?: string
    message_id?: string
    useRag?: boolean
    temperature?: number
    maxTokens?: number
    /** 使用者介面語言，例如 'zh-TW' | 'en-US' | 'ja-JP' */
    language?: string
}

export interface StreamResponse {
    type: 'stream' | 'done' | 'error' | 'sources' | 'pong' | 'pii_warning' | 'injection_warning'
    content?: string
    messageId?: string
    sources?: Array<{
        chunkId: string
        content: string
        score: number
        distance?: number
        document_id?: string
        document_name?: string
        metadata: Record<string, unknown>
    }>
    message?: string
    /** A1: PII 遮罩對照表 */
    mask_map?: Array<{
        original_preview: string
        masked: string
        type: string
        label: string
    }>
    /** A2: Prompt Injection 風險等級 */
    risk_level?: string
    matched_patterns?: string[]
    /** C2: RAG 除錯資訊 */
    debug?: {
        route: string
        context_length: number
        prompt_length: number
        chunks_count: number
    }
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
                
                // 強制重置 Streaming 狀態，避免 UI 卡死
                useChatStore.getState().setStreaming(false)
                
                this.closeHandlers.forEach((handler) => handler())

                // 嘗試重連
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++
                    setTimeout(() => {
                        this.connect().catch(e => console.error('背景重連失敗:', e))
                    }, this.reconnectDelay * this.reconnectAttempts)
                }
            }

            this.ws.onerror = (error) => {
                console.error('WebSocket 錯誤:', error)
                // 強制重置 Streaming 狀態，避免 UI 卡死
                useChatStore.getState().setStreaming(false)
                
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

    sendMessage(content: string, useRag = true, temperature = 0.7, language = 'zh-TW'): void {
        this.send({
            type: 'message',
            content,
            useRag,
            temperature,
            language,
        })
    }

    sendResubmit(messageId: string, content: string, useRag: boolean = true, temperature: number = 0.7, language: string = 'zh-TW') {
        this.send({
            type: 'resubmit',
            message_id: messageId,
            content,
            useRag,
            temperature,
            language,
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
