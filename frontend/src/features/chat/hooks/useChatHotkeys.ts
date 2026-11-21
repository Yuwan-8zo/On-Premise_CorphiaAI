/**
 * 聊天頁的鍵盤快捷鍵（react-hotkeys-hook，MIT）
 *
 *   Ctrl／⌘ + K          搜尋對話（打開側欄並把游標放進搜尋框）
 *   Ctrl／⌘ + Shift + O  開新對話
 *   Ctrl／⌘ + B          開關側欄
 *   Esc                   AI 正在回答時：停止
 *   ↑（輸入框是空的）     叫回上一則提問，可以改完再送
 *
 * 有修飾鍵的組合在輸入框裡也有效（使用者很可能正在打字）；單鍵的只在不會誤觸時才作用。
 * 清單同時給「使用說明」顯示（CHAT_HOTKEYS），兩邊不會對不起來。
 */
import { useHotkeys } from 'react-hotkeys-hook'

/** 側欄搜尋框聽這個事件：快捷鍵要它打開並取得焦點 */
export const OPEN_SEARCH_EVENT = 'corphia:open-search'

export const CHAT_HOTKEYS = [
    { id: 'search', keys: ['mod', 'K'] },
    { id: 'newChat', keys: ['mod', 'Shift', 'O'] },
    { id: 'sidebar', keys: ['mod', 'B'] },
    { id: 'stop', keys: ['Esc'] },
    { id: 'recall', keys: ['↑'] },
] as const

interface Options {
    isStreaming: boolean
    input: string
    setInput: (v: string) => void
    inputRef: React.RefObject<HTMLTextAreaElement | null>
    lastUserText: () => string | undefined
    handleStop: () => void
    createNewConversation: () => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
}

export function useChatHotkeys(o: Options) {
    const opts = { enableOnFormTags: true, preventDefault: true } as const

    useHotkeys('mod+k', () => {
        o.setSidebarOpen(true)
        // 側欄打開的動畫跑完、搜尋框掛上之後再通知
        requestAnimationFrame(() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT)))
    }, opts)
    useHotkeys('mod+shift+o', () => o.createNewConversation(), opts)
    useHotkeys('mod+b', () => o.toggleSidebar(), opts)

    // Esc 只在 AI 正在回答時攔下來（其他時候留給對話框、選單自己關閉）
    useHotkeys('escape', () => o.handleStop(), { enableOnFormTags: true, enabled: o.isStreaming, preventDefault: true }, [o.isStreaming])

    // ↑：輸入框是空的才叫回上一則（有字時照常移動游標）
    useHotkeys('up', (e) => {
        if (document.activeElement !== o.inputRef.current || o.input) return
        const last = o.lastUserText()
        if (!last) return
        e.preventDefault()
        o.setInput(last)
        requestAnimationFrame(() => {
            const el = o.inputRef.current
            if (el) el.setSelectionRange(el.value.length, el.value.length)
        })
    }, { enableOnFormTags: ['textarea'] }, [o.input])
}
