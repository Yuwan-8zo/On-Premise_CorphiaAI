/**
 * 多個分頁共用同一張 refresh token（一次性、用過就作廢）
 * 以前：另一個分頁先換掉了，這一頁拿舊的去換被拒絕（401）→ 直接登出，所有分頁一起被踢回登入頁
 * 現在：被拒絕時先看 localStorage 是不是已經有別的分頁換好的新 token，有就改用它
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { refreshAccessTokenOnce } from '../client'
import { useAuthStore } from '@/store/authStore'

/** 模擬另一個分頁把新的 refresh token 寫進 localStorage */
function otherTabWrites(refreshToken: string) {
    const raw = JSON.parse(localStorage.getItem('auth-storage') || '{"state":{},"version":0}')
    raw.state.refreshToken = refreshToken
    localStorage.setItem('auth-storage', JSON.stringify(raw))
}

describe('多分頁換新憑證', () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, accessToken: null, refreshToken: 'old', isAuthenticated: true })
    })

    it('別的分頁剛好先換好：改用它換好的新 token，不登出', async () => {
        const used: string[] = []
        server.use(http.post('*/auth/refresh', async ({ request }) => {
            const { refresh_token } = (await request.json()) as { refresh_token: string }
            used.push(refresh_token)
            if (refresh_token === 'old') {
                otherTabWrites('new') // 另一個分頁在同一時間用掉了 old、拿到 new
                return new HttpResponse(null, { status: 401 })
            }
            return HttpResponse.json({ access_token: 'acc-2', refresh_token: 'newer', token_type: 'bearer' })
        }))
        expect(await refreshAccessTokenOnce()).toBe('acc-2')
        expect(used).toEqual(['old', 'new'])
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
        expect(useAuthStore.getState().refreshToken).toBe('newer')
    })

    it('拿鎖的時候別的分頁已經換好：直接用新的，不浪費一次', async () => {
        otherTabWrites('new')
        const used: string[] = []
        server.use(http.post('*/auth/refresh', async ({ request }) => {
            const { refresh_token } = (await request.json()) as { refresh_token: string }
            used.push(refresh_token)
            return HttpResponse.json({ access_token: 'acc-3', refresh_token: 'newer', token_type: 'bearer' })
        }))
        expect(await refreshAccessTokenOnce()).toBe('acc-3')
        expect(used).toEqual(['new'])
    })

    it('真的失效（沒有別的分頁換過）才登出', async () => {
        server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 401 })))
        expect(await refreshAccessTokenOnce()).toBeNull()
        expect(useAuthStore.getState().refreshToken).toBeNull()
        expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
})
