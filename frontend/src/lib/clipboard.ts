/**
 * 複製文字到剪貼簿（全站共用）
 *   安全連線（https / localhost）用 Clipboard API；
 *   區網用 http 開啟時瀏覽器不給 Clipboard API，改用隱藏的 textarea＋execCommand 備援。
 * 成功回傳 true，失敗回傳 false（呼叫端決定要不要提示）
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // 往下走備援
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-999999px'
    document.body.appendChild(ta)
    ta.select()
    try {
        return document.execCommand('copy')
    } catch {
        return false
    } finally {
        ta.remove()
    }
}
