/**
 * 把 AI 寫的內容（程式碼、整則回答）存成檔案——程式碼區塊和回答工具列共用
 *
 *   桌面版   跳出系統的「另存新檔」，使用者選位置後寫到這台電腦（lib/desktop.ts → desktop/local_files.py）
 *   瀏覽器   沒有辦法直接寫使用者的資料夾，改成一般的下載
 *
 * 結果用提示訊息告訴使用者（存到哪、有沒有備份舊檔）；使用者按取消不算錯誤、不顯示任何訊息。
 */
import i18n from '@/i18n'
import { desktop } from '@/lib/desktop'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'

/** 存檔結果的提示停留多久（毫秒）：要讓使用者來得及讀完整的路徑 */
const SAVED_TOAST_MS = 6000

/** 程式碼區塊標的語言 → 副檔名；沒列到的當純文字 */
const LANGUAGE_EXT: Record<string, string> = {
    python: 'py', py: 'py', javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx',
    bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', powershell: 'ps1', ps1: 'ps1', bat: 'bat', cmd: 'bat',
    json: 'json', yaml: 'yml', yml: 'yml', toml: 'toml', ini: 'ini', xml: 'xml', csv: 'csv',
    sql: 'sql', html: 'html', css: 'css', scss: 'scss', markdown: 'md', md: 'md',
    java: 'java', kotlin: 'kt', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs',
    php: 'php', ruby: 'rb', swift: 'swift', r: 'r', dockerfile: 'Dockerfile',
}
const DEFAULT_EXT = 'txt'

/** 依語言給建議檔名（使用者在另存新檔視窗可以改） */
export function suggestFilename(language: string, base = 'code'): string {
    const ext = LANGUAGE_EXT[language.trim().toLowerCase()] ?? DEFAULT_EXT
    return ext === 'Dockerfile' ? ext : `${base}.${ext}`
}

function download(filename: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

/** 存檔。回傳 true＝存好了（或已交給瀏覽器下載）；false＝使用者取消或失敗（失敗會顯示原因） */
export async function saveTextFile(filename: string, content: string, isDesktop: boolean): Promise<boolean> {
    if (!isDesktop) {
        download(filename, content)
        return true
    }
    const toast = useToastStore.getState().add
    try {
        const saved = await desktop.saveFile(filename, content)
        if (!saved) return false
        toast(i18n.t(saved.backup ? 'ui.chat.codeFile.savedBackup' : 'ui.chat.codeFile.saved', { path: saved.path }), 'success', SAVED_TOAST_MS)
        return true
    } catch (err) {
        toast(getErrorMessage(err), 'error', SAVED_TOAST_MS)
        return false
    }
}
