/**
 * bootstrapAuth — App mount 時跑的認證復原流程。
 *
 * 流程：
 *   1. 沒 refresh token → 直接標記完成（讓 router 自然導去登入頁）
 *   2. 有 refresh token → 用它換新 access token
 *   3. **如果 user 物件不在 store**（HMR 殘留 / 之前 bug 寫成 null）
 *      → 額外打 /auth/me 補抓回來，不然 ChatSidebar 之類 UI 會顯示 fallback
 *      （以前出現過「Local User」就是這個原因）
 *
 * 任何一步 fail 都 clearAuth + 落到登入頁。
 */
import { useAuthStore } from '../store/authStore'
import api from '../api/client'
import { authApi } from '../api/auth'

let bootstrapInflight: Promise<void> | null = null

const runBootstrapAuth = async () => {
    const state = useAuthStore.getState()
    const { refreshToken, setAccessToken, clearAuth, setBootstrapped } = state

    if (!refreshToken) {
        setBootstrapped(true)
        return
    }

    try {
        const response = await api.post(
            '/auth/refresh',
            { refresh_token: refreshToken },
            { timeout: 5000 },
        )
        const newAccessToken = response.data.access_token
        const newRefreshToken = response.data.refresh_token
        setAccessToken(newAccessToken)
        if (newRefreshToken && newRefreshToken !== useAuthStore.getState().refreshToken) {
            useAuthStore.setState({ refreshToken: newRefreshToken })
        }

        // 如果 store 沒有 user（被以前 bug 寫成 null 或 persist 漏存），
        // 用新 token 立刻打 /auth/me 補回來。失敗的話視為 token 真的廢了 → clearAuth。
        if (!useAuthStore.getState().user) {
            try {
                const user = await authApi.me()
                useAuthStore.setState({ user })
            } catch {
                clearAuth()
            }
        }
    } catch (error) {
        console.error('Failed to refresh token during bootstrap:', error)
        clearAuth()
    } finally {
        setBootstrapped(true)
    }
}

export const bootstrapAuth = async () => {
    if (bootstrapInflight) return bootstrapInflight

    bootstrapInflight = runBootstrapAuth()
    try {
        await bootstrapInflight
    } finally {
        bootstrapInflight = null
    }
}
