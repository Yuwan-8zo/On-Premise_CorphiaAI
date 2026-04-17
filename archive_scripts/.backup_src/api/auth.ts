/**
 * 認證 API
 */

import apiClient from './client'
import type { LoginRequest, LoginResponse, RegisterRequest } from '../types/auth'
import type { User } from '../types/auth'

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
        return response.data
    },

    /**
     * 取得當前使用者資訊
     */
    me: async (): Promise<User> => {
        const response = await apiClient.get('/auth/me')
        return {
            id: response.data.id,
            email: response.data.email,
            name: response.data.name,
            role: response.data.role,
            tenantId: response.data.tenant_id,
            avatarUrl: response.data.avatar_url,
            isActive: response.data.is_active,
            lastLoginAt: response.data.last_login_at,
            createdAt: response.data.created_at,
        }
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
}
