/**
 * Toast 通知 Store
 */
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastState {
    toasts: Toast[]
    add: (message: string, type?: ToastType, duration?: number) => void
    remove: (id: string) => void
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    add: (message, type = 'info', duration = 3000) => {
        const id = `toast-${Date.now()}-${Math.random()}`
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
        }, duration)
    },

    remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

    success: (message) => useToastStore.getState().add(message, 'success'),
    error: (message) => useToastStore.getState().add(message, 'error'),
    info: (message) => useToastStore.getState().add(message, 'info'),
}))
