import { beforeEach, describe, expect, it } from 'vitest'
import { IDLE_LOCK_MS, isLocked, lastActive, markActive, msUntilLock, setLocked } from '../idleLock'

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
})
