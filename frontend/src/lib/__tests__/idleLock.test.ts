import { beforeEach, describe, expect, it } from 'vitest'
import { IDLE_LOCK_MS, expiredSinceLastVisit, isLocked, lastActive, markActive, msUntilLock, setLocked } from '../idleLock'

describe('idleLock', () => {
    beforeEach(() => localStorage.clear())

    it('counts down from the last activity', () => {
        const t0 = 1_000_000
        expect(msUntilLock(t0 + 1000, t0)).toBe(IDLE_LOCK_MS - 1000)
        expect(msUntilLock(t0 + IDLE_LOCK_MS, t0)).toBe(0)
    })

    it('shares the last activity through localStorage (other tabs count too)', () => {
        markActive(5)
        localStorage.setItem('corphia-last-active', String(Date.now() + 10_000))
        expect(lastActive()).toBeGreaterThan(Date.now())
    })

    it('remembers the lock across reloads', () => {
        setLocked(true)
        expect(isLocked()).toBe(true)
        setLocked(false)
        expect(isLocked()).toBe(false)
    })

    it('locks on open when the last activity (from a closed tab) is older than the timeout', () => {
        const now = 10 * IDLE_LOCK_MS
        expect(expiredSinceLastVisit(now)).toBe(false) // 從來沒有紀錄：不鎖
        localStorage.setItem('corphia-last-active', String(now - IDLE_LOCK_MS - 1))
        expect(expiredSinceLastVisit(now)).toBe(true)
        localStorage.setItem('corphia-last-active', String(now - 1000))
        expect(expiredSinceLastVisit(now)).toBe(false)
    })
})
