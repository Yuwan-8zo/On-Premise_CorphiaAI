/**
 * 認證 API
 */

import apiClient from './client'
import type { LoginRequest, LoginResponse, RegisterRequest } from '../types/auth'
import type { User } from '../types/auth'
import { toUser } from './userMapper'
import { useAuthStore } from '../store/authStore'

/**
 * 密碼強度回應
 */
export interface PasswordStrengthResult {
    score: number
    level: 'weak' | 'medium' | 'strong' | 'very_strong'
    errors: string[]
    is_valid: boolean
}

export const authApi = {
    /**
     * 使用者登入
     */
    login: async (data: LoginRequest): Promise<LoginResponse> => {
        const response = await apiClient.post('/auth/login', data)
        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            tokenType: response.data.token_type,
            expiresIn: response.data.expires_in,
        }
    },

    /**
     * 使用者註冊
     */
    register: async (data: RegisterRequest): Promise<User> => {
        const response = await apiClient.post('/auth/register', {
            email: data.email,
            password: data.password,
            name: data.name,
            tenant_slug: data.tenantSlug,
        })
        return toUser(response.data)
    },

    /**
     * 取得當前使用者資訊
     */
    me: async (): Promise<User> => {
        const response = await apiClient.get('/auth/me')
        return toUser(response.data)
    },

    /**
     * 登出
     */
    logout: async (): Promise<void> => {
        await apiClient.post('/auth/logout')
    },

    /**
     * 刷新 Token
     */
    refresh: async (refreshToken: string): Promise<LoginResponse> => {
        const response = await apiClient.post('/auth/refresh', {
            refresh_token: refreshToken,
        })
        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            tokenType: response.data.token_type,
            expiresIn: response.data.expires_in,
        }
    },

    /**
     * 修改密碼：成功後其他裝置的登入全部失效，後端回傳一組新的 Token 給目前這個裝置，這裡直接存起來
     */
    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        const response = await apiClient.post('/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
        })
        const { access_token, refresh_token } = response.data ?? {}
        if (access_token && refresh_token) {
            useAuthStore.setState({ accessToken: access_token, refreshToken: refresh_token, isAuthenticated: true })
        }
    },

    /**
     * 檢查密碼強度（無需登入）
     */
    checkPasswordStrength: async (password: string): Promise<PasswordStrengthResult> => {
        const response = await apiClient.post('/auth/check-password-strength', {
            password,
        })
        return response.data
    },
}
