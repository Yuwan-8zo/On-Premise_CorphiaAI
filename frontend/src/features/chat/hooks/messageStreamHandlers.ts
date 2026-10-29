/**
 * WebSocket stream packet → chatStore dispatcher
 * ----------------------------------------------
 * The chat WebSocket emits a discriminated-union of packets per `StreamResponse.type`:
 *   - 'stream'             ↦ append delta to last message
 *   - 'done'               ↦ end streaming + reload messages so we get real UUIDs
 *   - 'error'              ↦ end streaming, log
 *   - 'sources'            ↦ attach RAG citations to last message + store debug payload
 *   - 'pii_warning'        ↦ surface PII redaction warning to UI
 *   - 'injection_warning'  ↦ surface prompt-injection detection
 *   - 'dlp_block'          ↦ message was blocked by DLP; end streaming + toast
 *
 * Extracted from useChatLogic so the dispatch table can live as a pure(-ish)
 * function — easier to read, easier to unit test, and useChatLogic stays
 * focused on lifecycle + state plumbing.
 */

import { conversationsApi } from '@/api/conversations'
import type { StreamResponse } from '@/api/websocket'
import { useChatStore } from '@/store/chatStore'
import { useToastStore } from '@/store/toastStore'

// Security notices stay on screen long enough to be read during a live demo.
const SECURITY_TOAST_MS = 6000

interface ToastApi {
    error: (message: string) => void
}

export interface StreamDispatchDeps {
    appendToLastMessage: (chunk: string) => void
    setStreaming: (streaming: boolean) => void
    setSourcesToLastMessage: (sources: any) => void
    toast: ToastApi
}

/**
 * Build a memoized handler for the chat WebSocket. Pass the store actions and
 * a toast helper at hook-time; the returned function can be wired straight
 * into `ws.onMessage(...)`.
 */
export function buildStreamDispatcher(deps: StreamDispatchDeps) {
    const { appendToLastMessage, setStreaming, setSourcesToLastMessage, toast } = deps

    return function handleStreamPacket(data: StreamResponse): void {
        switch (data.type) {
            case 'stream':
                if (data.content) appendToLastMessage(data.content)
                break

            case 'done': {
                setStreaming(false)
                // 重新載入訊息：streaming 期間 message id 是 temp-xxx，
                // 收到 done 後要重抓一次拿真實 UUID，這樣編輯/重新生成才能正確指到後端紀錄。
                const currentConvId = useChatStore.getState().currentConversation?.id
                if (currentConvId) {
                    conversationsApi
                        .getMessages(currentConvId)
                        .then((msgs) => useChatStore.getState().setMessages(msgs))
                        .catch((err) => console.error('同步訊息失敗:', err))
                }
                break
            }

            case 'error':
                console.error('WebSocket 錯誤:', data.message)
                setStreaming(false)
                break

            case 'sources':
                if (data.sources) setSourcesToLastMessage(data.sources as any)
                // C2: store RAG debug payload for the floating debug panel
                if (data.debug) useChatStore.getState().setRAGDebug(data.debug)
                break

            // A1: PII 遮罩警告 — 後端在送 prompt 給模型前已經把 PII 替換成 token
            case 'pii_warning':
                useChatStore.getState().addSecurityWarning({
                    type: 'pii',
                    message: data.message || '偵測到敏感資訊已自動遮罩',
                    data: { mask_map: data.mask_map || [] },
                    timestamp: Date.now(),
                })
                // 立刻把畫面上剛送出的使用者訊息換成遮罩版，觀眾不必等 AI 回答完才看到
                if (typeof data.masked_text === 'string') {
                    const masked = data.masked_text
                    const st = useChatStore.getState()
                    const msgs = [...st.messages]
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        if (msgs[i].role === 'user') {
                            msgs[i] = { ...msgs[i], content: masked }
                            break
                        }
                    }
                    st.setMessages(msgs)
                }
                useToastStore.getState().add('🔒 偵測到個人資料，已自動遮罩後才交給 AI', 'info', SECURITY_TOAST_MS)
                break

            // A2: Prompt Injection 偵測警告 — 後端 guard 偵測到可疑模式
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
                useToastStore.getState().add('⚠️ 偵測到提示詞注入攻擊，已寫入稽核日誌', 'error', SECURITY_TOAST_MS)
                break

            // A2: 高風險 Prompt Injection → 後端已攔阻，不會有 stream content
            case 'injection_block':
                setStreaming(false)
                appendToLastMessage(
                    `⛔ **已攔阻高風險提示詞注入攻擊**

${data.message || '請求未送入 AI 模型。'}

系統指令無法被覆蓋，此事件已寫入稽核日誌。`,
                )
                break

            // A3: DLP 黑名單命中 → 後端已攔阻，根本不會有 stream content 過來
            case 'dlp_block':
                setStreaming(false)
                // The backend never streams an answer for a blocked message, so fill the
                // empty assistant bubble with a visible notice instead of leaving it blank.
                appendToLastMessage(
                    `⛔ **此訊息已被 DLP 資料外洩防護政策攔阻**

${data.message || '訊息包含列管字詞。'}

此事件已寫入稽核日誌，內容沒有送進 AI 模型。`,
                )
                useChatStore.getState().addSecurityWarning({
                    type: 'dlp',
                    message: data.message || '訊息包含列管字詞，已依 DLP 策略攔阻送出。',
                    data: {
                        matched_terms_count: data.matched_terms_count || 0,
                    },
                    timestamp: Date.now(),
                })
                useToastStore.getState().add('⛔ 訊息含列管機密字詞，已依 DLP 政策攔阻', 'error', SECURITY_TOAST_MS)
                break
        }
    }
}
