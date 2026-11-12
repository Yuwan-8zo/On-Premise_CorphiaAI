/**
 * 聊天串流封包 → chatStore（每個對話一個分派器）
 * ----------------------------------------------
 * 每條 WebSocket 綁定一個對話；收到的封包一律寫進「那個對話」自己的訊息，
 * 不管它現在在畫面上還是切到背景（多工：同時問好幾個對話，切走也會繼續生成）。
 *   - 'stream'             ↦ 把字接到該對話最後一則訊息（每 50 毫秒合併一次更新）
 *   - 'done'               ↦ 該對話結束生成；在畫面上就重新載入拿真正的訊息 id，在背景就跳通知
 *   - 'error'              ↦ 結束生成
 *   - 'sources'            ↦ 附上引用來源（＋除錯資訊，只在畫面上的對話）
 *   - 'pii_warning'        ↦ 個資遮罩提示，並把該對話剛送出的訊息換成遮罩版
 *   - 'injection_warning'  ↦ 注入攻擊提示
 *   - 'memory_saved' / 'memory_rejected' ↦ 使用者說「記住……」：已存成記憶／沒通過安全檢查
 *   - 'context_filtered'   ↦ 參考文件送模型前有片段被剔除或遮罩
 *   - 'output_filtered'    ↦ AI 的回答送出前被改過（外部圖片拿掉、個資遮罩）
 *   - 'file_progress' / 'attachments' ↦ 正在製作檔案（等待提示換成「正在製作…」）／做好了，掛到這則回答下面
 *   - 'injection_block' / 'dlp_block' ↦ 已攔阻；結束生成並在回覆泡泡裡說明
 */

import { conversationsApi } from '@/api/conversations'
import type { Message } from '@/types/chat'
import type { StreamResponse } from '@/api/websocket'
import { useChatStore } from '@/store/chatStore'
import { useToastStore } from '@/store/toastStore'
import i18n from '@/i18n'

// 資安提示要停久一點，現場展示時看得到
const SECURITY_TOAST_MS = 6000

/** 改最後一則 AI 回答的幾個欄位（沒有就原樣回傳） */
function patchLastAssistant(messages: Message[], patch: Partial<Message>): Message[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            const out = [...messages]
            out[i] = { ...out[i], ...patch }
            return out
        }
    }
    return messages
}

