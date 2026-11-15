import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '../clipboard'
import { useToastStore } from '@/store/toastStore'

describe('copyText', () => {
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

    it('剪貼簿 API 一直不回應：改用備援，備援也不行就提示失敗（按鈕不會沒反應）', async () => {
        vi.useFakeTimers()
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => new Promise(() => {}) }, configurable: true })
        document.execCommand = vi.fn(() => false)
        const add = vi.spyOn(useToastStore.getState(), 'add')
        const result = copyText('x')
        await vi.advanceTimersByTimeAsync(1000)
        expect(await result).toBe(false)
        expect(document.execCommand).toHaveBeenCalledWith('copy')
        expect(add).toHaveBeenCalled()
    })

    it('剪貼簿 API 成功就不提示', async () => {
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true })
        const add = vi.spyOn(useToastStore.getState(), 'add')
        expect(await copyText('x')).toBe(true)
        expect(add).not.toHaveBeenCalled()
    })
})
