/**
 * 後台「連接資料夾」的新增／編輯視窗
 *
 *   名稱 → 資料夾路徑（可直接貼上，或按「瀏覽」從伺服器上選）→ 路徑檢查結果（可不可以接、裡面有多少檔案）
 *   → 說明 → 誰可以使用（角色）→ AI 權限（只能讀／可產生新檔／可修改原檔）→ 包含子資料夾、自動更新、啟用
 *   路徑檢查通過才能儲存；檢查邏輯在 useAdminFolders。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { connectedFoldersApi, SCAN_INTERVALS, type BrowseResult, type FolderRole } from '@/api/connectedFolders'
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Folder, Loader2 } from '@/components/snow/icons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import GlassSwitch from '@/components/ui/GlassSwitch'
import StyledSelect from '@/components/ui/StyledSelect'
import { formatBytes } from '@/lib/formatBytes'
import { getErrorMessage } from '@/lib/errors'
import { ActionButton, Field, ModalFrame, inputClass } from './AdminPrimitives'
import type { useAdminFolders } from '../hooks/useAdminFolders'
import { FOLDER_ROLES, WRITE_MODES, roleLabel, scanIntervalLabel, writeModeHint, writeModeLabel } from '../utils/folderLabels'

/** 設定列：左邊文字（＋說明），右邊開關 */
function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[var(--r-16)] snow-field px-4 py-3">
            <span className="min-w-0">
                <span className="block text-sm text-text-primary">{label}</span>
                {hint && <span className="block text-xs text-text-secondary mt-0.5">{hint}</span>}
            </span>
            <GlassSwitch checked={checked} onChange={onChange} aria-label={label} />
        </div>
    )
}

