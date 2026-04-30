/**
 * 使用者 API
 */

import apiClient from './client'
import type { User } from '../types/auth'

/** 後端 UserResponse 的原始格式（snake_case） */
export interface BackendUserResponse {
    id: string
    name: string
    email: string
    role: 'engineer' | 'admin' | 'user'
    is_active: boolean
    created_at: string
    last_login_at?: string | null
    tenant_id?: string | null
    avatar_url?: string | null
}

export interface UserListResponse {
    data: BackendUserResponse[]
    total: number
    page: number
    page_size: number
    total_pages: number
}

export interface CreateUserPayload {
    name: string
    email: string
    password: string
    role: string
    is_active?: boolean
}

export interface UpdateUserPayload {
    name?: string
    role?: string
    is_active?: boolean
    password?: string
}

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

    /**
     * 列出使用者（admin/engineer 限定）
     */
    listUsers: async (params: { page?: number; page_size?: number } = {}): Promise<UserListResponse> => {
        const response = await apiClient.get('/users', {
            params: { page: 1, page_size: 100, ...params },
        })
        return response.data
    },

    /**
     * 建立使用者（admin/engineer 限定）
     */
    createUser: async (data: CreateUserPayload): Promise<BackendUserResponse> => {
        const response = await apiClient.post('/users', data)
        return response.data
    },

    /**
     * 更新使用者（admin/engineer 限定）
     */
    updateUser: async (userId: string, data: UpdateUserPayload): Promise<BackendUserResponse> => {
        const response = await apiClient.put(`/users/${userId}`, data)
        return response.data
    },

    /**
     * 刪除使用者（admin/engineer 限定）
     */
    deleteUser: async (userId: string): Promise<void> => {
        await apiClient.delete(`/users/${userId}`)
    },
}
