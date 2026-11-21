/**
 * 續期被限流（429）：要記下後端說的等待秒數，開機的重試迴圈照這個等
 * （以前固定 2 秒重試＝每分鐘 30 次，超過後端每分鐘 20 次的上限，畫面一直停在讀取中）
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { refreshAccessTokenOnce, takeRefreshRetryDelay } from '../client'
import { useAuthStore } from '@/store/authStore'

describe('續期被限流', () => {
    beforeEach(() => {
        takeRefreshRetryDelay()
        useAuthStore.setState({ refreshToken: 'r-token' })
    })

    it('照 Retry-After 等，而且不會登出', async () => {
        server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '7' } })))
        expect(await refreshAccessTokenOnce()).toBeNull()
        expect(takeRefreshRetryDelay()).toBe(7000)
        expect(takeRefreshRetryDelay()).toBe(0)
        expect(useAuthStore.getState().refreshToken).toBe('r-token')
    })

    it('沒給 Retry-After 就等 30 秒', async () => {
        server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 429 })))
        await refreshAccessTokenOnce()
        expect(takeRefreshRetryDelay()).toBe(30_000)
    })

    it('一般的連不上不用多等', async () => {
        server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 503 })))
        await refreshAccessTokenOnce()
        expect(takeRefreshRetryDelay()).toBe(0)
    })
})
