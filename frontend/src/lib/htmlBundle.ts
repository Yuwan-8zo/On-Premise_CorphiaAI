/**
 * 使用者附加的 HTML 直接在旁邊面板預覽：把一起附加、被它引用的 CSS／JavaScript 檔嵌進去
 *
 *   index.html 裡寫 <link rel="stylesheet" href="style.css"> 和 <script src="app.js"></script>，
 *   而 style.css、app.js 也在同一批附加的檔案裡 → 換成 <style>…</style>、<script>…</script>。
 *   預覽本身關在沙盒裡、不能連網（lib/previewDoc），所以外部檔案一定要先嵌進來才看得到樣式和互動。
 *   只在瀏覽器裡處理，不經過伺服器；找不到對應檔案的引用保持原樣（預覽裡就是沒有那個樣式）。
 */

const HTML_EXT = /\.(html?|xhtml)$/i

/** 只看檔名（去掉資料夾、查詢字串），比對不分大小寫 */
const baseName = (ref: string) => decodeURIComponent(ref.split(/[?#]/)[0].split(/[\\/]/).pop() || '').toLowerCase()

/** 嵌進 <script>／<style> 時，內容裡的結束標籤要拆開，不然會提早結束 */
const safeInline = (text: string, tag: 'script' | 'style') => text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`)

/** 讀檔案文字（舊環境沒有 File.text() 時改用 FileReader） */
function readText(file: File): Promise<string> {
    if (typeof file.text === 'function') return file.text()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error(reader.error?.message ?? 'read failed'))
        reader.readAsText(file)
    })
}

export interface HtmlBundle {
    name: string
    code: string
    /** 嵌進去的檔名（CSS、JS） */
    inlined: string[]
}

export function inlineAssets(html: string, assets: Map<string, string>): { code: string; inlined: string[] } {
    const inlined: string[] = []
    let code = html.replace(/<link\b[^>]*>/gi, (tag) => {
        if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag
        const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
        const css = href ? assets.get(baseName(href)) : undefined
        if (css === undefined) return tag
        inlined.push(baseName(href as string))
        return `<style>${safeInline(css, 'style')}</style>`
    })
    code = code.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, before: string, src: string, after: string) => {
        const js = assets.get(baseName(src))
        if (js === undefined) return tag
        inlined.push(baseName(src))
        const attrs = `${before} ${after}`.trim()
        return `<script${attrs ? ` ${attrs}` : ''}>${safeInline(js, 'script')}</script>`
    })
    return { code, inlined }
}

/** 這批附加的檔案裡有沒有 HTML；有就回第一份（已嵌入同批的 CSS／JS），沒有回 null */
export async function bundleHtml(files: File[]): Promise<HtmlBundle | null> {
    const page = files.find((f) => HTML_EXT.test(f.name))
    if (!page) return null
    const assets = new Map<string, string>()
    for (const f of files) {
        if (/\.(css|m?js)$/i.test(f.name)) assets.set(f.name.toLowerCase(), await readText(f))
    }
    const { code, inlined } = inlineAssets(await readText(page), assets)
    return { name: page.name, code, inlined }
}
