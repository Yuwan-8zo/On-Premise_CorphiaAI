/**
 * Mock WebSocket — Demo 版打字機串流
 *
 * 完全實作真實 ChatWebSocket 的同一個介面，
 * 但改用 setTimeout 模擬串流，不建立真實 WebSocket 連線。
 *
 * 速度：Qwen2.5-7B CPU 9.62 tok/s × 3x demo 加速 ≈ 28 tok/s
 *       每 chunk 3 字元 ≈ 2 tokens → 間距 70ms
 */

import { useChatStore } from '@/store/chatStore'
import type { StreamResponse } from './websocket.types'
import {
    DEMO_QA_ANSWER,
    DEMO_PII_ANSWER,
    DEMO_DLP_BLOCKED_ANSWER,
    DEMO_INJECTION_ANSWER,
    DEMO_RAG_IN_DOC_ANSWER,
    DEMO_RAG_NOT_FOUND_ANSWER,
    DEMO_SOURCES,
    DEMO_PII_MASK_MAP,
    DEMO_INJECTION_PATTERNS,
    DEMO_TRIGGERS,
    DEMO_AUDIT_LOGS,
    DEMO_USERS,
} from '../demo/mockData'
import { saveConversationMessages } from './conversations'

export type { StreamResponse }
export type { WebSocketMessage } from './websocket.types'

// ── 場景偵測 ──────────────────────────────────────────────────────

