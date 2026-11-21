/**
 * 全域通知 Store（《Liquid Glass 元件規範》HTML 10 / JS：#toast）
 *   同一時間只有一則：新的通知直接取代舊的（重新計時）
 *   顯示 2 秒後開始消失；消失＝反向播放進場（淡出、往上 20px、縮到 0.96，0.23 秒），播完才移除
 *   type 只保留給呼叫端分類用，畫面上不分顏色、不放圖示
 */
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
    id: string
    message: string
    type: ToastType
    /** 正在消失（播放退場動畫中） */
    leaving?: boolean
    /** 通知上的按鈕（例如「復原」）；有按鈕時顯示 durationMs 才消失 */
    action?: { label: string; onClick: () => void }
    durationMs?: number
}

interface ToastState {
    toasts: Toast[]
    add: (message: string, type?: ToastType, duration?: number) => void
    remove: (id: string) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    /** 可以反悔的動作：通知上有「復原」按鈕，ms 之內按得到 */
    undoable: (message: string, label: string, onUndo: () => void, ms: number) => void
}

const SHOW_MS = 2000 // 規範：顯示 2 秒
const LEAVE_MS = 230 // 規範：退場 0.23 秒
let showTimer = 0
let leaveTimer = 0

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    // duration 參數保留相容，一律照規範顯示 2 秒
    add: (message, type = 'info') => {
        const id = `toast-${Date.now()}-${Math.random()}`
        window.clearTimeout(showTimer)
        window.clearTimeout(leaveTimer)
        set({ toasts: [{ id, message, type }] })
        showTimer = window.setTimeout(() => {
            set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
            leaveTimer = window.setTimeout(() => {
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
            }, LEAVE_MS)
        }, SHOW_MS)
    },

    remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

    success: (message) => useToastStore.getState().add(message, 'success'),
    error: (message) => useToastStore.getState().add(message, 'error'),
    info: (message) => useToastStore.getState().add(message, 'info'),
    undoable: (message, label, onUndo, ms) => {
        const id = `toast-${Date.now()}-${Math.random()}`
        window.clearTimeout(showTimer)
        window.clearTimeout(leaveTimer)
        const dismiss = () => set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }))
        set({ toasts: [{ id, message, type: 'info', durationMs: ms, action: { label, onClick: () => { onUndo(); dismiss() } } }] })
        showTimer = window.setTimeout(dismiss, ms)
    },
}))
