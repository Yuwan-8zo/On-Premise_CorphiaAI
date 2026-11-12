/**
 * ProjectInstructionsModal — 專案的自訂指示：這個專案資料夾裡每一題都會附給 AI 的固定說明
 *   例如「一律用條列式回答」「引用文件時寫出條號」。只影響這個專案，不影響一般對話和別的專案。
 *
 *   打開時讀目前的內容；儲存時後端會先過安全檢查（個資遮罩；含違禁詞或像在改寫安全規則的不收，原因顯示在下方）
 *   清空後儲存＝清除指示
 *   讀不到目前的內容時不能編輯、不能儲存：不然畫面是空的，一按儲存就把原本的指示清掉了
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { foldersApi, FOLDER_INSTRUCTIONS_MAX } from '@/api/folders'
import DialogShell from '@/components/ui/DialogShell'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { DialogActions, INPUT_CLASS } from './ChatModals'

interface Props {
    /** 要設定的專案資料夾名稱；null＝關閉 */
    folder: string | null
    onClose: () => void
}

export default function ProjectInstructionsModal({ folder, onClose }: Props) {
    const { t } = useTranslation()
    const toast = useToastStore((s) => s.add)
    const [text, setText] = useState('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    /** 目前的內容讀不到（連線失敗）：鎖住輸入與儲存 */
    const [loadFailed, setLoadFailed] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (!folder) return
        let stale = false
        setText('')
        setError('')
        setLoadFailed(false)
        setLoading(true)
        foldersApi.list()
            .then((list) => { if (!stale) setText(list.find((f) => f.name === folder)?.instructions || '') })
            .catch(() => { if (!stale) { setLoadFailed(true); setError(t('chat.instructionsLoadFailed')) } })
            .finally(() => { if (!stale) { setLoading(false); setTimeout(() => inputRef.current?.focus(), 0) } })
        return () => { stale = true }
    }, [folder, t])

    const save = async () => {
        if (!folder || saving || loading || loadFailed) return
        setSaving(true)
        setError('')
        try {
            await foldersApi.setInstructions(folder, text)
            toast(t(text.trim() ? 'chat.instructionsSaved' : 'chat.instructionsCleared'), 'success')
            onClose()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <DialogShell open={!!folder} onClose={onClose} layer="z-[200]" className="w-[var(--sz-420)] max-w-[calc(100vw-32px)]">
            <div className="px-2">
                <h3 className="dialog-title !px-0 mb-1">{t('chat.instructionsTitle')}</h3>
                <p className="mb-3 truncate text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{folder}</p>
                <textarea
                    ref={inputRef}
                    value={text}
                    rows={6}
                    maxLength={FOLDER_INSTRUCTIONS_MAX}
                    disabled={loading || loadFailed}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('chat.instructionsPlaceholder')}
                    aria-label={t('chat.instructionsTitle')}
                    className={`${INPUT_CLASS} resize-none !rounded-[var(--r-16)] !h-auto !py-[var(--sp-10)] leading-[var(--lh-22)]`}
                />
                <p className={`mt-2 min-h-[var(--lh-18)] text-[length:var(--fs-12)] leading-[var(--lh-18)] ${error ? 'text-[var(--danger-ink)]' : 'text-text-secondary'}`} role={error ? 'alert' : undefined}>
                    {error || t('chat.instructionsHint', { n: text.length, max: FOLDER_INSTRUCTIONS_MAX })}
                </p>
            </div>
            <DialogActions onCancel={onClose} onOk={save} okLabel={saving ? t('common.loading') : t('common.save')} />
        </DialogShell>
    )
}
