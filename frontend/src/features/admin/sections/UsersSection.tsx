/**
 * Admin > Users tab
 * -----------------
 * 重寫版本，加入：
 * - 鎖定狀態（已鎖定 / 失敗警告 / 正常）
 * - 最後登入相對時間（3 小時前、2 天前 etc）
 * - 強制登出按鈕
 */

import LensMenu from '@/components/ui/LensMenu'
import { parseServerDate } from '@/lib/utils'
import { Plus, Trash2, UserRoundCog, LogOut, MoreHorizontal } from '@/components/snow/icons'
import { createPortal } from 'react-dom'
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
    tableHeadRowClass,
    tableBodyClass,
    tableEmptyCellClass,
} from '@/features/admin/components/AdminPrimitives'
import { adminApi, type UserLockoutStatus } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelTableRows } from '@/components/ui/Skeleton'

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
    onForceLogout: (user: AdminUserRow) => void
    /** 目前登入者：不能對自己強制登出或刪除 */
    currentUserId?: string
}

/**
 * 格式化相對時間（「3 小時前」「2 天前」）
 */
function formatRelativeTime(isoString?: string): string {
    if (!isoString) return '--'
    const date = parseServerDate(isoString)
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--sys-red)_30%,transparent)] bg-[color-mix(in_srgb,var(--sys-red)_10%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--sys-red)] dark:text-[var(--sys-red)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--sys-red)]" />
                {lockoutStatus.minutes_until_unlock ? `鎖定中 ${lockoutStatus.minutes_until_unlock}m` : '鎖定中'}
            </div>
        )
    }

    if (lockoutStatus.failures_last_7d >= 3) {
        return (
            <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--sys-orange)_30%,transparent)] bg-[color-mix(in_srgb,var(--sys-orange)_10%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--sys-orange)] dark:text-[var(--sys-orange)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--sys-orange)]" />
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
    onForceLogout,
    currentUserId,
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
    // 選單畫在頁面最外層（portal），不會被表格的捲動框切掉；
    // 位置依按鈕在畫面上的座標計算，下方空間不夠時改往上開
    const [menuPos, setMenuPos] = useState<{ top: number; right: number; up: boolean } | null>(null)
    const menuContainerRef = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)

    const closeMenu = () => {
        setOpenMenuId(null)
        setMenuPos(null)
    }

    useEffect(() => {
        if (!openMenuId) return

        // 點選單和按鈕以外的地方關閉
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node
            if (menuContainerRef.current?.contains(target) || menuRef.current?.contains(target)) return
            closeMenu()
        }
        // Esc 關閉
        function handleEsc(event: KeyboardEvent) {
            if (event.key === 'Escape') closeMenu()
        }
        // 捲動或縮放視窗時選單位置會跑掉，直接關閉
        function handleMove() {
            closeMenu()
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEsc)
        window.addEventListener('resize', handleMove)
        window.addEventListener('scroll', handleMove, true)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEsc)
            window.removeEventListener('resize', handleMove)
            window.removeEventListener('scroll', handleMove, true)
        }
    }, [openMenuId])

    const openUser = users.find((u) => u.id === openMenuId) || null
    const isSelf = (u: AdminUserRow | null) => !!u && !!currentUserId && u.id === currentUserId

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
            <div className="overflow-x-auto pb-[4px]">
                <table className="w-full min-w-[720px]">
                    <thead className={tableHeadRowClass}>
                        <tr>
                            <th className="pl-[21px] pr-4 py-3">{t('admin.users.table.user', '使用者')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.role', '角色')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.status', '狀態')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.lockStatus', '鎖定狀態')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.lastLogin', '最後登入')}</th>
                            <th className="pl-4 pr-[16px] py-3 text-right">{t('admin.users.table.action', '操作')}</th>
                        </tr>
                    </thead>
                    <tbody className={tableBodyClass}>
                        {isLoading ? (
                            <SkelTableRows rows={4} cols={6} />
                        ) : users.length === 0 ? (
                            <tr>
                                <td className={tableEmptyCellClass} colSpan={6}>
                                    {t('admin.users.noUsers', '暫無使用者')}
                                </td>
                            </tr>
                        ) : (
                            users.map((item) => (
                                <tr key={item.id} className="transition  ">
                                    <td className="pl-[21px] pr-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-fill text-xs font-bold  "
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
                                    <td className="pl-4 pr-[16px] py-3">
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
                                                    if (openMenuId === item.id) {
                                                        closeMenu()
                                                        return
                                                    }
                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                    const up = window.innerHeight - rect.bottom < 170
                                                    setMenuPos({
                                                        top: up ? rect.top - 6 : rect.bottom + 6,
                                                        right: window.innerWidth - rect.right,
                                                        up,
                                                    })
                                                    setOpenMenuId(item.id)
                                                }}
                                                aria-haspopup="menu"
                                                aria-expanded={openMenuId === item.id}
                                                aria-label={t('admin.users.actions', '操作')}
                                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                                    openMenuId === item.id
                                                        ? 'border-accent/40 bg-accent/10 text-accent'
                                                        : 'border-[var(--paper-line)] text-text-secondary   '
                                                }`}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </button>

                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {openUser && menuPos && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    className="fixed z-[1000] min-w-[168px] overflow-hidden paper !rounded-[20px] p-1.5"
                    style={{
                        top: menuPos.top,
                        right: menuPos.right,
                        transform: menuPos.up ? 'translateY(-100%)' : undefined,
                    }}
                >
                    <LensMenu className="">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            closeMenu()
                            onEditUser(openUser)
                        }}
                        className="menu-item"
                    >
                        <UserRoundCog className="h-4 w-4 shrink-0" />
                        {t('common.edit', '編輯')}
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        disabled={isSelf(openUser)}
                        title={isSelf(openUser) ? '不能對自己強制登出' : undefined}
                        onClick={() => {
                            closeMenu()
                            onForceLogout(openUser)
                        }}
                        className="menu-item"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {t('admin.users.forceLogout', '強制登出')}
                    </button>
                    <div className="menu-sep" />
                    <button
                        type="button"
                        role="menuitem"
                        disabled={isSelf(openUser)}
                        title={isSelf(openUser) ? '不能刪除自己的帳號' : undefined}
                        onClick={() => {
                            closeMenu()
                            onDeleteUser(openUser)
                        }}
                        className="menu-item is-danger"
                    >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        {t('common.delete', '刪除')}
                    </button>
                    </LensMenu>
                </div>,
                document.body,
            )}
        </Panel>
    )
}
