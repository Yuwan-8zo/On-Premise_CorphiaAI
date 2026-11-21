/**
 * 斷線時先存起來、恢復連線後自動送出的提問（一次最多一則：斷線時使用者通常只會再按一次送出）
 *   useChatLogic 送出時發現斷線 → put(text)；恢復連線 → take() 拿出來送
 *   ConnectionBanner 讀 text 顯示「恢復後會自動送出」
 */
import { create } from 'zustand'

interface OutboxState {
    text: string | null
    put: (text: string) => void
    take: () => string | null
    clear: () => void
}

export const useOutboxStore = create<OutboxState>((set, get) => ({
    text: null,
    put: (text) => set({ text }),
    take: () => {
        const text = get().text
        set({ text: null })
        return text
    },
    clear: () => set({ text: null }),
}))
