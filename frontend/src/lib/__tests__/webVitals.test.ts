/** 使用者體驗量測：送出去的頁面路徑不能帶對話編號；沒登入不送 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { pageKey, flushVitals, _queueForTest } from '../webVitals'
import { useAuthStore } from '@/store/authStore'

describe('web-vitals 回報', () => {
    beforeEach(() => { _queueForTest().length = 0 })

    it('頁面只留路徑第一段（不帶對話編號、查詢字串）', () => {
        expect(pageKey('/')).toBe('/')
        expect(pageKey('/admin')).toBe('/admin')
        expect(pageKey('/c/123e4567-e89b-12d3-a456-426614174000')).toBe('/c')
        expect(pageKey('/share/AbC123')).toBe('/share')
        expect(pageKey('/Login')).toBe('/login')
    })

    it('沒登入：清掉、不送', () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
        useAuthStore.setState({ accessToken: null })
        _queueForTest().push({ name: 'LCP', value: 1, rating: 'good', page: '/', device: 'desktop' })
        flushVitals()
        expect(spy).not.toHaveBeenCalled()
        expect(_queueForTest()).toHaveLength(0)
        spy.mockRestore()
    })

    it('登入：一次送出、帶登入憑證、關掉頁面也送得出去', () => {
        const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
        useAuthStore.setState({ accessToken: 'tok' })
        _queueForTest().push({ name: 'INP', value: 120, rating: 'good', page: '/', device: 'mobile' })
        flushVitals()
        expect(spy).toHaveBeenCalledTimes(1)
        const [url, init] = spy.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/vitals$/)
        expect(init.keepalive).toBe(true)
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
        expect(JSON.parse(init.body as string).items[0]).toEqual({ name: 'INP', value: 120, rating: 'good', page: '/', device: 'mobile' })
        spy.mockRestore()
    })
})
