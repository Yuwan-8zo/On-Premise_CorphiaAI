import { describe, expect, it } from 'vitest'
import { accessoryOf, dayPartOf, holidayOf } from '../dayPart'

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('dayPart', () => {
    it('依時段切換問候', () => {
        expect(dayPartOf(at(2026, 11, 21, 4))).toBe('late')
        expect(dayPartOf(at(2026, 11, 21, 5))).toBe('morning')
        expect(dayPartOf(at(2026, 11, 21, 12))).toBe('noon')
        expect(dayPartOf(at(2026, 11, 21, 15))).toBe('afternoon')
        expect(dayPartOf(at(2026, 11, 21, 19))).toBe('evening')
        expect(dayPartOf(at(2026, 11, 21, 23))).toBe('late')
    })
    it('節日：聖誕、中秋、過年（農曆從瀏覽器換算）', () => {
        expect(holidayOf(at(2026, 12, 24))).toBe('christmas')
        expect(holidayOf(at(2026, 9, 25))).toBe('midAutumn') // 2026 中秋
        expect(holidayOf(at(2027, 2, 6))).toBe('newYear') // 2027 除夕
        expect(holidayOf(at(2027, 2, 11))).toBe('newYear') // 初五
        expect(holidayOf(at(2027, 2, 12))).toBeNull() // 初六
        expect(holidayOf(at(2026, 11, 21))).toBeNull()
    })
    it('配件：節日優先，平常深夜戴睡帽', () => {
        expect(accessoryOf(at(2026, 12, 24, 23))).toBe('christmas')
        expect(accessoryOf(at(2026, 11, 21, 23))).toBe('nightcap')
        expect(accessoryOf(at(2026, 11, 21, 10))).toBeNull()
    })
})
