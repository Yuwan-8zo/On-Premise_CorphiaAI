/**
 * 啟動時的身分復原流程
 *
 * 配合 authStore 的新策略：accessToken 只存記憶體
 * 頁面重新整理後 accessToken 會不見，但 refreshToken 仍在 localStorage，
 * 這個 function 會：
 *   1. 若有 refreshToken，呼叫 /auth/refresh 拿新的 access token
 *   2. 把新 token 塞回 store（只進記憶體）
 *   3. 若失敗，清掉 auth 讓使用者重新登入
 *
 * 呼叫時機：App 元件 mount 時執行一次
 */

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export async function bootstrapAuth(): Promise<void> {
    const store = useAuthStore.getState()

    // 沒 refresh token → 完全沒登入過，直接標記 bootstrapped 讓 UI 正常顯示 /login
    if (!store.refreshToken) {
        store.setBootstrapped(true)
        return
    }

    try {
        const res = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: store.refreshToken },
            { timeout: 10000 }
        )

        const { access_token, refresh_token, user } = res.data as {
            access_token: string
            refresh_token: string
            user?: typeof store.user
        }

        if (user) {
            store.setAuth(user, access_token, refresh_token)
        } else {
            // 後端沒回 user，沿用舊 user 資料只更新 token
            if (store.user) {
                store.setAuth(store.user, access_token, refresh_token)
            } else {
                // 沒 user 又沒法取得，保險起見清空
                store.clearAuth()
            }
        }
    } catch (err) {
        // refresh 失敗（token 過期 / 伺服器無回應）→ 清掉狀態，使用者會被導回 login
        console.warn('[auth] bootstrap refresh failed, clearing session', err)
        store.clearAuth()
    } finally {
        store.setBootstrapped(true)
    }
}
