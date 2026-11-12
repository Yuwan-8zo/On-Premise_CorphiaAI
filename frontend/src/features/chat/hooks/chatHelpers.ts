/**
 * 聊天頁共用的小工具（不含 React 狀態，各個 hook 都可以直接用）
 */
import { documentsApi, type DocumentResponse } from '@/api/documents'
import { useChatStore } from '@/store/chatStore'
import type { Message } from '@/types/chat'
import i18n from '@/i18n'

/** 沒指定名稱時的預設資料夾名稱 */
export const DEFAULT_FOLDER = '新資料夾'

/** 一次載入的訊息則數（後端分頁大小）；拿到滿頁代表可能還有更早的 */
export const MESSAGE_PAGE_SIZE = 50

/** 對話所屬的資料夾名稱（沒有就用預設名稱） */
export function folderOf(settings?: Record<string, unknown> | null): string {
    return (settings?.folderName as string) || DEFAULT_FOLDER
}

/** 建立一則暫時訊息（送出前先顯示在畫面上，等後端回來再換成正式的） */
export function tempMessage(role: Message['role'], content = '', extra: Partial<Message> = {}, offset = 0): Message {
    return {
        id: `temp-${Date.now() + offset}`,
        role,
        content,
        tokens: 0,
        createdAt: new Date().toISOString(),
        ...extra,
    }
}

/** 模擬打字：把一段固定文字分段接到最後一則訊息後面（每 3 個字、間隔 delay 毫秒） */
export async function typeOut(text: string, append: (chunk: string) => void, delay = 30) {
    for (let i = 0; i < text.length; i += 3) {
        append(text.slice(i, i + 3))
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
}

/** 專案資料夾還沒有文件時，AI 回覆的提示文字 */
export function noDocsText(folderName: string) {
    return i18n.t('ui.chat.noDocs', { folder: folderName })
}

/** 讀取某個資料夾的文件；activeOnly＝只要有啟用（會被 AI 參考）的 */
export async function listFolderDocs(folderName: string, activeOnly = false): Promise<DocumentResponse[]> {
    const res = await documentsApi.list({ folder: folderName })
    return res.data.filter(
        (d) => d.doc_metadata?.folderName === folderName && (!activeOnly || (d.doc_metadata?.isActive ?? true)),
    )
}

/** 用後端回來的正式訊息取代最後一則（暫時的 AI 回覆） */
export function replaceLastMessage(message: Message) {
    useChatStore.setState((state) => {
        const next = [...state.messages]
        next[next.length - 1] = message
        return { messages: next }
    })
}

/** 拿掉最後一則（送出失敗時移除「AI 打字中」的暫時訊息） */
export function dropLastMessage() {
    useChatStore.setState((state) => ({ messages: state.messages.slice(0, -1) }))
}
