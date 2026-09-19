/**
 * Mock Auth API — Demo 版
 * 任何帳號密碼都接受（密碼需 ≥4 字元，方便展示錯誤提示）
 */

import { DEMO_USER } from '../demo/mockData'
import type { LoginRequest, LoginResponse, RegisterRequest } from '@/types/auth'
import type { User } from '@/types/auth'

const MOCK_ACCESS_TOKEN = 'demo-access-token'
const MOCK_REFRESH_TOKEN = 'demo-refresh-token'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export const authApi = {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
        await sleep(800)
        if (!data.password || data.password.length < 4) {
            throw { response: { data: { detail: '密碼不正確，請再試一次' } } }
        }
        return {
            accessToken: MOCK_ACCESS_TOKEN,
            refreshToken: MOCK_REFRESH_TOKEN,
            tokenType: 'Bearer',
            expiresIn: 86400,
        }
    },

    register: async (data: RegisterRequest): Promise<User> => {
        await sleep(1000)
        return {
            id: `user-${Date.now()}`,
            email: data.email,
            name: data.name || data.email.split('@')[0],
            role: 'user',
            isActive: true,
            createdAt: new Date().toISOString(),
        } as User
    },

    me: async (): Promise<User> => {
        await sleep(200)
        return DEMO_USER as unknown as User
    },

    logout: async (): Promise<void> => { await sleep(200) },

    refresh: async (_token: string): Promise<LoginResponse> => ({
        accessToken: MOCK_ACCESS_TOKEN,
        refreshToken: MOCK_REFRESH_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 86400,
    }),

    changePassword: async (): Promise<void> => { await sleep(300) },

    checkPasswordStrength: async (password: string) => ({
        score: Math.min(Math.floor(password.length / 3), 4),
        level: password.length >= 10 ? 'strong' : password.length >= 6 ? 'medium' : 'weak',
        errors: [],
        is_valid: password.length >= 6,
    }),
}
