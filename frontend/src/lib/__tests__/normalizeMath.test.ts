import { describe, expect, it } from 'vitest'
import { normalizeMath } from '../normalizeMath'

describe('normalizeMath', () => {
    it('方括號寫法換成獨立一行的公式、圓括號寫法換成行內公式', () => {
        const out = normalizeMath(String.raw`圓角：\[ r = b + o \] 其中 \(o\) 是凸出量`)
        expect(out).toContain('\n$$\nr = b + o\n$$\n')
        expect(out).toContain('$$o$$')
    })
    it('程式碼裡的不動', () => {
        const md = '```\n' + String.raw`\[ x \]` + '\n```\n`' + String.raw`\(y\)` + '`'
        expect(normalizeMath(md)).toBe(md)
    })
})
