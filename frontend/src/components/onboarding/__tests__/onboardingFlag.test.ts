/**
 * 小 AI 導覽「已看過」的標記：每個帳號分開記
 *   新註冊的帳號第一次登入要看到導覽，即使同一台電腦上別的帳號已經看過
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { isOnboardingDone, markOnboardingDone, resetOnboarding } from '../onboardingFlag'

describe('onboardingFlag', () => {
    beforeEach(() => localStorage.clear())

    it('新帳號還沒看過導覽', () => {
        expect(isOnboardingDone('new-user')).toBe(false)
    })

    it('一個帳號看過，不影響另一個帳號', () => {
        markOnboardingDone('user-a')
        expect(isOnboardingDone('user-a')).toBe(true)
        expect(isOnboardingDone('user-b')).toBe(false)
    })

    it('重新觀看：清掉這個帳號的標記', () => {
        markOnboardingDone('user-a')
        resetOnboarding('user-a')
        expect(isOnboardingDone('user-a')).toBe(false)
    })
})
