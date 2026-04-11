/**
 * UI Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'
type Language = 'zh-TW' | 'en-US'

interface UIState {
    // 狀態
    theme: Theme
    language: Language
    sidebarOpen: boolean
    sidebarWidth: number

    // 動作
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    setLanguage: (language: Language) => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    setSidebarWidth: (width: number) => void
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // 初始狀態
            theme: 'light',
            language: 'zh-TW',
            // 手機版預設收起，桌機版預設展開
            sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
            sidebarWidth: 280,

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
