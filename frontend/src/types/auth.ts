/**
 * 認證相關類型定義
 */

export interface User {
    id: string
    email: string
    name: string
    role: 'engineer' | 'admin' | 'user'
    tenantId?: string
    avatarUrl?: string
    isActive: boolean
    lastLoginAt?: string
    createdAt: string
}

export interface LoginRequest {
    email: string
    password: string
}

export interface LoginResponse {
    accessToken: string
    refreshToken: string
    tokenType: string
    expiresIn: number
}

export interface RegisterRequest {
    email: string
    password: string
    name?: string
    tenantSlug?: string
}
