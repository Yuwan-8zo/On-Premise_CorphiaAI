/**
 * UI Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'
type Language = 'zh-TW' | 'en-US' | 'ja-JP'

<<<<<<< HEAD
export interface Toast {
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
}

=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
interface UIState {
    // 狀態
    theme: Theme
    language: Language
    sidebarOpen: boolean
    sidebarWidth: number
<<<<<<< HEAD
    toasts: Toast[]
=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)

    // 動作
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    setLanguage: (language: Language) => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    setSidebarWidth: (width: number) => void
<<<<<<< HEAD
    showToast: (type: Toast['type'], message: string) => void
    hideToast: (id: string) => void
=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // 初始狀態
            theme: 'light',
            language: 'zh-TW',
            sidebarOpen: true,
            sidebarWidth: 280,
<<<<<<< HEAD
            toasts: [],
=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)

            // 設定主題
            setTheme: (theme) => set({ theme }),

            // 切換主題
            toggleTheme: () =>
                set((state) => ({
                    theme: state.theme === 'light' ? 'dark' : 'light',
                })),

            // 設定語言
            setLanguage: (language) => set({ language }),

            // 設定側邊欄開關
            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            // 切換側邊欄
            toggleSidebar: () =>
                set((state) => ({
                    sidebarOpen: !state.sidebarOpen,
                })),

            // 設定側邊欄寬度
            setSidebarWidth: (width) => set({ sidebarWidth: width }),
<<<<<<< HEAD

            // Toast 操作
            showToast: (type, message) => {
                const id = Math.random().toString(36).substring(2, 9)
                set((state) => ({ toasts: [...state.toasts, { id, type, message }] }))
                setTimeout(() => {
                    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
                }, 3000)
            },
            hideToast: (id) =>
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
=======
>>>>>>> 1432944 (feat(init): 建立 Corphia AI Platform v2.2 基礎架構)
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                theme: state.theme,
                language: state.language,
                sidebarWidth: state.sidebarWidth,
            }),
        }
    )
)
