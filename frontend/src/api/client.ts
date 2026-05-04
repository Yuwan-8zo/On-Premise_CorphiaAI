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
        'ngrok-skip-browser-warning': 'true', // 加入此 header 以避開 ngrok 畫面
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

// ----------------------------------------------------------------------------
// Token refresh — single-flight (避免「驚群效應」)
// ----------------------------------------------------------------------------
// 問題：當 access token 過期，admin 頁同時 polling 多個 endpoint（stats / users
// / audit / ngrok），每個請求各自拿到 401 後都會 fire 一次 /auth/refresh。
// 後端 refresh token 是 one-time 的（用過就 rotate），所以只有第一個 refresh
// 會成功；其餘 N-1 個帶舊的 refresh token 進去全部 401，interceptor 看到
// refresh 失敗就 clearAuth() + 硬跳 /login → 使用者體驗：admin 頁閃退到登入頁。
//
// 解法：把 refresh 操作鎖在一個 module-scope 的 Promise 上：
//   - 若沒有 refresh 在飛 → 發 refresh，把 promise 暫存
//   - 若已有 refresh 在飛 → 直接 await 那個現有的 promise
// 全站永遠最多一個 /auth/refresh 在飛。
// ----------------------------------------------------------------------------

let refreshInflight: Promise<string | null> | null = null

async function refreshAccessTokenOnce(): Promise<string | null> {
    if (refreshInflight) return refreshInflight

    refreshInflight = (async () => {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) return null
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
            })
            const { access_token, refresh_token } = response.data
            const state = useAuthStore.getState()
            state.setAuth(state.user!, access_token, refresh_token)
            return access_token as string
        } catch {
            // Refresh 失敗才登出，且只執行一次（其他等待者都拿到 null，不會重複 redirect）
            useAuthStore.getState().clearAuth()
            return null
        }
    })()

    try {
        return await refreshInflight
    } finally {
        refreshInflight = null
    }
}

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

        // Token 過期，嘗試刷新（single-flight，多個並發 401 共用一個 refresh）
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            const newAccessToken = await refreshAccessTokenOnce()
            if (newAccessToken) {
                // Refresh 成功 → 用新 token 重試原始請求
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return apiClient(originalRequest)
            }

            // Refresh 失敗（refresh token 不存在或 server 拒絕）→ 跳登入頁。
            // clearAuth 已經在 refreshAccessTokenOnce 裡做過了，這裡只負責導頁；
            // 多個並發 401 都走到這條路徑也只會執行一次 location 變更。
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        }

        return Promise.reject(error)
    }
)

export default apiClient
