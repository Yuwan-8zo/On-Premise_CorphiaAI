/**
 * 後台「資料夾」分頁：管理員把伺服器上的資料夾（或公司 NAS）接給 AI 讀，不用一份一份上傳
 *
 * 一頁放得下、不捲動：卡片排成「田」字四格（.admin-quads，和租戶同一套），每張卡片：
 *   上：資料夾名稱＋狀態，右邊編輯、取消連接（圖示鈕）
 *   中：路徑；四格數字（檔案、大小、誰可以用、AI 權限）
 *   下：建立索引中＝進度條；讀取失敗的提醒
 *   底：啟用開關＋上次更新時間與更新頻率、立即更新
 * 手機只留名稱、狀態和底下那一列（路徑和四格數字點「編輯」看），四張一頁放得下
 * 沒有資料夾：說明＋新增鈕；載入中：同外形骨架；讀不到：錯誤＋重試
 */
import { useTranslation } from 'react-i18next'
import { AlertCircle, Edit2, Folder, Plus, RefreshCw, Trash2 } from '@/components/snow/icons'
import GlassSwitch from '@/components/ui/GlassSwitch'
import Tooltip from '@/components/ui/Tooltip'
import { SkelText } from '@/components/ui/Skeleton'
import type { ConnectedFolder, FolderStatus } from '@/api/connectedFolders'
import { ActionButton, Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { formatDate } from '@/features/admin/utils/formatDate'
import { formatBytes } from '@/lib/formatBytes'
import { folderRoleLabels, scanIntervalLabel, writeModeLabel } from '../utils/folderLabels'
import { isIndexing } from '../hooks/useAdminFolders'

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
    onScan: (item: ConnectedFolder) => void
}

const STATUS_TAG: Record<FolderStatus, string> = {
    pending: 'tag-orange',
    scanning: 'tag-accent',
    ready: 'tag-green',
    error: 'tag-red',
}

/** 卡片外框（真卡片和骨架共用，外形才會一樣） */
// 每一列都 shrink-0：卡片高度不夠時寧可整張變高，也不要把路徑那一列壓扁（truncate 的列最小高度是 0，會被擠）
const cardClass = 'snow-well rounded-[var(--admin-in)] p-[var(--sp-12)] sm:p-[var(--sp-16)] flex flex-col gap-[var(--sp-4)] sm:gap-[var(--sp-10)] min-w-0 [&>*]:shrink-0'
/** 四格數字：寬畫面固定一列四格（不換列，卡片才不會變高）；手機不顯示（點「編輯」看） */
const statsClass = 'hidden sm:grid grid-cols-4 gap-[var(--sp-10)]'
const statLabel = 'text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium text-text-secondary'
const statValue = 'mt-0.5 truncate text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary'
const noteClass = 'text-[length:var(--fs-13)] leading-[var(--lh-18)]'

/** 四格數字的一格 */
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <p className={statLabel}>{label}</p>
            <p className={statValue}>{value}</p>
        </div>
    )
}

