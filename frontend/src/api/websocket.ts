/**
 * WebSocket 客戶端
 */

import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import type { MessageSource, MessageAttachment } from '@/types/chat'
import i18n from '@/i18n'

export interface WebSocketMessage {
    type: 'message' | 'ping' | 'stop' | 'resubmit'
    content?: string
    message_id?: string
    // NOTE: 後端 FastAPI 使用 snake_case 解析，必須與後端 websocket.py 的 data.get() 欄位一致
    use_rag?: boolean
    /** 這一題要不要連對外搜尋（需要後端開啟 enable_web_search 功能） */
    web_search?: boolean
    temperature?: number
    max_tokens?: number
    /** 使用者介面語言，例如 'zh-TW' | 'en-US' | 'ja-JP' */
    language?: string
}

export interface StreamResponse {
    type: 'stream' | 'reasoning' | 'done' | 'error' | 'sources' | 'pong' | 'pii_warning' | 'injection_warning' | 'injection_block' | 'dlp_block'
        | 'memory_saved' | 'memory_rejected' | 'context_filtered' | 'file_progress' | 'attachments' | 'output_filtered'
        | 'web_search_used' | 'web_search_blocked' | 'tool_step'
    /** AI 自己動手做事（tool_step）：tool＝哪個工具；status＝running 開始做／done 做完（帶 summary、ok） */
    tool?: string
    status?: 'running' | 'done'
    summary?: string
    ok?: boolean
    /** 回答的檢查（output_filtered）：拿掉幾張外部圖片（pii 沿用下面的欄位） */
    images?: number
    /** 產出檔案：file_progress 的 kind＝正在做哪一種（docx／xlsx／pptx）；attachments＝做好的檔案 */
    kind?: string
    attachments?: MessageAttachment[]
    /** 記憶：memory_saved 的 created＝false 表示這件事早就記過了；memory_rejected 的 reason＝dlp／injection／limit */
    created?: boolean
    reason?: string
    /** 送模型前最後一關（context_filtered）：被剔除的片段數（藏指令、列管字詞）、被遮罩的個資數 */
    injection?: number
    dlp?: number
    pii?: number
    content?: string
    messageId?: string
    /** 引用來源（欄位名稱跟後端一致：chunk_id、document_id…） */
    sources?: MessageSource[]
    message?: string
    /** 錯誤代碼 (例如 GENERATION_TIMEOUT / INTERNAL_ERROR) */
    code?: string
    /** 內部錯誤追蹤 ID（由後端 global_exception_handler 產生） */
    error_id?: string
    /** A1: 遮罩後的整句使用者訊息（不含原值） */
    masked_text?: string
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
    /** A3: DLP 命中計數（不回傳原始字詞） */
    matched_terms_count?: number
    /** C2: RAG 除錯資訊 */
    debug?: {
        route: string
        context_length: number
        prompt_length: number
        chunks_count: number
    }
    /** 對外搜尋（web_search_used／web_search_blocked）：搜尋關鍵字、取回的來源、被擋的原因 */
    query?: string
    results?: Array<{ title: string; url: string }>
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
    /**
     * 是否為「使用者主動斷線」。
     * disconnect() 會把這個旗標設成 true，避免 onclose 又觸發 background 重連，
     * 否則切換對話時會出現「主動斷 → 自動重連 → 又斷」的死循環。
     */
    private intentionallyClosed = false

    private messageHandlers: MessageHandler[] = []
    private openHandlers: ConnectionHandler[] = []
    private closeHandlers: ConnectionHandler[] = []
    private errorHandlers: ErrorHandler[] = []

    constructor(conversationId: string) {
        this.conversationId = conversationId
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 進入新的 connect 前重置「主動關閉」旗標
            this.intentionallyClosed = false

            const token = useAuthStore.getState().accessToken
            if (!token) {
                reject(new Error('NOT_AUTHENTICATED'))
                return
            }

            // 確定 WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            const url = `${protocol}//${host}/ws/chat/${this.conversationId}?token=${token}`

            this.ws = new WebSocket(url)

            this.ws.onopen = () => {
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

                // 回答到一半連線斷了（系統被關閉、電腦睡眠…）：在泡泡裡說明，不要留一個空白泡泡像卡住
                const st = useChatStore.getState()
                if (
                    st.isStreaming &&
                    !this.intentionallyClosed &&
                    st.currentConversation?.id === this.conversationId
                ) {
                    const last = st.messages[st.messages.length - 1]
                    if (last?.role === 'assistant') {
                        st.appendToLastMessage(
                            (last.content ? '\n\n' : '') +
                            i18n.t('ui.chat.connectionLost'),
                        )
                    }
                }

                // 強制重置 Streaming 狀態，避免 UI 卡死
                st.setStreaming(false)

                this.closeHandlers.forEach((handler) => handler())

                // 主動關閉（disconnect()）→ 不重連；
                // 只有意外斷線（網路波動 / 後端重啟）才嘗試重連。
                if (this.intentionallyClosed) return

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++
                    setTimeout(() => {
                        // 重連時若已被新的 connect() 接管，就跳過
                        if (this.intentionallyClosed) return
                        this.connect().catch(e => console.error('背景重連失敗:', e))
                    }, this.reconnectDelay * this.reconnectAttempts)
                }
            }

            this.ws.onerror = (error) => {
                console.error('WebSocket 錯誤:', error)
                // 生成中狀態交給 onclose 重設（錯誤之後一定會觸發 onclose），才能在泡泡裡顯示斷線說明
                
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

    sendMessage(content: string, useRag = true, temperature = 0.7, language = 'zh-TW', maxTokens = 2048, webSearch = false): void {
        this.send({
            type: 'message',
            content,
            use_rag: useRag,
            web_search: webSearch,
            temperature,
            max_tokens: maxTokens,
            language,
        })
    }

    sendResubmit(messageId: string, content: string, useRag: boolean = true, temperature: number = 0.7, language: string = 'zh-TW', maxTokens: number = 2048, webSearch = false) {
        this.send({
            type: 'resubmit',
            message_id: messageId,
            content,
            use_rag: useRag,
            web_search: webSearch,
            temperature,
            max_tokens: maxTokens,
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
        // 標記為「主動關閉」，讓 onclose 知道不要再嘗試重連
        this.intentionallyClosed = true
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
