/** 連接資料夾的顯示文字（卡片和設定視窗共用） */
import i18n from '@/i18n'
import type { FolderRole, FolderWriteMode } from '@/api/connectedFolders'

/** 設定視窗裡可以勾的角色（engineer 是系統管理員，本來就都看得到，不用選） */
export const FOLDER_ROLES: FolderRole[] = ['user', 'admin']
export const WRITE_MODES: FolderWriteMode[] = ['read_only', 'output', 'approve']

export const roleLabel = (role: FolderRole) => i18n.t(`admin.folders.roles.${role}`)
export const folderRoleLabels = (roles: FolderRole[]) => roles.filter((r) => r !== 'engineer').map(roleLabel).join('、')
export const writeModeLabel = (mode: FolderWriteMode) => i18n.t(`admin.folders.writeMode.${mode}`)
export const writeModeHint = (mode: FolderWriteMode) => i18n.t(`admin.folders.writeModeHint.${mode}`)

/** 「每 10 分鐘更新」「每小時更新」「每天更新」 */
export function scanIntervalLabel(min: number): string {
    if (min % 1440 === 0) return i18n.t('admin.folders.interval.days', { count: min / 1440 })
    if (min % 60 === 0) return i18n.t('admin.folders.interval.hours', { count: min / 60 })
    return i18n.t('admin.folders.interval.minutes', { count: min })
}
