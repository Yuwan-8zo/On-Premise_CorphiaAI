/**
 * 認證 Store (Zustand)
 *
 * 安全策略：
 * - accessToken：**只存在記憶體**，不進 localStorage，避免 XSS 一次拿到授權
 * - refreshToken：存 localStorage（短期方案；若要更嚴格請改 httpOnly cookie）
 * - 重新整理頁面時，App 啟動流程用 refreshToken 換一張新的 accessToken
 *   （實作於 App.tsx 的初始化 hook / bootstrapAuth）
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/auth'

interface AuthState {
    // ---- 狀態 ----
    user: User | null
    /** 只保留在記憶體中，重新整理會消失 */
    accessToken: string | null
    /** 持久化，僅用於換新 access token */
    refreshToken: string | null
    isAuthenticated: boolean
    isLoading: boolean
    /** 是否已跑過啟動時的 token 復原流程，避免閃爍「未登入」 */
    isBootstrapped: boolean

    // ---- 動作 ----
    setAuth: (user: User, accessToken: string, refreshToken: string) => void
    setAccessToken: (token: string) => void
    clearAuth: () => void
    setLoading: (loading: boolean) => void
    setBootstrapped: (bootstrapped: boolean) => void
    updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // 初始狀態
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            isBootstrapped: false,

            // 設定完整認證（登入或 register 後呼叫）
            setAuth: (user, accessToken, refreshToken) =>
                set({
                    user,
                    accessToken,
                    refreshToken,
                    isAuthenticated: true,
                    isLoading: false,
                }),

            // 只更新 accessToken（自動 refresh 用）
            setAccessToken: (token) =>
                set({
                    accessToken: token,
                    isAuthenticated: true,
                }),

            // 清除所有認證資訊
            clearAuth: () =>
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    isLoading: false,
                }),

            setLoading: (loading) => set({ isLoading: loading }),
            setBootstrapped: (bootstrapped) => set({ isBootstrapped: bootstrapped }),

            updateUser: (userData) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...userData } : null,
                })),
        }),
        {
            name: 'auth-storage',
            // 只持久化「可以公開曝光也不算災難」的部分 —— access token 絕不入磁碟
            partialize: (state) => ({
                user: state.user,
                refreshToken: state.refreshToken,
                // 保留 isAuthenticated 讓頁面刷新時 UI 不會先閃到登入頁，
                // 真正的驗證交由 bootstrapAuth() 用 refreshToken 完成
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
