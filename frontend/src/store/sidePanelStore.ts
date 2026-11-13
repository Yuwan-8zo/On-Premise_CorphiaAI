/**
 * 旁邊的顯示面板（聊天畫面右側）：放得下整頁的成品
 *
 * 兩種內容共用同一個面板：
 *   - page：AI 寫的 HTML／SVG（關在沙盒裡預覽，見 lib/previewDoc）
 *   - run ：執行 Python 的結果（文字、圖表，見 lib/pyRunner）
 * 對話裡每一個可以顯示的區塊自己來登記（useSidePanelItem）；面板只記「現在看哪一個」。
 * 同一種內容照它們在對話裡的先後排成版本：AI 改了一版，面板開著時會自動換成最新的，也可以切回舊的。
 */
import { create } from 'zustand'
import type { PyRunResult } from '@/lib/pyRunner'

export type SidePanelContent =
    | { kind: 'page'; code: string; language: string }
    | { kind: 'run'; result: PyRunResult }

export type SidePanelItem = SidePanelContent & {
    id: string
    /** 這個區塊在對話裡的位置（用來排先後） */
    el: Element | null
}

interface SidePanelState {
    items: Record<string, SidePanelItem>
    currentId: string | null
    open: boolean
    register: (id: string, content: SidePanelContent, el: Element | null) => void
    unregister: (id: string) => void
    show: (id: string) => void
    close: () => void
}

/** 同一種內容，照在對話裡出現的先後排（沒有位置的排在登記的順序） */
export function orderedItems(items: Record<string, SidePanelItem>, kind: SidePanelContent['kind']): SidePanelItem[] {
    return Object.values(items)
        .filter((item) => item.kind === kind)
        .sort((a, b) => {
            if (!a.el || !b.el || a.el === b.el) return 0
            return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        })
}

const lastOf = <T,>(list: T[]): T | undefined => list[list.length - 1]

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
    items: {},
    currentId: null,
    open: false,

    register: (id, content, el) => {
        const { items, open, currentId } = get()
        const isNew = !(id in items)
        const next = { ...items, [id]: { ...content, id, el } as SidePanelItem }
        // 面板開著、來了一個新的而且排在最後（＝AI 剛寫出的新版本）：自動換過去。
        // 往上捲載入的舊訊息不是排在最後，不會搶走現在看的
        const current = currentId ? items[currentId] : undefined
        const sameKind = !current || current.kind === content.kind
        const follow = open && isNew && sameKind && lastOf(orderedItems(next, content.kind))?.id === id
        set({ items: next, ...(follow ? { currentId: id } : {}) })
    },

    unregister: (id) => {
        const { items } = get()
        if (!(id in items)) return
        const removed = items[id]
        const next = { ...items }
        delete next[id]
        set({ items: next })
        // 正在看的那個不見了（換對話、訊息被刪）：等這一輪畫面更新完再決定——
        // 區塊只是重新掛上去的話，新的會在同一輪登記回來，不能先把面板關掉
        queueMicrotask(() => {
            const state = get()
            if (!state.open || state.currentId !== id || id in state.items) return
            const fallback = lastOf(orderedItems(state.items, removed.kind))
            set(fallback ? { currentId: fallback.id } : { currentId: null, open: false })
        })
    },

    show: (id) => {
        if (id in get().items) set({ currentId: id, open: true })
    },

    close: () => set({ open: false }),
}))