/** 瀏覽伺服器上的資料夾：一層一層點進去，按「選這個資料夾」帶回路徑 */
function FolderBrowser({ start, onPick, onClose }: { start: string; onPick: (path: string) => void; onClose: () => void }) {
    const { t } = useTranslation()
    const [data, setData] = useState<BrowseResult | null>(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const open = async (path: string | null) => {
        setLoading(true)
        setError('')
        try {
            setData(await connectedFoldersApi.browse(path))
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }
    // 打開時：路徑欄有東西就從那裡開始，不然從各磁碟開始
    useEffect(() => { void open(start || null) }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="rounded-[var(--r-16)] snow-field p-2">
            <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                    type="button"
                    onClick={() => open(data?.parent ?? null)}
                    disabled={!data?.path || loading}
                    aria-label={t('admin.folders.browseUp')}
                    className="icon-tap text-text-secondary disabled:opacity-30"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-text-secondary" title={data?.path || ''}>{data?.path || t('admin.folders.browseRoot')}</span>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />}
            </div>
            <div className="max-h-[var(--sz-200)] overflow-y-auto overscroll-contain">
                {error && <p className="px-3 py-2 text-xs text-[var(--danger-ink)]">{error}</p>}
                {data?.dirs.length === 0 && !error && <p className="px-3 py-2 text-xs text-text-secondary">{t('admin.folders.browseEmpty')}</p>}
                {data?.dirs.map((d) => (
                    <button key={d.path} type="button" onClick={() => open(d.path)} className="menu-item w-full !justify-start">
                        <Folder className="h-4 w-4 shrink-0 text-accent" />
                        <span className="min-w-0 flex-1 truncate text-left">{d.name}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
                    </button>
                ))}
            </div>
            <div className="flex justify-end gap-2 px-1 pt-2">
                <ActionButton variant="secondary" onClick={onClose}>{t('common.cancel')}</ActionButton>
                <ActionButton onClick={() => data?.path && onPick(data.path)} disabled={!data?.path}>{t('admin.folders.browsePick')}</ActionButton>
            </div>
        </div>
    )
}

export function FolderFormModal({ folders }: { folders: ReturnType<typeof useAdminFolders> }) {
    const { t } = useTranslation()
    const { editing, form, setForm, isSubmitting, submit, setIsModalOpen, check, checking, canSubmit } = folders
    const [browsing, setBrowsing] = useState(false)
    useEffect(() => { if (!folders.isModalOpen) setBrowsing(false) }, [folders.isModalOpen])
    if (!folders.isModalOpen) return null
    const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }))
    const close = () => setIsModalOpen(false)
    const toggleRole = (role: FolderRole) =>
        set({ allowed_roles: form.allowed_roles.includes(role) ? form.allowed_roles.filter((r) => r !== role) : [...form.allowed_roles, role] })
    const types = check?.ok ? Object.entries(check.by_type).sort((a, b) => b[1] - a[1]).map(([ext, n]) => `${ext.slice(1).toUpperCase()} ${n}`).join('、') : ''

    return (
        <ModalFrame onClose={close} maxWidth="max-w-lg">
            <h3 className="mb-2 text-xl font-semibold">{editing ? t('admin.folders.editTitle') : t('admin.folders.addTitle')}</h3>
            <p className="mb-6 text-sm text-text-secondary">{t('admin.folders.modalDesc')}</p>
            <form onSubmit={submit} className="space-y-4">
                <Field label={t('admin.folders.name')}>
                    <input className={inputClass} required maxLength={100} placeholder={t('admin.folders.namePlaceholder')} value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>

                <div>
                    <Field label={t('admin.folders.path')}>
                        <div className="flex gap-2">
                            <input
                                className={`${inputClass} tabular-nums`}
                                required
                                spellCheck={false}
                                placeholder={t('admin.folders.pathPlaceholder')}
                                value={form.path}
                                onChange={(e) => set({ path: e.target.value })}
                            />
                            <ActionButton variant="secondary" onClick={() => setBrowsing((v) => !v)}>{t('admin.folders.browse')}</ActionButton>
                        </div>
                    </Field>
                    {browsing && (
                        <div className="mt-2">
                            <FolderBrowser start={form.path} onClose={() => setBrowsing(false)} onPick={(p) => { set({ path: p, name: form.name || p.split(/[\\/]/).filter(Boolean).pop() || '' }); setBrowsing(false) }} />
                        </div>
                    )}
                    {/* 路徑檢查結果：檢查中／不行（原因）／可以（檔案數、大小、類型） */}
                    <div className="mt-2 min-h-[var(--sz-20)] text-xs leading-[var(--lh-18)]" aria-live="polite">
                        {checking ? (
                            <span className="flex items-center gap-1.5 text-text-secondary"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('admin.folders.checking')}</span>
                        ) : check && !check.ok ? (
                            <span className="flex items-start gap-1.5 text-[var(--danger-ink)]"><AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{check.message}</span>
                        ) : check?.ok ? (
                            <span className="flex items-start gap-1.5 text-text-secondary">
                                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--ink-green)]" />
                                <span>
                                    {t('admin.folders.checkOk', { count: check.file_count, size: formatBytes(check.total_bytes) })}
                                    {types && `（${types}）`}
                                    {check.truncated && ` ${t('admin.folders.checkTruncated')}`}
                                    {check.unsupported_count + check.skipped_sensitive > 0 && <span className="block">{t('admin.folders.checkSkipped', { count: check.unsupported_count + check.skipped_sensitive })}</span>}
                                </span>
                            </span>
                        ) : null}
                    </div>
                </div>

                <Field label={t('admin.folders.description')}>
                    <textarea className={inputClass} rows={2} maxLength={500} placeholder={t('admin.folders.descriptionPlaceholder')} value={form.description} onChange={(e) => set({ description: e.target.value })} />
                </Field>

                <div>
                    <span className="mb-2 block text-xs font-semibold text-text-secondary">{t('admin.folders.whoCanUse')}</span>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t('admin.folders.whoCanUse')}>
                        {FOLDER_ROLES.map((r) => {
                            const on = form.allowed_roles.includes(r)
                            return (
                                <button key={r} type="button" aria-pressed={on} onClick={() => toggleRole(r)} className={`btn !h-[var(--sz-36)] !px-[var(--sp-16)] !text-[length:var(--fs-14)] ${on ? 'btn-primary' : 'btn-secondary'}`}>
                                    {on && <CheckCircle2 className="h-4 w-4" />}
                                    {roleLabel(r)}
                                </button>
                            )
                        })}
                    </div>
                    {form.allowed_roles.length === 0 && <p className="mt-1.5 text-xs text-[var(--danger-ink)]">{t('admin.folders.roleRequired')}</p>}
                </div>

                <div>
                    <span className="mb-2 block text-xs font-semibold text-text-secondary">{t('admin.folders.aiAccess')}</span>
                    <GlassSegmented
                        className="w-full h-[var(--sz-40)]"
                        value={form.write_mode}
                        onChange={(v) => set({ write_mode: v })}
                        options={WRITE_MODES.map((m) => ({ value: m, label: writeModeLabel(m) }))}
                    />
                    <p className="mt-2 text-xs leading-[var(--lh-18)] text-text-secondary">{writeModeHint(form.write_mode)}</p>
                </div>

                <SwitchRow label={t('admin.folders.includeSub')} checked={form.include_subfolders} onChange={() => set({ include_subfolders: !form.include_subfolders })} />

                <Field label={t('admin.folders.autoUpdate')}>
                    <StyledSelect
                        value={String(form.scan_interval_min)}
                        onChange={(v) => set({ scan_interval_min: Number(v) })}
                        options={SCAN_INTERVALS.map((m) => ({ value: String(m), label: scanIntervalLabel(m) }))}
                    />
                </Field>

                <SwitchRow label={t('admin.folders.enabled')} hint={t('admin.folders.enabledHint')} checked={form.is_enabled} onChange={() => set({ is_enabled: !form.is_enabled })} />

                <div className="flex gap-3 pt-4">
                    <ActionButton variant="secondary" onClick={close}>{t('common.cancel')}</ActionButton>
                    <ActionButton disabled={isSubmitting || !canSubmit}>{isSubmitting ? t('common.loading') : editing ? t('common.save') : t('admin.folders.connect')}</ActionButton>
                </div>
            </form>
        </ModalFrame>
    )
}