export default function FoldersSection({ folders, loaded, loadError, onRetry, onAdd, onEdit, onToggle, onDisconnect, onScan }: FoldersSectionProps) {
    const { t } = useTranslation()
    const empty = loaded && (folders.length === 0 || !!loadError)

    return (
        <div className="h-full">
            <Panel className="admin-fill">
                <SectionHeader
                    inlineAction
                    title={t('admin.folders.title')}
                    eyebrow={loaded ? t('admin.folders.count', { count: folders.length }) : <SkelText>{t('admin.folders.count', { count: 0 })}</SkelText>}
                    // 還沒有資料夾時，中間的說明已經有「連接資料夾」，右上角不重複放
                    action={empty ? undefined : (
                        <ActionButton onClick={onAdd}>
                            <Plus className="h-4 w-4" />
                            {t('admin.folders.add')}
                        </ActionButton>
                    )}
                />
                {!loaded ? (
                    <div className="admin-fill-body admin-quads grid content-start gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                        {[0, 1].map((i) => (
                            <div key={i} aria-hidden className={cardClass}>
                                <p className="text-lg font-semibold"><SkelText>000000 0000</SkelText></p>
                                <p className={noteClass}><SkelText>D:\00000\00000000</SkelText></p>
                                <div className={statsClass}>
                                    {[0, 1, 2, 3].map((j) => <Stat key={j} label="0000" value={<SkelText>0000</SkelText>} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : loadError ? (
                    <div role="alert" className="admin-fill-body flex flex-col items-center justify-center text-center gap-3 px-[var(--sp-24)]">
                        <span className="snow-row-icon !w-[var(--sz-52)] !h-[var(--sz-52)] !rounded-[var(--r-18)] text-[var(--danger-ink)]"><AlertCircle className="w-6 h-6" /></span>
                        <p className="text-[length:var(--fs-17)] font-semibold text-text-primary">{t('admin.folders.loadFailed')}</p>
                        <p className="max-w-[var(--sz-420)] text-[length:var(--fs-15)] leading-[var(--lh-22)] text-text-secondary">{loadError}</p>
                        <ActionButton variant="secondary" onClick={onRetry}>{t('common.retry')}</ActionButton>
                    </div>
                ) : folders.length === 0 ? (
                    <div className="admin-fill-body flex flex-col items-center justify-center text-center gap-3 px-[var(--sp-24)]">
                        <span className="snow-row-icon !w-[var(--sz-52)] !h-[var(--sz-52)] !rounded-[var(--r-18)] text-accent"><Folder className="w-6 h-6" /></span>
                        <p className="text-[length:var(--fs-17)] font-semibold text-text-primary">{t('admin.folders.emptyTitle')}</p>
                        <p className="max-w-[var(--sz-420)] text-[length:var(--fs-15)] leading-[var(--lh-22)] text-text-secondary">{t('admin.folders.emptyDesc')}</p>
                        <ActionButton onClick={onAdd}>
                            <Plus className="h-4 w-4" />
                            {t('admin.folders.add')}
                        </ActionButton>
                    </div>
                ) : (
                    <div className="admin-fill-body admin-quads grid content-start gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                        {folders.map((f) => {
                            const indexing = isIndexing(f)
                            const done = f.indexed_count + f.failed_count
                            return (
                                <div key={f.id} className={`${cardClass} ${f.is_enabled ? '' : 'opacity-60'}`}>
                                    {/* 上：名稱＋狀態，右邊編輯、取消連接 */}
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Folder className="h-4 w-4 shrink-0 text-accent" />
                                        <p className="truncate text-lg font-semibold text-text-primary" title={f.description || f.name}>{f.name}</p>
                                        <span className={`tag shrink-0 ${f.is_enabled ? STATUS_TAG[indexing ? 'scanning' : f.status] : ''}`}>
                                            {!f.is_enabled
                                                ? t('common.disabled')
                                                : indexing
                                                  ? t('admin.folders.indexingProgress', { done, total: f.file_count })
                                                  : t(`admin.folders.status.${f.status}`)}
                                        </span>
                                        <div className="ml-auto flex items-center gap-1 shrink-0">
                                            <Tooltip label={t('common.edit')}>
                                                <button type="button" onClick={() => onEdit(f)} aria-label={t('common.edit')} className="icon-tap text-text-secondary">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                            </Tooltip>
                                            <Tooltip label={t('admin.folders.disconnect')}>
                                                <button type="button" onClick={() => onDisconnect(f)} aria-label={t('admin.folders.disconnect')} className="icon-tap text-[var(--danger-ink)]">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                    {/* 中：路徑、四格數字 */}
                                    <p className={`${noteClass} hidden sm:block truncate tabular-nums text-text-secondary`} title={f.path}>{f.path}</p>
                                    <div className={statsClass}>
                                        <Stat label={t('admin.folders.statFiles')} value={f.file_count.toLocaleString()} />
                                        <Stat label={t('admin.folders.statSize')} value={formatBytes(f.total_bytes)} />
                                        <Stat label={t('admin.folders.whoCanUse')} value={folderRoleLabels(f.allowed_roles)} />
                                        <Stat label={t('admin.folders.aiAccess')} value={writeModeLabel(f.write_mode)} />
                                    </div>
                                    {/* 下：進度或上次更新；讀取失敗、錯誤的提醒 */}
                                    {indexing && f.file_count > 0 && (
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--chip)]" role="progressbar" aria-valuemin={0} aria-valuemax={f.file_count} aria-valuenow={done}>
                                            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (done / f.file_count) * 100)}%` }} />
                                        </div>
                                    )}
                                    {f.error_message && (
                                        <p className={`${noteClass} truncate ${f.status === 'error' ? 'text-[var(--danger-ink)]' : 'text-[var(--ink-orange)]'}`} title={f.error_message}>{f.error_message}</p>
                                    )}
                                    {/* 底：啟用開關＋上次更新、更新頻率（同一列，省一列高度），右邊立即更新 */}
                                    <div className="mt-auto flex items-center gap-2 sm:pt-[var(--sp-2)] min-w-0">
                                        <GlassSwitch checked={f.is_enabled} onChange={() => onToggle(f)} aria-label={t('admin.folders.enabledFor', { name: f.name })} />
                                        <p className={`${noteClass} min-w-0 flex-1 truncate text-text-secondary`}>
                                            {f.last_scan_at ? t('admin.folders.lastScan', { time: formatDate(f.last_scan_at) }) : t('admin.folders.notIndexed')}
                                            <span className="hidden sm:inline">{' · '}{scanIntervalLabel(f.scan_interval_min)}</span>
                                        </p>
                                        <ActionButton variant="secondary" onClick={() => onScan(f)} disabled={!f.is_enabled || indexing}>
                                            <RefreshCw className={`h-4 w-4 ${indexing ? 'animate-spin' : ''}`} aria-label={indexing ? t('admin.folders.updating') : t('admin.folders.updateNow')} />
                                            {/* 手機只留圖示，省寬度 */}
                                            <span className="hidden sm:inline">{indexing ? t('admin.folders.updating') : t('admin.folders.updateNow')}</span>
                                        </ActionButton>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Panel>
        </div>
    )
}
