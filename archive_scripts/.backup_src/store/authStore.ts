/**
 * 認證 Store (Zustand)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/auth'

interface AuthState {
    // 狀態
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    isAuthenticated: boolean
    isLoading: boolean

    // 動作
    setAuth: (user: User, accessToken: string, refreshToken: string) => void
    clearAuth: () => void
    setLoading: (loading: boolean) => void
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

            // 設定認證
            setAuth: (user, accessToken, refreshToken) =>
                set({
                    user,
                    accessToken,
                    refreshToken,
                    isAuthenticated: true,
                    isLoading: false,
                }),

            // 清除認證
            clearAuth: () =>
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    isLoading: false,
                }),

            // 設定載入狀態
            setLoading: (loading) => set({ isLoading: loading }),

            // 更新使用者資訊
            updateUser: (userData) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...userData } : null,
                })),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
