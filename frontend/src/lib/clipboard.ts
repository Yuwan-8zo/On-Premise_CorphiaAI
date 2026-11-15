/**
 * 複製文字到剪貼簿（全站共用）
 *   安全連線（https / localhost）用 Clipboard API；
 *   區網用 http 開啟時瀏覽器不給 Clipboard API，改用隱藏的 textarea＋execCommand 備援。
 * 成功回傳 true，失敗回傳 false；失敗時會跳出提示（不然按了沒反應，使用者以為複製好了）
 */
import i18n from '@/i18n'
import { useToastStore } from '@/store/toastStore'

/** 剪貼簿 API 最多等多久（毫秒）；要短到備援還在「使用者剛按下」的有效時間內 */
const CLIPBOARD_WAIT_MS = 800

export async function copyText(text: string): Promise<boolean> {
    const ok = await tryCopy(text)
    if (!ok) useToastStore.getState().add(i18n.t('common.copyFailed'), 'error')
    return ok
}

async function tryCopy(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // 有些環境（遠端桌面、瀏覽器權限卡住）會一直不回應：等一下沒結果就改用備援，不讓按鈕沒反應
            const done = await Promise.race([
                navigator.clipboard.writeText(text).then(() => true),
                new Promise<false>((resolve) => setTimeout(() => resolve(false), CLIPBOARD_WAIT_MS)),
            ])
            if (done) return true
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