export function buildStreamDispatcher(conversationId: string) {
    const store = () => useChatStore.getState()
    const isCurrent = () => store().currentConversation?.id === conversationId

    // 每個字都更新一次畫面時，電腦一慢更新就會堆積而丟字、甚至卡死；先收集起來，每 50 毫秒更新一次
    let pending = ''
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
        if (flushTimer) {
            clearTimeout(flushTimer)
            flushTimer = null
        }
        if (!pending) return
        const text = pending
        pending = ''
        store().appendToThread(conversationId, text)
    }

    const finish = () => store().setStreamingFor(conversationId, false)

    return function handleStreamPacket(data: StreamResponse): void {
        if (data.type === 'stream') {
            if (data.content) {
                pending += data.content
                if (!flushTimer) flushTimer = setTimeout(flush, 50)
            }
            return
        }
        // 其他封包（完成、錯誤、來源…）之前，先把收集中的字補上，順序才不會亂
        flush()

        switch (data.type) {
            case 'done': {
                const wasCurrent = isCurrent()
                finish()
                if (wasCurrent) {
                    // 串流期間訊息 id 是暫時的；完成後重新載入，編輯／重新生成才指得到後端紀錄
                    conversationsApi
                        .getMessages(conversationId)
                        .then((msgs) => store().setServerMessages(conversationId, msgs))
                        .catch((err) => console.error('同步訊息失敗:', err))
                } else {
                    const title = store().conversations.find((c) => c.id === conversationId)?.title
                    useToastStore.getState().add(title ? i18n.t('ui.chat.backgroundDone', { title }) : i18n.t('ui.chat.backgroundDoneUntitled'), 'success')
                }
                break
            }

            case 'error':
                console.error('WebSocket 錯誤:', data.message)
                finish()
                break

            case 'sources':
                if (data.sources) store().setSourcesForThread(conversationId, data.sources)
                if (data.debug && isCurrent()) store().setRAGDebug(data.debug)
                break

            // 個資遮罩：後端在送給模型前已把個資換成代號
            case 'pii_warning':
                if (isCurrent()) {
                    store().addSecurityWarning({
                        type: 'pii',
                        message: i18n.t('ui.chat.piiMasked'),
                        data: { mask_map: data.mask_map || [] },
                        timestamp: Date.now(),
                    })
                }
                // 立刻把剛送出的使用者訊息換成遮罩版，不必等 AI 回答完
                if (typeof data.masked_text === 'string') {
                    const masked = data.masked_text
                    store().updateThread(conversationId, (messages) => {
                        const out = [...messages]
                        for (let i = out.length - 1; i >= 0; i--) {
                            if (out[i].role === 'user') {
                                out[i] = { ...out[i], content: masked }
                                break
                            }
                        }
                        return out
                    })
                }
                useToastStore.getState().add(i18n.t('ui.chat.piiToast'), 'info', SECURITY_TOAST_MS)
                break

            // 回答的檢查：畫面上的字已經是改過的，這裡只是告訴使用者發生了什麼
            case 'output_filtered': {
                const parts = [
                    data.images ? i18n.t('ui.chat.outputImages', { n: data.images }) : '',
                    data.pii ? i18n.t('ui.chat.contextPii', { n: data.pii }) : '',
                ].filter(Boolean)
                if (parts.length) {
                    const message = i18n.t('ui.chat.outputFiltered', { detail: parts.join(i18n.t('ui.chat.contextSep')) })
                    if (isCurrent()) {
                        store().addSecurityWarning({ type: data.images ? 'injection' : 'pii', message, data: { images: data.images || 0, pii: data.pii || 0 }, timestamp: Date.now() })
                    }
                    useToastStore.getState().add(message, data.images ? 'error' : 'info', SECURITY_TOAST_MS)
                }
                break
            }

            // 產出檔案：開始做 → 等待提示改成「正在製作 Word 文件…」；做好 → 檔案卡片掛到這則回答下面
            case 'file_progress':
                store().updateThread(conversationId, (messages) => patchLastAssistant(messages, { making: data.kind || 'file' }))
                break
            case 'attachments':
                store().updateThread(conversationId, (messages) => patchLastAssistant(messages, { making: undefined, attachments: data.attachments || [] }))
                break

            // 記憶：使用者說「記住……」
            case 'memory_saved':
                useToastStore.getState().add(
                    data.created === false ? i18n.t('ui.chat.memoryKnown') : i18n.t('ui.chat.memorySaved', { text: data.content || '' }),
                    'success',
                    SECURITY_TOAST_MS,
                )
                break
            case 'memory_rejected': {
                const key = data.reason === 'dlp' ? 'memoryRejectedDlp' : data.reason === 'limit' ? 'memoryRejectedLimit' : 'memoryRejectedInjection'
                useToastStore.getState().add(i18n.t(`ui.chat.${key}`), 'error', SECURITY_TOAST_MS)
                break
            }

            // 送模型前最後一關：參考文件有片段被剔除（藏指令、列管字詞）或個資被遮罩
            case 'context_filtered': {
                const parts = [
                    data.injection ? i18n.t('ui.chat.contextInjection', { n: data.injection }) : '',
                    data.dlp ? i18n.t('ui.chat.contextDlp', { n: data.dlp }) : '',
                    data.pii ? i18n.t('ui.chat.contextPii', { n: data.pii }) : '',
                ].filter(Boolean)
                if (parts.length) {
                    const message = i18n.t('ui.chat.contextFiltered', { detail: parts.join(i18n.t('ui.chat.contextSep')) })
                    if (isCurrent()) {
                        store().addSecurityWarning({
                            type: data.injection ? 'injection' : data.dlp ? 'dlp' : 'pii',
                            message,
                            data: { injection: data.injection || 0, dlp: data.dlp || 0, pii: data.pii || 0 },
                            timestamp: Date.now(),
                        })
                    }
                    useToastStore.getState().add(message, data.injection || data.dlp ? 'error' : 'info', SECURITY_TOAST_MS)
                }
                break
            }

            // 注入攻擊偵測警告
            case 'injection_warning':
                if (isCurrent()) {
                    store().addSecurityWarning({
                        type: 'injection',
                        message: i18n.t('ui.chat.injectionWarn'),
                        data: {
                            risk_level: data.risk_level || 'medium',
                            matched_patterns: data.matched_patterns || [],
                        },
                        timestamp: Date.now(),
                    })
                }
                useToastStore.getState().add(i18n.t('ui.chat.injectionToast'), 'error', SECURITY_TOAST_MS)
                break

            // 高風險注入攻擊 → 後端已攔阻，不會有回答
            case 'injection_block':
                finish()
                store().appendToThread(conversationId, i18n.t('ui.chat.injectionBlocked'))
                // 攔截訊息不會存進資料庫：先標記起來，之後重新載入對話時才補得回來
                if (isCurrent()) store().markLastExchangeBlocked()
                break

            // DLP 黑名單命中 → 後端已攔阻，不會有回答
            case 'dlp_block':
                finish()
                store().appendToThread(conversationId, i18n.t('ui.chat.dlpBlocked', { n: data.matched_terms_count || 1 }))
                if (isCurrent()) {
                    store().markLastExchangeBlocked()
                    store().addSecurityWarning({
                        type: 'dlp',
                        message: i18n.t('ui.chat.dlpWarn'),
                        data: { matched_terms_count: data.matched_terms_count || 0 },
                        timestamp: Date.now(),
                    })
                }
                useToastStore.getState().add(i18n.t('ui.chat.dlpToast'), 'error', SECURITY_TOAST_MS)
                break
        }
    }
}
