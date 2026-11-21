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

/** 續期被限流（429）時，後端說要等多久（毫秒）；沒給就等這麼久 */
const REFRESH_LIMITED_WAIT_MS = 30_000
let refreshRetryAfterMs = 0
/** 上一次續期被限流時要等多久（讀一次就歸零）；開機的重試迴圈照這個等，不然會一直撞限流出不來 */
export function takeRefreshRetryDelay(): number {
    const ms = refreshRetryAfterMs
    refreshRetryAfterMs = 0
    return ms
}

/**
 * 多個分頁共用同一張 refresh token，而後端的 refresh token 是一次性的（用過就作廢、換一張新的）。
 * 兩個分頁同時拿同一張去換，後到的會被拒絕（401）——以前被拒絕就直接登出，再經由多分頁同步把所有分頁一起登出
 * （實測：開著兩個分頁時，登入約 20 秒就被踢回登入頁）。所以：
 *   1. 跨分頁鎖（Web Locks）：同一時間只有一個分頁在換；拿到鎖時再讀一次 localStorage，別的分頁剛換好就用新的
 *   2. 被拒絕時先看 localStorage 是不是已經有別的分頁換好的新 token，有就改用它再試一次，真的沒有才登出
 */
const REFRESH_LOCK = 'corphia-auth-refresh'

/** 目前 localStorage 裡（所有分頁共用）的 refresh token；讀不到就用這一頁記憶體裡的 */
function sharedRefreshToken(): string | null {
    try {
        const raw = localStorage.getItem('auth-storage')
        const stored = raw ? (JSON.parse(raw)?.state?.refreshToken as string | null | undefined) : undefined
        if (stored !== undefined) return stored
    } catch { /* 無痕模式或格式不對：用記憶體裡的 */ }
    return useAuthStore.getState().refreshToken
}

/** 跨分頁同一時間只跑一個（瀏覽器不支援 Web Locks 就直接跑） */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    return locks ? locks.request(REFRESH_LOCK, fn) : fn()
}

async function exchange(refreshToken: string): Promise<string> {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    const { access_token, refresh_token } = response.data
    // 只動 token、不動 user（state.user 在 HMR／persist 還原時可能是 null，寫進去會變成「Local User」）
    const state = useAuthStore.getState()
    state.setAccessToken(access_token)
    if (refresh_token && refresh_token !== state.refreshToken) {
        useAuthStore.setState({ refreshToken: refresh_token })
    }
    return access_token as string
}

export async function refreshAccessTokenOnce(): Promise<string | null> {
    if (refreshInflight) return refreshInflight

    refreshInflight = withRefreshLock(async () => {
        const used = sharedRefreshToken()
        if (!used) return null
        try {
            return await exchange(used)
        } catch (err) {
            const res = (err as AxiosError)?.response
            const status = res?.status
            if (status === 429) {
                const sec = Number(res?.headers?.['retry-after'])
                refreshRetryAfterMs = Number.isFinite(sec) && sec > 0 ? sec * 1000 : REFRESH_LIMITED_WAIT_MS
            }
            if (status === 401 || status === 403) {
                // 別的分頁剛好已經換好了（我們拿的是被它用掉的舊 token）→ 改用新的再試一次
                const latest = sharedRefreshToken()
                if (latest && latest !== used) {
                    try {
                        return await exchange(latest)
                    } catch (retryErr) {
                        const rs = (retryErr as AxiosError)?.response?.status
                        if (rs !== 401 && rs !== 403) return null
                    }
                }
                // 真的失效（不是被別的分頁搶先）才登出
                useAuthStore.getState().clearAuth()
            }
            // 連不上或伺服器錯誤（系統重啟中）保留登入狀態，讓呼叫端稍後重試
            return null
        }
    })

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
        const requestUrl = originalRequest.url || ''
        const isAuthRefreshRequest = requestUrl.includes('/auth/refresh')
        const isLoginRequest = requestUrl.includes('/auth/login')

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
        if (error.response?.status === 401 && isAuthRefreshRequest) {
            useAuthStore.getState().clearAuth()
            return Promise.reject(error)
        }

        if (error.response?.status === 401 && isLoginRequest) {
            return Promise.reject(error)
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true

            const newAccessToken = await refreshAccessTokenOnce()
            if (newAccessToken) {
                // Refresh 成功 → 用新 token 重試原始請求
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return apiClient(originalRequest)
            }

            // Refresh 失敗：伺服器拒絕時 refreshAccessTokenOnce 已經登出；
            // 若只是暫時連不上，refresh token 還在，不要登出
        }

        return Promise.reject(error)
    }
)

export default apiClient
