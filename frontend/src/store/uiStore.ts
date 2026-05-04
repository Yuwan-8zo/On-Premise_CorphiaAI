/**
 * UI Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { flushSync } from 'react-dom'

/**
 * 主題切換動畫 helper
 * ──────────────────────────────────────────────────────────────────
 * 使用 View Transition API（iOS Safari 18+ / Chrome 111+ / Firefox 不支援）
 * 在 DOM 變動前後拍 snapshot，自動做整頁 cross-fade，連 html background-image
 * 漸層也能順順過渡（CSS transition 對 background-image 是 step 切換，做不到）。
 *
 * flushSync 強制 React 同步處理 set()，確保 startViewTransition 的 callback
 * 結束時 DOM 已經是新狀態，否則新舊 snapshot 會抓到同一張畫面。
 *
 * 不支援的瀏覽器：直接執行 mutator，視覺上跟原本一樣（瞬間切換）。
 */
function withViewTransition(mutator: () => void) {
    // 新版 TS lib 已內建 Document.startViewTransition 型別，所以直接 cast 即可
    const doc = typeof document !== 'undefined'
        ? (document as Document & { startViewTransition?: (cb: () => void) => unknown })
        : undefined
    if (doc && typeof doc.startViewTransition === 'function') {
        doc.startViewTransition(() => {
            flushSync(mutator)
        })
    } else {
        mutator()
    }
}

type Theme = 'light' | 'dark'
/**
 * 使用者的「主題偏好」：
 * - 'system'  跟隨系統 prefers-color-scheme
 * - 'light'   強制淺色
 * - 'dark'    強制深色
 *
 * 實際渲染用的是 `theme`（已解析的 light/dark）。`theme` 由 App.tsx 根據
 * `themePreference` 與系統設定計算後寫入。
 */
type ThemePreference = 'system' | 'light' | 'dark'
type Language = 'zh-TW' | 'en-US' | 'ja-JP'
export type AccentColorType = string

interface ConfirmConfig {
    message: string
    onConfirm: () => void | Promise<void>
}

interface UIState {
    // 狀態
    theme: Theme
    /** 使用者選擇的主題偏好（持久化）。'system' 代表跟隨系統。 */
    themePreference: ThemePreference
    language: Language
    accentColor: AccentColorType
    sidebarOpen: boolean
    sidebarWidth: number
    confirmConfig: ConfirmConfig | null
    /** C2: 是否開啟 RAG Debug 模式，打開後會在最後一則 AI 訊息下方顯示除錯面板 */
    ragDebugMode: boolean
    /** Demo Mode：對外展示時隱藏絕對路徑、租戶 slug 等敏感字串 */
    demoMode: boolean

    // 動作
    setTheme: (theme: Theme) => void
    toggleTheme: () => void
    /** 設定主題偏好。傳入 'system' 後 theme 會跟隨系統 prefers-color-scheme。 */
    setThemePreference: (pref: ThemePreference) => void
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
    setDemoMode: (enabled: boolean) => void
    toggleDemoMode: () => void
    /**
     * Replay token 給 OnboardingTour 用。+1 一次表示「使用者按了重看引導」，
     * ChatPage 訂閱這個值，變動時 setShowOnboarding(true) 重新打開 modal。
     * 不持久化，重整就重置（首次進入由 localStorage 旗標控制，replay token 只是 in-session signal）。
     */
    onboardingReplayToken: number
    triggerOnboardingReplay: () => void
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
            // 預設「跟隨系統」，這樣 iOS Safari 工具列才會與系統一致
            themePreference: 'system',
            language: 'zh-TW',
            accentColor: 'default',
            // 手機版預設收起，桌機版預設展開
            sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
            sidebarWidth: 280,

            // 設定主題（系統 prefers-color-scheme 自動同步用，不需動畫；
            // 使用者主動切換走 toggleTheme / setThemePreference，那兩個有 view transition）
            setTheme: (theme) => set({ theme }),

            // 切換主題（同時把使用者偏好鎖定到目標主題，跳出 system 模式）
            // 包在 View Transition 裡：整頁 cross-fade 0.4s，包含 html 漸層、文字、邊框
            toggleTheme: () =>
                withViewTransition(() => {
                    set((state) => {
                        const next: Theme = state.theme === 'light' ? 'dark' : 'light'
                        return { theme: next, themePreference: next }
                    })
                }),

            // 設定主題偏好；'system' 會立刻把 theme 對齊現在的系統偏好
            // 同樣包在 View Transition 裡（從 system → light/dark 也會 cross-fade）
            setThemePreference: (pref) =>
                withViewTransition(() => {
                    set(() => {
                        if (pref === 'system') {
                            const sysDark =
                                typeof window !== 'undefined' &&
                                window.matchMedia('(prefers-color-scheme: dark)').matches
                            return { themePreference: pref, theme: sysDark ? 'dark' : 'light' }
                        }
                        return { themePreference: pref, theme: pref }
                    })
                }),

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

            // Demo Mode：對外展示時隱藏絕對路徑等敏感字串
            demoMode: false,
            setDemoMode: (enabled) => set({ demoMode: enabled }),
            toggleDemoMode: () => set((s) => ({ demoMode: !s.demoMode })),

            // Onboarding replay 觸發器（不持久化）
            onboardingReplayToken: 0,
            triggerOnboardingReplay: () =>
                set((s) => ({ onboardingReplayToken: s.onboardingReplayToken + 1 })),
        }),
        {
            name: 'ui-storage',
            partialize: (state) => ({
                theme: state.theme,
                themePreference: state.themePreference,
                language: state.language,
                accentColor: state.accentColor,
                sidebarWidth: state.sidebarWidth,
                ragDebugMode: state.ragDebugMode,
                demoMode: state.demoMode,
            }),
        }
    )
)
