import { describe, expect, it } from 'vitest'
import { bundleHtml, inlineAssets } from '@/lib/htmlBundle'

const file = (name: string, text: string) => new File([text], name)

describe('htmlBundle：附加的 HTML 連同 CSS／JS 一起預覽', () => {
    it('同批附加的 CSS、JS 會嵌進 HTML', async () => {
        const out = await bundleHtml([
            file('index.html', '<html><head><link rel="stylesheet" href="./css/Style.css"></head><body><script src="app.js?v=2"></script></body></html>'),
            file('style.css', 'body{color:red}'),
            file('app.js', 'document.body.dataset.ok = "1"'),
        ])
        expect(out?.name).toBe('index.html')
        expect(out?.code).toContain('<style>body{color:red}</style>')
        expect(out?.code).toContain('<script>document.body.dataset.ok = "1"</script>')
        expect(out?.code).not.toContain('href=')
        expect(out?.inlined.sort()).toEqual(['app.js', 'style.css'])
    })

    it('沒附加的外部檔案保持原樣', () => {
        const { code, inlined } = inlineAssets('<link rel="stylesheet" href="missing.css"><script src="x.js"></script>', new Map())
        expect(code).toContain('missing.css')
        expect(inlined).toEqual([])
    })

    it('內容裡的結束標籤不會讓嵌入提早結束', () => {
        const { code } = inlineAssets('<script src="a.js"></script>', new Map([['a.js', 'const s = "</script>"']]))
        expect(code).toBe('<script>const s = "<\\/script>"</script>')
    })

    it('沒有 HTML 就不預覽', async () => {
        expect(await bundleHtml([file('a.css', 'x'), file('b.txt', 'y')])).toBeNull()
    })
})
