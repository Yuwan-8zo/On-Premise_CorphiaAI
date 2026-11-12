/**
 * FileAttachments — AI 產出的檔案（Word、Excel、簡報）：掛在那則回答下面的檔案卡片
 *
 *   每個檔案一張卡片：種類圖示、檔名、種類＋大小，右邊「下載」
 *   下載要帶登入憑證，所以不是普通連結：用 API 取回檔案再交給瀏覽器存檔（見 api/files.ts）
 *   只有產生檔案的本人下載得到（後端檢查）；失敗顯示原因
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { filesApi } from '@/api/files'
import { Download, FileText, Loader2 } from '@/components/snow/icons'
import { formatBytes } from '@/lib/formatBytes'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import type { MessageAttachment } from '@/types/chat'

export default function FileAttachments({ files }: { files: MessageAttachment[] }) {
    const { t } = useTranslation()
    const toast = useToastStore((s) => s.add)
    const [busy, setBusy] = useState<string | null>(null)

    const download = async (file: MessageAttachment) => {
        if (busy) return
        setBusy(file.id)
        try {
            await filesApi.download(file)
        } catch (err) {
            toast(getErrorMessage(err), 'error')
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="mt-[var(--sp-12)] flex flex-col gap-[var(--sp-8)]">
            {files.map((file) => (
                <div key={file.id} className="snow-well flex items-center gap-[var(--sp-12)] rounded-[var(--r-22)] p-[var(--sp-10)] pr-[var(--sp-12)] max-w-[var(--sz-420)]">
                    <span className="snow-row-icon !h-[var(--sz-44)] !w-[var(--sz-44)] !rounded-[var(--r-12)] text-accent"><FileText className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary" title={file.filename}>{file.filename}</span>
                        <span className="block text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-secondary tabular-nums">
                            {t(`ui.chat.fileKind.${file.kind}`, { defaultValue: file.kind.toUpperCase() })}{' · '}{formatBytes(file.size)}
                        </span>
                    </span>
                    <button type="button" onClick={() => download(file)} disabled={busy !== null} className="btn btn-sm btn-primary flex-shrink-0" aria-label={t('ui.chat.fileDownloadAria', { name: file.filename })}>
                        {busy === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t('ui.chat.fileDownload')}
                    </button>
                </div>
            ))}
        </div>
    )
}
