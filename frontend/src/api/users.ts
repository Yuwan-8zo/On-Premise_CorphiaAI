/**
 * 使用者 API
 */

import apiClient from './client'
import type { User } from '../types/auth'
import { toUser, type BackendUserResponse } from './userMapper'

export type { BackendUserResponse }

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
        return toUser(response.data)
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
