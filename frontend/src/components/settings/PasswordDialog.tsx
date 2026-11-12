/**
 * 修改密碼彈窗（Apple 表單：三個欄位一組清單，規則與強度放在組下說明，最下面一排按鈕）
 *   密碼規則逐條打勾；強度分四級（弱／中／強／很強）
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Eye, EyeOff, X } from '@/components/snow/icons'
import { authApi } from '@/api/auth'
import DialogShell from '@/components/ui/DialogShell'

const SPECIAL = /[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/

type Level = 'weak' | 'medium' | 'strong' | 'very_strong'
interface Strength { score: number; level: Level; failed: string[] }

const LEVEL_STYLE: Record<Level, { bar: string; key: string }> = {
    very_strong: { bar: 'bg-[var(--sys-green)]', key: 'settings.pwdStrengthVeryStrong' },
    strong: { bar: 'bg-light-accent', key: 'settings.pwdStrengthStrong' },
    medium: { bar: 'bg-[var(--sys-yellow)]', key: 'settings.pwdStrengthMedium' },
    weak: { bar: 'bg-[var(--sys-red)]', key: 'settings.pwdStrengthWeak' },
}

/** 規則（i18n key）與檢查方式 */
const RULES: Array<[string, (v: string) => boolean]> = [
    ['settings.pwdRuleLength', (v) => v.length >= 8],
    ['settings.pwdRuleUpper', (v) => /[A-Z]/.test(v)],
    ['settings.pwdRuleLower', (v) => /[a-z]/.test(v)],
    ['settings.pwdRuleNumber', (v) => /\d/.test(v)],
    ['settings.pwdRuleSpecial', (v) => SPECIAL.test(v)],
]

function measure(v: string): Strength {
    let score = 0
    if (v.length >= 8) score += 20
    if (v.length >= 12) score += 10
    if (v.length >= 16) score += 10
    if (/[a-z]/.test(v)) score += 15
    if (/[A-Z]/.test(v)) score += 15
    if (/\d/.test(v)) score += 15
    if (SPECIAL.test(v)) score += 15
    score = Math.min(score, 100)
    const level: Level = score >= 80 ? 'very_strong' : score >= 60 ? 'strong' : score >= 40 ? 'medium' : 'weak'
    return { score, level, failed: RULES.filter(([, ok]) => !ok(v)).map(([key]) => key) }
}

const DANGER = 'text-[var(--danger-ink,#ff4245)]'
const SUCCESS = 'text-[#30d158]'

export default function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation()
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const strength = next ? measure(next) : null

    // 成功後 3 秒自動關閉；先手動關掉或元件卸載時取消，不然重新打開會被舊的計時器關掉
    const closeTimer = useRef<number | undefined>(undefined)
    useEffect(() => () => window.clearTimeout(closeTimer.current), [])
    useEffect(() => { if (!open) window.clearTimeout(closeTimer.current) }, [open])

    const submit = async () => {
        setError('')
        setSuccess('')
        if (!current) return setError(t('settings.pwdReqCurrent'))
        if (!next) return setError(t('settings.pwdReqNew'))
        if (next !== confirm) return setError(t('settings.pwdReqNotMatch'))
        if (strength && strength.failed.length > 0) return setError(t('settings.pwdReqUnsafe'))

        setIsSaving(true)
        try {
            await authApi.changePassword(current, next)
            setSuccess(t('settings.pwdChangeSuccess'))
            setCurrent('')
            setNext('')
            setConfirm('')
            // 3 秒後自動關閉
            window.clearTimeout(closeTimer.current)
            closeTimer.current = window.setTimeout(() => {
                onClose()
                setSuccess('')
            }, 3000)
        } catch (err) {
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            setError(detail || t('settings.pwdChangeFail'))
        } finally {
            setIsSaving(false)
        }
    }

    /** 每次打開都是空白表單 */
    const resetAndClose = () => {
        onClose()
        setError('')
        setSuccess('')
        setCurrent('')
        setNext('')
        setConfirm('')
    }

    // 外殼共用 DialogShell（會放到 body，不受設定內容區的進場動畫影響）；疊在設定視窗上面，所以層級較高
    return (
        <DialogShell open={open} onClose={resetAndClose} layer="z-[60]" className="w-full max-w-[var(--sz-460)] flex flex-col">
            <button onClick={resetAndClose} aria-label={t('common.close', '關閉')} className="btn-icon dialog-close absolute text-text-secondary">
                <X className="w-5 h-5" />
            </button>

            <h3 className="dialog-title text-center">{t('auth.changePassword', '修改密碼')}</h3>

            <div className="set-group mt-5">
                <PwdRow label={t('settings.currentPassword')} value={current} onChange={(v) => { setCurrent(v); setError('') }} />
                <PwdRow label={t('settings.newPassword')} value={next} onChange={(v) => { setNext(v); setError(''); setSuccess('') }} />
                <PwdRow label={t('settings.confirmNewPassword')} value={confirm} onChange={(v) => { setConfirm(v); setError('') }} />
            </div>

            <div className="set-footer space-y-1.5">
                {RULES.map(([key]) => {
                    const passed = strength ? !strength.failed.includes(key) : null
                    return (
                        <div key={key} className={`flex items-center gap-1.5 ${passed === true ? SUCCESS : passed === false ? DANGER : ''}`}>
                            {passed === true ? <Check className="w-3.5 h-3.5 shrink-0" /> : passed === false ? <X className="w-3.5 h-3.5 shrink-0" /> : <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">·</span>}
                            <span>{t(key)}</span>
                        </div>
                    )
                })}
                {strength && (
                    <div className="pt-2">
                        <div className="flex items-center mb-1">
                            <span>{t('settings.pwdStrengthLabel')}</span>
                            <span className="ml-auto font-semibold text-text-primary">{t(LEVEL_STYLE[strength.level].key)}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--chip)] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-[width,background-color] duration-500 ${LEVEL_STYLE[strength.level].bar}`} style={{ width: `${strength.score}%` }} />
                        </div>
                    </div>
                )}
                {confirm && next !== confirm && <p className={`pt-1 ${DANGER}`}>{t('settings.pwdMismatch')}</p>}
            </div>

            {(error || success) && (
                <div className={`mt-4 flex items-center gap-2 text-[length:var(--fs-13)] font-medium ${error ? DANGER : SUCCESS}`}>
                    {error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                    {error || success}
                </div>
            )}

            <div className="dialog-actions">
                <button onClick={resetAndClose} className="btn btn-lg btn-secondary">{t('common.cancel', '取消')}</button>
                <button onClick={submit} disabled={isSaving || !current || !next || !confirm} className="btn btn-lg btn-primary">
                    {isSaving ? t('common.loading') : t('settings.pwdSubmit', '更改')}
                </button>
            </div>
        </DialogShell>
    )
}

/** 密碼欄位（Apple 表單列：左標籤、右輸入、最右顯示／隱藏） */
function PwdRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const { t } = useTranslation()
    const [visible, setVisible] = useState(false)
    return (
        <label className="set-row cursor-text">
            <span className="w-[var(--sz-96)] flex-none">{label}</span>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={t('ui.misc.required')}
                aria-label={label}
                className="flex-1 min-w-0 bg-transparent outline-none text-[length:var(--fs-15)] text-text-primary placeholder:text-text-muted"
            />
            {value.length > 0 && (
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={visible ? t('common.hidePassword', '隱藏密碼') : t('common.showPassword', '顯示密碼')}
                    onClick={() => setVisible((v) => !v)}
                    className="flex-none text-text-secondary"
                >
                    {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
            )}
        </label>
    )
}