function detectScenario(input: string): 'pii' | 'dlp' | 'injection' | 'rag_in_doc' | 'rag_not_found' | 'qa' {
    const lower = input.toLowerCase()
    if (DEMO_TRIGGERS.injection.some((kw) => lower.includes(kw))) return 'injection'
    if (DEMO_TRIGGERS.dlp.some((kw) => lower.includes(kw))) return 'dlp'
    if (DEMO_TRIGGERS.pii.some((kw) => lower.includes(kw))) return 'pii'
    if (DEMO_TRIGGERS.rag_in_doc.some((kw) => lower.includes(kw))) return 'rag_in_doc'
    if (DEMO_TRIGGERS.rag_not_found.some((kw) => lower.includes(kw))) return 'rag_not_found'
    return 'qa'
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ── Mock WebSocket 類別 ───────────────────────────────────────────

type MessageHandler = (data: StreamResponse) => void
type ConnectionHandler = () => void
type ErrorHandler = (error: Event) => void

export class ChatWebSocket {
    private _isConnected = false
    private _stopped = false
    private messageHandlers: MessageHandler[] = []
    private closeHandlers: ConnectionHandler[] = []

    constructor(private conversationId: string) {}

    connect(): Promise<void> {
        this._isConnected = true
        this._stopped = false
        return Promise.resolve()
    }

    get isConnected(): boolean {
        return this._isConnected
    }

    onMessage(handler: MessageHandler): void {
        this.messageHandlers.push(handler)
    }

    onOpen(_handler: ConnectionHandler): void {}
    onClose(handler: ConnectionHandler): void {
        this.closeHandlers.push(handler)
    }
    onError(_handler: ErrorHandler): void {}
    removeMessageHandler(handler: MessageHandler): void {
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
    }

    stop(): void {
        this._stopped = true
    }

    disconnect(): void {
        this._isConnected = false
        this._stopped = true
        this.closeHandlers.forEach((h) => h())
    }

    send(_msg: unknown): void {}

    /** 處理普通訊息 */
    sendMessage(content: string, _useRag = true, _temperature = 0.7, _language = 'zh-TW'): void {
        this._runStream(content)
    }

    /** 處理重新生成 */
    sendResubmit(_messageId: string, content: string, _useRag = true): void {
        this._runStream(content)
    }

    ping(): void {}

    /** 模擬打字機串流 */
    private async _runStream(userInput: string): Promise<void> {
        this._stopped = false
        const scenario = detectScenario(userInput)

        // 首字等待（模擬 LLM 思考 + 首 token 延遲）
        await sleep(1200)
        if (this._stopped) return

        // ── 觸發資安事件（在 stream 前推送）+ 寫入稽核日誌 ──────
        const adminUser = DEMO_USERS[0]
        const now = new Date().toISOString()

        if (scenario === 'injection') {
            this._emit({
                type: 'injection_warning',
                risk_level: 'high',
                matched_patterns: DEMO_INJECTION_PATTERNS,
                message: '⚠️ 偵測到提示詞注入攻擊（HIGH），危險標記已清除，事件已記錄',
            })
            DEMO_AUDIT_LOGS.unshift({
                id: `log-inj-${Date.now()}`,
                event_type: 'INJECTION_DETECTED',
                action: 'injection_detected',
                user_email: adminUser.email,
                user_id: adminUser.id,
                description: `偵測到 Prompt Injection 攻擊，已清除危險標記並阻擋請求`,
                risk_level: 'HIGH',
                ip_address: '192.168.1.50',
                created_at: now,
                metadata: { matched_patterns: DEMO_INJECTION_PATTERNS, conversation_id: this.conversationId },
            })
            await sleep(300)
        } else if (scenario === 'dlp') {
            this._emit({
                type: 'dlp_block',
                message: '⛔ DLP 政策攔截：偵測到機密關鍵字（薪資 / 合約），請求已阻擋',
                matched_terms_count: 2,
            })
            DEMO_AUDIT_LOGS.unshift({
                id: `log-dlp-${Date.now()}`,
                event_type: 'DLP_BLOCKED',
                action: 'dlp_blocked',
                user_email: adminUser.email,
                user_id: adminUser.id,
                description: `DLP 政策觸發：偵測到機密關鍵字（薪資、合約），請求已阻擋`,
                risk_level: 'HIGH',
                ip_address: '192.168.1.50',
                created_at: now,
                metadata: { matched_keywords: ['薪資', '合約'], rule: 'CONFIDENTIAL_HR_DATA', conversation_id: this.conversationId },
            })
            await sleep(300)
        } else if (scenario === 'pii') {
            this._emit({
                type: 'pii_warning',
                mask_map: DEMO_PII_MASK_MAP,
                message: '🔒 已偵測並遮罩 1 筆個資（身分證號），原始資料不會進入模型',
            })
            DEMO_AUDIT_LOGS.unshift({
                id: `log-pii-${Date.now()}`,
                event_type: 'PII_MASKED',
                action: 'pii_masked',
                user_email: adminUser.email,
                user_id: adminUser.id,
                description: `偵測到 1 筆個人資料（身分證號），已自動遮罩，原始值未進入模型`,
                risk_level: 'MEDIUM',
                ip_address: '192.168.1.50',
                created_at: now,
                metadata: { pii_types: ['ID_CARD'], masked_count: 1, conversation_id: this.conversationId },
            })
            await sleep(300)
        }

        if (this._stopped) return

        // ── 選擇回覆文字 ─────────────────────────────────────────
        const fullText =
            scenario === 'injection'    ? DEMO_INJECTION_ANSWER :
            scenario === 'dlp'          ? DEMO_DLP_BLOCKED_ANSWER :
            scenario === 'pii'          ? DEMO_PII_ANSWER :
            scenario === 'rag_in_doc'   ? DEMO_RAG_IN_DOC_ANSWER :
            scenario === 'rag_not_found'? DEMO_RAG_NOT_FOUND_ANSWER :
            DEMO_QA_ANSWER

        // ── 打字機串流（每 6 字元一次，間距 40ms ≈ 快速串流展示節奏）──────
        const CHUNK = 6
        const INTERVAL = 40
        for (let i = 0; i < fullText.length; i += CHUNK) {
            if (this._stopped) return
            this._emit({ type: 'stream', content: fullText.slice(i, i + CHUNK) })
            await sleep(INTERVAL)
        }

        if (this._stopped) return

        // ── RAG 來源引用（僅 rag_in_doc 場景，上傳文件後才有）────────────
        if (scenario === 'rag_in_doc') {
            this._emit({
                type: 'sources',
                sources: DEMO_SOURCES.map((s) => ({
                    chunkId: s.chunk_id,
                    content: s.content,
                    score: s.score,
                    document_id: s.document_id,
                    document_name: s.document_name,
                    metadata: {},
                })),
            })
        }

        // ── 結束 ────────────────────────────────────────────────
        this._emit({ type: 'done', messageId: `demo-msg-${Date.now()}` })
        useChatStore.getState().setStreaming(false)
        // 儲存訊息快照，讓切換對話後還能還原
        await sleep(100)
        saveConversationMessages(this.conversationId, useChatStore.getState().messages)
    }

    private _emit(data: StreamResponse): void {
        this.messageHandlers.forEach((h) => h(data))
    }
}

export function createChatWebSocket(conversationId: string): ChatWebSocket {
    return new ChatWebSocket(conversationId)
}
