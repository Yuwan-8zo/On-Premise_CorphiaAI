/**
 * API Client (Axios)
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

// 基底 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// 建立 Axios 實例
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 120000, // NOTE: 提高至 120s，支援重型 LLM 的非串流推論
    headers: {
        'Content-Type': 'application/json',
    },
})

// 請求攔截器 - 添加 Token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

// 回應攔截器 - 處理錯誤、Token 刷新、速率限制
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // 429 Too Many Requests - 速率限制
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after']
            const data = error.response.data as { error?: { message?: string } }
            const message = data?.error?.message || `請求過於頻繁，請在 ${retryAfter || '數'} 秒後重試`

            // 觸發全域提示（如果有 toast 系統可以替換）
            console.warn(`[Rate Limit] ${message}`)

            return Promise.reject(error)
        }

        // Token 過期，嘗試刷新
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            const refreshToken = useAuthStore.getState().refreshToken
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                        refresh_token: refreshToken,
                    })

                    const { access_token, refresh_token } = response.data
                    const state = useAuthStore.getState()
                    state.setAuth(state.user!, access_token, refresh_token)

                    // 重試原始請求
                    originalRequest.headers.Authorization = `Bearer ${access_token}`
                    return apiClient(originalRequest)
                } catch {
                    // 刷新失敗，登出
                    useAuthStore.getState().clearAuth()
                    window.location.href = '/login'
                }
            }
        }

        return Promise.reject(error)
    }
)

export default apiClient
