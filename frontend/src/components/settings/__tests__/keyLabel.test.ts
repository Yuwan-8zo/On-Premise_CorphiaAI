/**
 * 快捷鍵的寫法：Mac 的修飾鍵一律用符號（⌘ ⇧ ⌥），其他系統用英文字
 * （以前 Mac 上會出現「⌘ Shift O」：一個符號、一個英文字混在一起）
 */
import { describe, expect, it } from 'vitest'
import { keyLabel } from '../GuideSection'

describe('快捷鍵的寫法', () => {
    it('Mac：修飾鍵全部用符號', () => {
        expect(['mod', 'Shift', 'O'].map((k) => keyLabel(k, true))).toEqual(['⌘', '⇧', 'O'])
        expect(keyLabel('Alt', true)).toBe('⌥')
    })
    it('Windows／Linux：用英文字', () => {
        expect(['mod', 'Shift', 'O'].map((k) => keyLabel(k, false))).toEqual(['Ctrl', 'Shift', 'O'])
    })
    it('一般按鍵兩邊一樣', () => {
        expect(keyLabel('Esc', true)).toBe('Esc')
        expect(keyLabel('↑', false)).toBe('↑')
    })
})
