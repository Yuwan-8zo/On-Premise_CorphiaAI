/**
 * UI Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'
type Language = 'zh-TW' | 'en-US' | 'ja-JP'
export type AccentColorType = 'blue' | 'purple' | 'pink' | 'orange' | 'green'

interface ConfirmConfig {
    message: string
    onConfirm: () => void | Promise<void>
}

interface UIState {
    // 狀態
    theme: Theme
    language: Language
    accentColor: AccentColorType
    sidebarOpen: boolean
    sidebarWidth: number
    confirmConfig: ConfirmConfig | null
    /** C2: 是否開啟 RAG Debug 模式，打開後會在最後一則 AI 訊息下方顯示除錯面板 */
    ragDebugMode: boolean

    // 動作
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    setLanguage: (language: Language) => void
    setAccentColor: (color: AccentColorType) => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    setSidebarWidth: (width: number) => void
    showConfirm: (message: string, onConfirm: () => void | Promise<void>) => void
    closeConfirm: () => void
    isSettingsOpen: boolean
    setSettingsOpen: (open: boolean) => void
    setRAGDebugMode: (enabled: boolean) => void
    toggleRAGDebugMode: () => void
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            // 預設跟隨系統主題（深色/淺色模式）
            // 這樣 iOS Safari 的頂部與底部工具列顏色才能與 App 保持一致
            // 注意：當 App 主題與系統主題不同時，底部 Safari 工具列永遠跟隨系統（iOS 限制）
            theme: typeof window !== 'undefined'
                ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                : 'light',
            language: 'zh-TW',
            accentColor: 'blue',
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

            // 設定重點色
            setAccentColor: (color) => set({ accentColor: color }),

            // 設定側邊欄開關
            setSidebarOpen: (open) => set({ sidebarOpen: open }),

            // 切換側邊欄
            toggleSidebar: () =>
                set((state) => ({
                    sidebarOpen: !state.sidebarOpen,
                })),

            // 設定側邊欄寬度
            setSidebarWidth: (width) => set({ sidebarWidth: width }),

            // 確認彈窗
            confirmConfig: null,
            showConfirm: (message, onConfirm) => set({ confirmConfig: { message, onConfirm } }),
            closeConfirm: () => set({ confirmConfig: null }),

            // 設定彈窗
            isSettingsOpen: false,
            setSettingsOpen: (open) => set({ isSettingsOpen: open }),

            // C2: RAG Debug Mode（預設關閉，由使用者於設定中開啟）
            ragDebugMode: false,
            setRAGDebugMode: (enabled) => set({ ragDebugMode: enabled }),
            toggleRAGDebugMode: () => set((s) => ({ ragDebugMode: !s.ragDebugMode })),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                theme: state.theme,
                language: state.language,
                accentColor: state.accentColor,
                sidebarWidth: state.sidebarWidth,
                ragDebugMode: state.ragDebugMode,
            }),
        }
    )
)
