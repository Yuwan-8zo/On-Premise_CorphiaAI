/**
 * UI Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from 'i18next' // 同一個 i18n 實例（在 i18n/index.ts 初始化）；不經過 react-i18next，store 才不會依賴 React
import type { Language } from '@/i18n/languages'
import { isDesktop } from '@/lib/useMediaQuery'
import { withThemeReveal, type RevealOrigin } from '@/lib/themeReveal'

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
/** 只允許固定的品牌色（已移除自由配色） */
export type AccentColorType = 'blue' | 'purple' | 'pink' | 'orange' | 'green'
const ACCENT_KEYS: AccentColorType[] = ['blue', 'purple', 'pink', 'orange', 'green']

/** 確認框的外觀：danger＝刪除這類回不去的動作（紅色按鈕，沒給說明時預設「此動作無法復原」）；
 *  default＝可以重來的動作（切換模型、強制登出…）：一般按鈕、不顯示「無法復原」 */
export type ConfirmTone = 'danger' | 'default'

interface ConfirmConfig {
    message: string
    onConfirm: () => void | Promise<void>
    /** 標題下的補充說明：不給＝依 tone（danger 預設「此動作無法復原」，default 不顯示） */
    hint?: string
    tone?: ConfirmTone
    /** 確認鈕的文字（不給＝「確認」） */
    confirmLabel?: string
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
    /** 切換深淺色；給按鈕位置（revealFrom）新顏色會從那裡圓形擴散 */
    toggleTheme: (origin?: RevealOrigin) => void
    /** 設定主題偏好。傳入 'system' 後 theme 會跟隨系統 prefers-color-scheme。給按鈕位置同上 */
    setThemePreference: (pref: ThemePreference, origin?: RevealOrigin) => void
    setLanguage: (language: Language) => void
    setAccentColor: (color: AccentColorType) => void
    setSidebarOpen: (open: boolean) => void
    toggleSidebar: () => void
    setSidebarWidth: (width: number) => void
    showConfirm: (message: string, onConfirm: () => void | Promise<void>, hint?: string, opts?: { tone?: ConfirmTone; confirmLabel?: string }) => void
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
            accentColor: 'blue',
            // 側邊欄預設打開（手機版是蓋在畫面上的抽屜，預設收起）
            sidebarOpen: typeof window !== 'undefined' ? isDesktop() : true,
            sidebarWidth: 280,

            // 設定主題（系統 prefers-color-scheme 自動同步用，不需動畫；
            // 使用者主動切換走 toggleTheme / setThemePreference，那兩個有 view transition）
            setTheme: (theme) => set({ theme }),

            // 切換主題（同時把使用者偏好鎖定到目標主題，跳出 system 模式）
            // 新顏色從按下的按鈕圓形擴散（沒給按鈕位置就整頁淡入淡出），見 lib/themeReveal
            toggleTheme: (origin) =>
                withThemeReveal(() => {
                    set((state) => {
                        const next: Theme = state.theme === 'light' ? 'dark' : 'light'
                        return { theme: next, themePreference: next }
                    })
                }, origin),

            // 設定主題偏好；'system' 會立刻把 theme 對齊現在的系統偏好
            // 同樣從按鈕圓形擴散（沒給按鈕位置就整頁淡入淡出）
            setThemePreference: (pref, origin) =>
                withThemeReveal(() => {
                    set(() => {
                        if (pref === 'system') {
                            const sysDark =
                                typeof window !== 'undefined' &&
                                window.matchMedia('(prefers-color-scheme: dark)').matches
                            return { themePreference: pref, theme: sysDark ? 'dark' : 'light' }
                        }
                        return { themePreference: pref, theme: pref }
                    })
                }, origin),

            // 設定語言：介面文字立刻切換，並記在這裡（重新整理後 i18n 從這裡讀回；AI 回覆語言也看這個）
            setLanguage: (language) => {
                set({ language })
                void i18n.changeLanguage(language)
            },

            // 設定重點色
            setAccentColor: (color) => set({ accentColor: ACCENT_KEYS.includes(color) ? color : 'blue' }),

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
            showConfirm: (message, onConfirm, hint, opts) => set({ confirmConfig: { message, onConfirm, hint, ...opts } }),
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
            // v2：系統預設強調色改為藍色；舊版存的「預設（古銅）」一次性換成藍色，之後自選的照常保留
            version: 3,
            migrate: (persisted, version) => {
                const p = (persisted || {}) as { accentColor?: string }
                // v3：棕色（default）已移除，一律換成藍色
                if (version < 3 && (!p.accentColor || p.accentColor === 'default')) p.accentColor = 'blue'
                return p as never
            },
            // 以前存過的自訂顏色（#RRGGBB）一律改回預設品牌色
            merge: (persisted, current) => {
                const p = (persisted || {}) as Partial<typeof current>
                const accent = ACCENT_KEYS.includes(p.accentColor as AccentColorType) ? p.accentColor : 'blue'
                return { ...current, ...p, accentColor: accent as AccentColorType }
            },
            partialize: (state) => ({
                theme: state.theme,
                themePreference: state.themePreference,
                language: state.language,
                accentColor: state.accentColor,
                sidebarWidth: state.sidebarWidth,
            }),
        }
    )
)
