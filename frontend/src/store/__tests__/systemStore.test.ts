import { describe, expect, it } from 'vitest'

import { isApiReady, isLlmReady, type HealthStatus } from '@/api/health'

describe('system readiness helpers', () => {
    it('isApiReady when status is ok', () => {
        const health: HealthStatus = {
            status: 'ok',
            version: '2.3.0',
            database: 'connected',
            llm: 'loading',
            rag: 'loading',
        }
        expect(isApiReady(health)).toBe(true)
        expect(isLlmReady(health)).toBe(false)
    })

    it('isLlmReady only when llm is ready', () => {
        const health: HealthStatus = {
            status: 'ok',
            version: '2.3.0',
            database: 'connected',
            llm: 'ready',
            rag: 'loading',
        }
        expect(isLlmReady(health)).toBe(true)
    })
})

describe('offline detection', () => {
    it('needs OFFLINE_AFTER failures in a row, and one success clears it', async () => {
        const { useSystemStore, OFFLINE_AFTER } = await import('@/store/systemStore')
        const health = await import('@/api/health')
        const { vi } = await import('vitest')
        const spy = vi.spyOn(health, 'fetchHealth').mockRejectedValue(new Error('down'))
        useSystemStore.setState({ failStreak: 0, offline: false })
        for (let i = 1; i < OFFLINE_AFTER; i += 1) await useSystemStore.getState().refreshHealth()
        expect(useSystemStore.getState().offline).toBe(false)
        await useSystemStore.getState().refreshHealth()
        expect(useSystemStore.getState().offline).toBe(true)
        spy.mockResolvedValue({ status: 'ok', version: '', database: '', llm: 'ready', rag: 'ready' })
        await useSystemStore.getState().refreshHealth()
        expect(useSystemStore.getState().offline).toBe(false)
        spy.mockRestore()
    })
})
