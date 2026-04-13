/**
 * 使用者 API
 */

import apiClient from './client'
import type { User } from '../types/auth'

export const usersApi = {
    /**
     * 更新當前使用者資訊
     */
    updateMe: async (data: { name?: string; avatar_url?: string }): Promise<User> => {
        const response = await apiClient.put('/users/me', data)
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
}
