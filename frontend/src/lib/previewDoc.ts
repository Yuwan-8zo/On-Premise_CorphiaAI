/**
 * AI 寫的 HTML／SVG 直接預覽：把程式碼包成一份「關在沙盒裡」的文件
 *
 * 預覽的內容是模型寫的，當成不可信的東西處理，兩道限制一起用：
 *   1. 預覽框用 sandbox="allow-scripts"（沒有 allow-same-origin）：它拿不到這個系統的登入資料、對話內容，
 *      不能開新視窗、不能送出表單、不能把整個頁面帶走
 *   2. 文件最前面放一條內容安全政策：不能連任何網路（外部的程式、圖片、字型、API 全部擋掉），
 *      只能用寫在同一份程式碼裡的東西——資料不會被預覽的內容送出去
 */

/** 預覽文件自己的內容安全政策：預設全部禁止，只開放寫在文件裡的程式、樣式，和內嵌的圖片／字型 */
export const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:"

/** 預覽框的沙盒權限：只允許執行程式（互動才會動），其他都不給 */
export const PREVIEW_SANDBOX = 'allow-scripts'

const PREVIEWABLE = new Set(['html', 'htm', 'svg', 'xml'])

/** 這個程式碼區塊能不能預覽：標成 html／svg，或沒標語言但內容明顯是整頁 HTML／一張 SVG */
export function isPreviewable(language: string, code: string): boolean {
    const lang = language.trim().toLowerCase()
    const head = code.trimStart().slice(0, 200).toLowerCase()
    if (lang === 'xml' || lang === '') return head.startsWith('<svg') || (lang === '' && (head.startsWith('<!doctype html') || head.startsWith('<html')))
    return PREVIEWABLE.has(lang)
}

/** 包成預覽用的整份文件（政策一定放在最前面，後面的內容改不掉它） */
export function buildPreviewDoc(code: string): string {
    const policy = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`
    const isSvg = code.trimStart().toLowerCase().startsWith('<svg')
    const base = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    // SVG：置中顯示；HTML：原樣放進去（瀏覽器會自己整理成完整的文件）
    const style = isSvg
        ? '<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100%}</style>'
        : '<style>html{background:#fff;color:#000}</style>'
    return `<!doctype html>${policy}${base}${style}${code}`
}
