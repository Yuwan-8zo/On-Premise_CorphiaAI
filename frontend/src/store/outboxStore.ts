/**
 * 斷線時先存起來、恢復連線後自動送出的提問（一次最多一則：斷線時使用者通常只會再按一次送出）
 *   useChatLogic 送出時發現斷線 → put({ 文字, 對話, 模式 })；恢復連線（或回到聊天頁時已經連上）→ take() 拿出來
 *   要送去的對話和模式一起記：恢復時使用者已經換到別的對話，就不能送進現在這一個（改放回輸入框）
 *   ConnectionBanner 讀 entry 顯示「恢復後會自動送出」
 */
import { create } from 'zustand'

export interface QueuedMessage {
    text: string
    /** 送出時在哪一個對話（還沒建立的新對話是 null） */
    conversationId: string | null
    mode: 'general' | 'project'
}

interface OutboxState {
    entry: QueuedMessage | null
    put: (entry: QueuedMessage) => void
    take: () => QueuedMessage | null
    clear: () => void
}

export const useOutboxStore = create<OutboxState>((set, get) => ({
    entry: null,
    put: (entry) => set({ entry }),
    take: () => {
        const entry = get().entry
        set({ entry: null })
        return entry
    },
    clear: () => set({ entry: null }),
}))
