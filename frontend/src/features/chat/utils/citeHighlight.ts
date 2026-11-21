/**
 * 引用原文預覽：判斷 PDF 上的一段文字是不是被引用的那段
 *
 * 檢索到的段落文字（可能是 Docling 轉的 Markdown）和 PDF 一行一行的文字不會一模一樣：
 * 空白、換行、Markdown 符號（| # * -）都不同。所以兩邊都先「正規化」（只留文字和數字），
 * 再看 PDF 這一行是不是出現在引用段落裡。太短的行（例如頁碼、單一個字）很容易誤中，不標。
 */

/** 只留下文字和數字（去掉空白、標點、Markdown 符號），英文轉小寫 */
export function normalizeForMatch(text: string): string {
    return (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/** PDF 這一行算不算在引用段落裡（quoteNorm 是 normalizeForMatch 過的引用段落） */
export function isQuoted(line: string, quoteNorm: string, minLen = 4): boolean {
    const n = normalizeForMatch(line)
    return n.length >= minLen && quoteNorm.includes(n)
}

/** 跳脫 HTML（react-pdf 的 customTextRenderer 回傳的是 HTML 字串） */
export function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
