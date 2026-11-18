import { describe, expect, it } from 'vitest'
import { decide, histogram, pct, shareOf } from '../semanticDecide'

const th = { review: 0.5, block: 0.8, margin: 0.1 }

describe('semanticDecide（和後端 _decide 同一套規則）', () => {
    it('攔阻要同時夠像攻擊、又比正常範例高出 margin', () => {
        expect(decide([0.85, 0.5], th)).toBe('block')
        expect(decide([0.85, 0.8], th)).toBe('review') // 差距不到 margin，只送複查
        expect(decide([0.6, 0.4], th)).toBe('review')
        expect(decide([0.6, 0.7], th)).toBe('pass') // 比較像正常提問
        expect(decide([0.3, 0.1], th)).toBe('pass')
    })

    it('統計各判定的則數', () => {
        const s: Array<[number, number]> = [[0.9, 0.2], [0.6, 0.3], [0.2, 0.1], [0.1, 0.1]]
        expect(shareOf(s, th)).toEqual({ pass: 2, review: 1, block: 1, total: 4 })
    })

    it('長條圖：分數 1.0 放在最後一格，不會超出', () => {
        const h = histogram([[1, 0], [0, 0]], th, 10)
        expect(h[9].block).toBe(1)
        expect(h[0].pass).toBe(1)
    })

    it('百分比', () => {
        expect(pct(1, 300)).toBe('<1')
        expect(pct(0, 0)).toBe('0')
        expect(pct(1, 4)).toBe('25')
    })
})
