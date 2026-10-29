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
