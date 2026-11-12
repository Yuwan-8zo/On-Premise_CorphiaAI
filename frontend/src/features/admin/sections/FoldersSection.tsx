/**
 * 後台「資料夾」分頁：管理員把伺服器上的資料夾（或公司 NAS）接給 AI 讀，不用一份一份上傳
 *
 *   每張卡片：名稱＋狀態、路徑、檔案數與大小、誰能用、AI 權限、多久更新、上次更新時間；右邊啟用開關、編輯、取消連接
 *   沒有資料夾時：說明這是做什麼的＋新增按鈕
 *   載入中：和卡片同一個外形的骨架
 */
import { useTranslation } from 'react-i18next'
import { AlertCircle, Folder, Plus } from '@/components/snow/icons'
import GlassSwitch from '@/components/ui/GlassSwitch'
import { SkelText } from '@/components/ui/Skeleton'
import type { ConnectedFolder, FolderStatus } from '@/api/connectedFolders'
import { ActionButton, Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { formatDate } from '@/features/admin/utils/formatDate'
import { formatBytes } from '@/lib/formatBytes'
import { folderRoleLabels, scanIntervalLabel, writeModeLabel } from '../utils/folderLabels'

export interface FoldersSectionProps {
    folders: ConnectedFolder[]
    loaded: boolean
    /** 讀不到清單的原因；有值就顯示錯誤和「重試」，不顯示「還沒有連接」 */
    loadError?: string
    onRetry: () => void
    onAdd: () => void
    onEdit: (item: ConnectedFolder) => void
    onToggle: (item: ConnectedFolder) => void
    onDisconnect: (item: ConnectedFolder) => void
}

const STATUS_TAG: Record<FolderStatus, string> = {
    pending: 'tag-orange',
    scanning: 'tag-accent',
    ready: 'tag-green',
    error: 'tag-red',
}

/** 卡片外框（真卡片和骨架共用，外形才會一樣） */
const cardClass = 'flex flex-col gap-3 rounded-[var(--admin-in)] border border-[var(--paper-line)] bg-[var(--chip)] p-5 md:flex-row md:items-center md:justify-between'
const metaClass = 'flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary'

export default function FoldersSection({ folders, loaded, loadError, onRetry, onAdd, onEdit, onToggle, onDisconnect }: FoldersSectionProps) {
    const { t } = useTranslation()

    return (
        <div className="h-full">
            <Panel className="admin-fill">
                <SectionHeader
                    title={t('admin.folders.title')}
                    eyebrow={loaded ? t('admin.folders.count', { count: folders.length }) : <SkelText>{t('admin.folders.count', { count: 0 })}</SkelText>}
                    // 還沒有資料夾時，中間的說明已經有「連接資料夾」，右上角不重複放
                    action={loaded && (folders.length === 0 || loadError) ? undefined : (
                        <ActionButton onClick={onAdd}>
                            <Plus className="h-4 w-4" />
                            {t('admin.folders.add')}
                        </ActionButton>
                    )}
                />
                <div className="admin-fill-body grid content-start gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                    {!loaded ? (
                        [0, 1].map((i) => (
                            <div key={i} aria-hidden className={cardClass}>
                                <div className="min-w-0 flex-1 flex flex-col gap-2">
                                    <p className="text-lg font-semibold"><SkelText>000000 0000</SkelText></p>
                                    <p className="text-[length:var(--fs-13)]"><SkelText>D:\00000\00000000</SkelText></p>
                                    <p className={metaClass}><SkelText>000 0000 · 000 MB  000000  0000000</SkelText></p>
                                </div>
                                <span className="btn btn-secondary !h-[var(--sz-40)] !px-[var(--sp-18)] !text-[length:var(--fs-14)] shrink-0"><SkelText>{t('common.edit')}</SkelText></span>
                            </div>
                        ))
                    ) : loadError ? (
                        <div role="alert" className="flex flex-col items-center text-center gap-3 py-[var(--sp-48)] px-[var(--sp-24)]">
                            <span className="snow-row-icon !w-[var(--sz-52)] !h-[var(--sz-52)] !rounded-[var(--r-18)] text-[var(--danger-ink)]"><AlertCircle className="w-6 h-6" /></span>
                            <p className="text-[length:var(--fs-17)] font-semibold text-text-primary">{t('admin.folders.loadFailed')}</p>
                            <p className="max-w-[var(--sz-420)] text-[length:var(--fs-15)] leading-[var(--lh-22)] text-text-secondary">{loadError}</p>
                            <ActionButton variant="secondary" onClick={onRetry}>{t('common.retry')}</ActionButton>
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="flex flex-col items-center text-center gap-3 py-[var(--sp-48)] px-[var(--sp-24)]">
                            <span className="snow-row-icon !w-[var(--sz-52)] !h-[var(--sz-52)] !rounded-[var(--r-18)] text-accent"><Folder className="w-6 h-6" /></span>
                            <p className="text-[length:var(--fs-17)] font-semibold text-text-primary">{t('admin.folders.emptyTitle')}</p>
                            <p className="max-w-[var(--sz-420)] text-[length:var(--fs-15)] leading-[var(--lh-22)] text-text-secondary">{t('admin.folders.emptyDesc')}</p>
                            <ActionButton onClick={onAdd}>
                                <Plus className="h-4 w-4" />
                                {t('admin.folders.add')}
                            </ActionButton>
                        </div>
                    ) : (
                        folders.map((f) => (
                            <div key={f.id} className={`${cardClass} ${f.is_enabled ? '' : 'opacity-60'}`}>
                                <div className="min-w-0 flex-1 flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Folder className="h-4 w-4 shrink-0 text-accent" />
                                        <p className="truncate text-lg font-semibold text-text-primary">{f.name}</p>
                                        <span className={`tag ${f.is_enabled ? STATUS_TAG[f.status] : ''}`}>
                                            {f.is_enabled ? t(`admin.folders.status.${f.status}`) : t('common.disabled')}
                                        </span>
                                    </div>
                                    <p className="truncate text-[length:var(--fs-13)] tabular-nums text-text-secondary" title={f.path}>{f.path}</p>
                                    {f.description && <p className="text-[length:var(--fs-13)] text-text-secondary">{f.description}</p>}
                                    <p className={metaClass}>
                                        <span>{t('admin.folders.files', { count: f.file_count })} · {formatBytes(f.total_bytes)}</span>
                                        <span>{t('admin.folders.whoCanUse')}：{folderRoleLabels(f.allowed_roles)}</span>
                                        <span>{t('admin.folders.aiAccess')}：{writeModeLabel(f.write_mode)}</span>
                                        <span>{scanIntervalLabel(f.scan_interval_min)}</span>
                                        <span>{f.last_scan_at ? t('admin.folders.lastScan', { time: formatDate(f.last_scan_at) }) : t('admin.folders.notIndexed')}</span>
                                    </p>
                                    {f.status === 'error' && f.error_message && (
                                        <p className="text-[length:var(--fs-13)] text-[var(--danger-ink)]">{f.error_message}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <GlassSwitch checked={f.is_enabled} onChange={() => onToggle(f)} aria-label={t('admin.folders.enabledFor', { name: f.name })} />
                                    <ActionButton variant="secondary" onClick={() => onEdit(f)}>{t('common.edit')}</ActionButton>
                                    <ActionButton variant="danger" onClick={() => onDisconnect(f)}>{t('admin.folders.disconnect')}</ActionButton>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Panel>
        </div>
    )
}
