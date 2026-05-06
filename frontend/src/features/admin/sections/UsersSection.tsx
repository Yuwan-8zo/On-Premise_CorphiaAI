/**
 * Admin > Users tab
 * -----------------
 * 重寫版本，加入：
 * - 鎖定狀態（已鎖定 / 失敗警告 / 正常）
 * - 最後登入相對時間（3 小時前、2 天前 etc）
 * - 強制登出按鈕
 */

import { Plus, Trash2, UserRoundCog, LogOut, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import {
    Panel,
    SectionHeader,
    ActionButton,
    StatusPill,
    RoleBadge,
    formatDate,
    type AdminUserRole,
} from '@/features/admin/components/AdminPrimitives'
import { adminApi, type UserLockoutStatus } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'

export interface AdminUserRow {
    id: string
    name: string
    email: string
    role: AdminUserRole
    isActive: boolean
    createdAt: string
    lastLoginAt?: string
}

export interface UsersSectionProps {
    users: AdminUserRow[]
    activeUsers: number
    isLoading: boolean
    onAddUser: () => void
    onEditUser: (user: AdminUserRow) => void
    onDeleteUser: (user: AdminUserRow) => void
}

/**
 * 格式化相對時間（「3 小時前」「2 天前」）
 */
function formatRelativeTime(isoString?: string): string {
    if (!isoString) return '--'
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return '剛剛'
    if (diffMin < 60) return `${diffMin} 分鐘前`
    if (diffHour < 24) return `${diffHour} 小時前`
    if (diffDay < 30) return `${diffDay} 天前`
    return formatDate(isoString)
}

/**
 * 渲染鎖定狀態 badge
 */
function LockStatusBadge({ lockoutStatus }: { lockoutStatus: UserLockoutStatus | null }) {
    if (!lockoutStatus) return <span className="text-text-secondary">--</span>

    if (lockoutStatus.is_locked) {
        return (
            <div className="inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {lockoutStatus.minutes_until_unlock ? `鎖定中 ${lockoutStatus.minutes_until_unlock}m` : '鎖定中'}
            </div>
        )
    }

    if (lockoutStatus.failures_last_7d >= 3) {
        return (
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {lockoutStatus.failures_last_7d} 次失敗
            </div>
        )
    }

    return <span className="text-xs text-text-secondary">正常</span>
}

export default function UsersSection({
    users,
    activeUsers,
    isLoading,
    onAddUser,
    onEditUser,
    onDeleteUser,
}: UsersSectionProps) {
    const { t } = useTranslation()
    const [lockoutMap, setLockoutMap] = useState<Record<string, UserLockoutStatus>>({})

    // 每 5s 輪詢一次鎖定狀態
    const { data: lockoutData } = usePolling(adminApi.getUserLockoutSummary, 5000)

    useEffect(() => {
        if (lockoutData) {
            const map: Record<string, UserLockoutStatus> = {}
            lockoutData.forEach((item) => {
                map[item.email] = item
            })
            setLockoutMap(map)
        }
    }, [lockoutData])

    // ── Kebab menu state ────────────────────────────────────────────
    // 每行一個三點按鈕，點下去開選單，選單內含編輯 / 強制登出 / 刪除。
    // 同時只能開一個選單（用 user.id 當 key），點外面或按 Esc 關閉。
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)
    const menuContainerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!openMenuId) return

        // 點選單外面關閉
        function handleClickOutside(event: MouseEvent) {
            if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
                setOpenMenuId(null)
            }
        }
        // Esc 關閉
        function handleEsc(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpenMenuId(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEsc)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEsc)
        }
    }, [openMenuId])

    return (
        <Panel className="overflow-hidden">
            <SectionHeader
                title={t('admin.users.title', '使用者') + ` (${users.length})`}
                eyebrow={t('admin.users.activeOperators', { active: activeUsers })}
                action={
                    <ActionButton onClick={onAddUser}>
                        <Plus className="h-4 w-4" />
                        {t('admin.users.addUser', '新增')}
                    </ActionButton>
                }
            />
            {/*
              使用者表格 — 為了避免被切掉，做了三件事：
              1. 三個操作按鈕（編輯 / 強制登出 / 刪除）改成 icon-only + title tooltip，
                 不再吃 80-100px 的文字寬度
              2. 整體 padding 從 px-6 縮成 px-4
              3. 頭像從 11×11 縮成 9×9
              這樣整列寬度從 ~960px 降到 ~720px，1080p 視窗也能完整顯示。
              仍保留 overflow-x-auto 給更窄的螢幕。
            */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                    <thead className="border-b border-border-subtle bg-bg-elevated/40 text-left text-xs uppercase tracking-wider text-text-secondary">
                        <tr>
                            <th className="px-4 py-3">{t('admin.users.table.user', '使用者')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.role', '角色')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.status', '狀態')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.lockStatus', '鎖定狀態')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.lastLogin', '最後登入')}</th>
                            <th className="px-4 py-3 text-right">{t('admin.users.table.action', '操作')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {isLoading ? (
                            <tr>
                                <td className="px-4 py-10 text-center text-text-secondary" colSpan={6}>
                                    {t('common.loading', '載入中')}
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td className="px-4 py-10 text-center text-text-secondary" colSpan={6}>
                                    {t('admin.users.noUsers', '暫無使用者')}
                                </td>
                            </tr>
                        ) : (
                            users.map((item) => (
                                <tr key={item.id} className="transition hover:bg-white/[0.04] dark:hover:bg-white/[0.04]">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold shadow-sm shadow-accent/20"
                                                style={{ color: 'var(--text-on-accent, #fff)' }}
                                            >
                                                {item.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-text-primary truncate">{item.name}</p>
                                                <p className="text-xs text-text-secondary truncate">{item.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <RoleBadge role={item.role} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusPill active={item.isActive} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <LockStatusBadge lockoutStatus={lockoutMap[item.email] || null} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                                        {formatRelativeTime(item.lastLoginAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {/*
                                          Kebab menu — 一行只一個三點按鈕，點下去才開選單。
                                          relative 為 dropdown 的定位錨點。
                                          只有 openMenuId === item.id 那一行掛 ref，
                                          這樣 click-outside 偵測才能正確比對。
                                        */}
                                        <div
                                            className="relative flex justify-end"
                                            ref={openMenuId === item.id ? menuContainerRef : undefined}
                                        >
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setOpenMenuId(openMenuId === item.id ? null : item.id)
                                                }}
                                                aria-haspopup="menu"
                                                aria-expanded={openMenuId === item.id}
                                                aria-label={t('admin.users.actions', '操作')}
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                                    openMenuId === item.id
                                                        ? 'border-accent/40 bg-accent/10 text-accent'
                                                        : 'border-border-subtle text-text-secondary hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary'
                                                }`}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </button>

                                            {/*
                                              Dropdown：絕對定位在 kebab 按鈕下方，靠右對齊。
                                              z-50：蓋過 table sticky header 之類。
                                              玻璃感跟 Panel 統一。
                                            */}
                                            {openMenuId === item.id && (
                                                <div
                                                    role="menu"
                                                    className="absolute right-0 top-full z-50 mt-1.5 min-w-[160px] overflow-hidden rounded-xl border border-border-subtle bg-bg-base/95 backdrop-blur-xl shadow-xl"
                                                >
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setOpenMenuId(null)
                                                            onEditUser(item)
                                                        }}
                                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-accent/10 hover:text-accent transition-colors"
                                                    >
                                                        <UserRoundCog className="h-4 w-4 shrink-0" />
                                                        {t('common.edit', '編輯')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setOpenMenuId(null)
                                                            onEditUser(item)
                                                        }}
                                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text-primary hover:bg-amber-500/10 hover:text-amber-500 transition-colors"
                                                    >
                                                        <LogOut className="h-4 w-4 shrink-0" />
                                                        {t('admin.users.forceLogout', '強制登出')}
                                                    </button>
                                                    <div className="h-px bg-border-subtle" />
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={() => {
                                                            setOpenMenuId(null)
                                                            onDeleteUser(item)
                                                        }}
                                                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4 shrink-0" />
                                                        {t('common.delete', '刪除')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Panel>
    )
}
