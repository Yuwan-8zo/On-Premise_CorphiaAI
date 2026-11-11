/**
 * 後端使用者資料 → 前端 User 格式（共用）
 */

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

export function toUser(data: BackendUserResponse): User {
    return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        tenantId: data.tenant_id ?? undefined,
        avatarUrl: data.avatar_url ?? undefined,
        isActive: data.is_active,
        lastLoginAt: data.last_login_at ?? undefined,
        createdAt: data.created_at,
    }
}
