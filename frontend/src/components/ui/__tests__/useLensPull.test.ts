/**
 * 拉過頭（規範「拉桿」）：越拉越拉不動、最多 pullMax；近端剛好跟到被拉的距離，遠端只跟著整列移 pullShare
 */
import { describe, expect, it } from 'vitest'
import { LENS_CFG } from '@/components/ui/lensKit'
import { pullDamp, pullTransform } from '@/components/ui/useLensPull'

/** 套用變形後，版面上的 x 會出現在哪裡（縮放中心 o） */
const map = (x: number, o: number, v: { s: number; t: number }) => o + v.s * (x - o) + v.t

describe('pullDamp', () => {
    it('沒超出就不動；越拉越拉不動，永遠不超過上限', () => {
        expect(pullDamp(0)).toBe(0)
        expect(pullDamp(10)).toBeLessThan(10)
        expect(pullDamp(40) - pullDamp(20)).toBeLessThan(pullDamp(20))
        expect(pullDamp(10000)).toBeLessThan(LENS_CFG.pullMax)
        expect(pullDamp(10000)).toBeGreaterThan(LENS_CFG.pullMax * 0.99)
    })
})

describe('pullTransform', () => {
    const lo = 100, hi = 400

    it('手指在兩端之間：不變形', () => {
        expect(pullTransform(250, lo, hi, 250)).toEqual({ s: 1, t: 0 })
    })

    it('往後端拉：後端跟到被拉的距離，前端只跟著整列移 pullShare', () => {
        for (const o of [250, 130]) {
            const v = pullTransform(hi + 40, lo, hi, o)
            const p = pullDamp(40)
            expect(map(hi, o, v)).toBeCloseTo(hi + p)
            expect(map(lo, o, v)).toBeCloseTo(lo + p * LENS_CFG.pullShare)
            // 中心點的位移＝整列移動＋拉長的一半
            expect(map((lo + hi) / 2, o, v) - (lo + hi) / 2).toBeCloseTo(p * LENS_CFG.pullShare + (p * (1 - LENS_CFG.pullShare)) / 2)
        }
    })

    it('往前端拉：前端跟到，後端只跟著整列移', () => {
        const v = pullTransform(lo - 25, lo, hi, 250)
        expect(map(lo, 250, v)).toBeCloseTo(lo - pullDamp(25))
        expect(map(hi, 250, v)).toBeCloseTo(hi - pullDamp(25) * LENS_CFG.pullShare)
    })
})
