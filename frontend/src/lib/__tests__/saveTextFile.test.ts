import { describe, it, expect, vi, beforeEach } from 'vitest'

const saveFile = vi.fn()
vi.mock('@/lib/desktop', () => ({ desktop: { saveFile: (...a: unknown[]) => saveFile(...a) } }))

import { saveTextFile, suggestFilename } from '../saveTextFile'
import { useToastStore } from '@/store/toastStore'

const toasts = () => useToastStore.getState().toasts.map((t) => ({ type: t.type, message: t.message }))

describe('suggestFilename（依語言給建議檔名）', () => {
    it('常見語言對應到副檔名，不分大小寫', () => {
        expect(suggestFilename('python')).toBe('code.py')
        expect(suggestFilename('TypeScript')).toBe('code.ts')
        expect(suggestFilename('bash')).toBe('code.sh')
    })
    it('沒標語言或不認得的語言當純文字', () => {
        expect(suggestFilename('')).toBe('code.txt')
        expect(suggestFilename('klingon')).toBe('code.txt')
    })
    it('Dockerfile 沒有副檔名', () => {
        expect(suggestFilename('dockerfile')).toBe('Dockerfile')
    })
})

describe('saveTextFile', () => {
    beforeEach(() => {
        saveFile.mockReset()
        useToastStore.setState({ toasts: [] })
    })

    it('桌面版：存好了顯示位置', async () => {
        saveFile.mockResolvedValue({ ok: true, path: 'C:\\Users\\me\\Documents\\code.py', name: 'code.py', chars: 5, backup: null })
        expect(await saveTextFile('code.py', 'print', true)).toBe(true)
        expect(saveFile).toHaveBeenCalledWith('code.py', 'print')
        expect(toasts()[0].type).toBe('success')
        expect(toasts()[0].message).toContain('C:\\Users\\me\\Documents\\code.py')
    })

    it('桌面版：使用者按取消，不存也不顯示任何訊息', async () => {
        saveFile.mockResolvedValue(null)
        expect(await saveTextFile('code.py', 'print', true)).toBe(false)
        expect(toasts()).toEqual([])
    })

    it('桌面版：失敗時顯示原因', async () => {
        saveFile.mockRejectedValue(new Error('不能存到系統資料夾或開機自動執行的資料夾，請選別的位置'))
        expect(await saveTextFile('x.bat', 'echo', true)).toBe(false)
        expect(toasts()[0]).toEqual({ type: 'error', message: '不能存到系統資料夾或開機自動執行的資料夾，請選別的位置' })
    })

    it('瀏覽器：改成一般下載，不呼叫桌面版', async () => {
        const createObjectURL = vi.fn(() => 'blob:x')
        const revokeObjectURL = vi.fn()
        Object.assign(URL, { createObjectURL, revokeObjectURL })
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
        expect(await saveTextFile('code.py', 'print', false)).toBe(true)
        expect(saveFile).not.toHaveBeenCalled()
        expect(click).toHaveBeenCalledOnce()
        click.mockRestore()
    })
})
