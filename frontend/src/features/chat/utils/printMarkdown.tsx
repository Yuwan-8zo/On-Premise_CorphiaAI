/**
 * 把一段 Markdown 排好版面，交給瀏覽器「列印」（選「另存為 PDF」就是 PDF 檔）——內網不用另外裝 PDF 引擎
 *
 *   await printMarkdown(markdown, '預算討論')
 *
 * 做法：在 body 最後放一個 #print-root，用聊天畫面同一個 MarkdownRenderer 畫出來（表格、程式碼、公式都一樣），
 * 列印時只印這一塊（樣式見 styles/snow/extras.css 的 @media print），印完就拿掉。
 */
import { createRoot } from 'react-dom/client'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { TABLE_SETTLE_MS } from '@/lib/tableData'

/** 畫完之後等多久再叫出列印視窗：表格的長條圖要等表格停止變動才畫，再加一點讓公式、字型、圖表程式載入排好 */
const SETTLE_MS = TABLE_SETTLE_MS + 500

export async function printMarkdown(markdown: string, title: string) {
    const host = document.createElement('div')
    host.id = 'print-root'
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(<MarkdownRenderer content={markdown} />)
    await new Promise((r) => setTimeout(r, SETTLE_MS))
    await document.fonts?.ready

    const oldTitle = document.title
    document.title = title // 存成 PDF 時預設檔名用對話標題
    document.documentElement.classList.add('is-printing')
    const cleanup = () => {
        document.documentElement.classList.remove('is-printing')
        document.title = oldTitle
        root.unmount()
        host.remove()
        window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
}
