import { describe, expect, it } from 'vitest'
import { escapeHtml, isQuoted, normalizeForMatch } from '../citeHighlight'

describe('引用原文標記', () => {
    const quote = normalizeForMatch('第三條　員工發現疑似資訊安全事件時，應於一小時內通報資訊部，\n並依本辦法第五條之等級處理。')
    it('PDF 一行在引用段落裡（空白、標點不同也算）', () => {
        expect(isQuoted('員工發現疑似資訊安全事件時，', quote)).toBe(true)
        expect(isQuoted('應於 一小時內 通報資訊部', quote)).toBe(true)
    })
    it('不在段落裡的不標', () => {
        expect(isQuoted('第七條　事件處理完畢後', quote)).toBe(false)
    })
    it('太短的（頁碼、單字）不標，避免到處誤中', () => {
        expect(isQuoted('3', quote)).toBe(false)
        expect(isQuoted('第三', quote)).toBe(false)
    })
    it('別頁剛好也有的短詞不標（例如「一小時內」）', () => {
        expect(isQuoted('一小時內', quote)).toBe(false)
        expect(isQuoted('資訊安全事件', quote)).toBe(false)
    })
    it('Markdown 表格符號不影響比對', () => {
        const q = normalizeForMatch('| 一級 | 1 小時 | 資訊部 |')
        expect(isQuoted('一級 1 小時 資訊部', q)).toBe(true)
    })
    it('跳脫 HTML', () => {
        expect(escapeHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;')
    })
})
