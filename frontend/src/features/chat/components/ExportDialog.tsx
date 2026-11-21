/**
 * 匯出對話：Word／PDF／Markdown 三選一
 *   從對話的「⋯」選單打開（hooks/exportDialogStore 的 openExportDialog）；檔案由後端產生，每次匯出都寫稽核紀錄
 *   Word：後端排好的 .docx；Markdown：.md；PDF：拿同一份 Markdown 用聊天畫面的樣式排版，交給瀏覽器列印成 PDF
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DialogShell from '@/components/ui/DialogShell'
import { Download, FileText } from '@/components/snow/icons'
import { conversationsApi } from '@/api/conversations'
import { downloadBlob } from '@/lib/download'
import { printMarkdown } from '../utils/printMarkdown'
import { useToastStore } from '@/store/toastStore'
import { useChatStore } from '@/store/chatStore'
import { SHEET_W } from './ChatModals'
import { closeExportDialog, useExportDialog } from '../hooks/exportDialogStore'

const close = closeExportDialog

type Format = 'docx' | 'pdf' | 'markdown'
const FORMATS: Format[] = ['docx', 'pdf', 'markdown']
const EXT: Record<Format, string> = { docx: 'docx', pdf: 'pdf', markdown: 'md' }

const safeName = (title: string) => title.replace(/[\\/:*?"<>|\r\n\t]/g, ' ').trim().slice(0, 60) || 'Corphia'

export default function ExportDialog() {
    const { t } = useTranslation()
    const id = useExportDialog((s) => s.id)
    const title = useChatStore((s) => s.conversations.find((c) => c.id === id)?.title ?? '')
    const [busy, setBusy] = useState<Format | null>(null)

    const run = async (format: Format) => {
        if (!id || busy) return
        setBusy(format)
        try {
            const blob = await conversationsApi.export(id, format)
            if (format === 'pdf') {
                close()
                await printMarkdown(await blob.text(), safeName(title))
            } else {
                downloadBlob(blob, `${safeName(title)}.${EXT[format]}`)
                close()
                useToastStore.getState().success(t('ui.export.done'))
            }
        } catch {
            useToastStore.getState().error(t('ui.export.failed'))
        } finally {
            setBusy(null)
        }
    }

    return (
        <DialogShell open={!!id} onClose={close} layer="z-[200]" className={SHEET_W} labelledBy="export-title">
            <div className="px-2">
                <h3 id="export-title" className="dialog-title !px-0 mb-1">{t('ui.export.title')}</h3>
                <p className="mb-4 text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{t('ui.export.audited')}</p>
                <div className="export-list paper">
                    {FORMATS.map((f) => (
                        <button key={f} type="button" className="export-row" disabled={!!busy} onClick={() => void run(f)}>
                            {f === 'markdown' ? <FileText aria-hidden /> : <Download aria-hidden />}
                            <span className="flex-1 text-left">
                                <span className="block font-semibold">{t(`ui.export.${f}`)}</span>
                                <span className="block text-[length:var(--fs-13)] text-text-secondary">{t(`ui.export.${f}Hint`)}</span>
                            </span>
                            {busy === f && <span className="text-[length:var(--fs-13)] text-text-secondary">{t('common.loading')}</span>}
                        </button>
                    ))}
                </div>
            </div>
            <div className="dialog-actions">
                <button type="button" onClick={close} className="btn btn-lg btn-secondary">{t('common.cancel')}</button>
            </div>
        </DialogShell>
    )
}
