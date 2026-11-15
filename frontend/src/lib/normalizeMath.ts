/**
 * AI 寫算式常用 \[ … \]、\( … \) 包起來，但公式排版（remark-math＋KaTeX）只認 $$ … $$。
 * 這裡把這兩種寫法換成 $$ … $$；程式碼區塊、行內程式碼裡的內容不動。
 * 單一個 $ 不當公式（$5 元這種金額才不會被吃掉），所以行內公式也用 $$ … $$。
 */

/** 整則訊息：程式碼以外的 \[…\] 換成獨立一行的公式、\(…\) 換成行內公式 */
export function normalizeMath(markdown: string): string {
    if (!/\\\[|\\\(/.test(markdown)) return markdown
    return markdown.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/).map((part, i) => {
        if (i % 2 === 1) return part // 程式碼
        return part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_m, math: string) => `\n$$\n${math.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_m, math: string) => `$$${math.trim()}$$`)
    }).join('')
}
