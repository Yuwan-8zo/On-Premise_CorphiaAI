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
    type AdminUserRole,
    tableHeadRowClass,
    tableBodyClass,
    tableEmptyCellClass,
} from '@/features/admin/components/AdminPrimitives'
import { formatDate } from '@/features/admin/utils/formatDate'
import { adminApi, type UserLockoutStatus } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelTableRows, SkelText } from '@/components/ui/Skeleton'
import i18n from '@/i18n'
import { useDismiss } from '@/lib/useDismiss'
import { useKeepInViewport } from '@/lib/useKeepInViewport'
import { useAuthStore } from '@/store/authStore'

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

    if (diffSec < 60) return i18n.t('ui.time.justNow')
    if (diffMin < 60) return i18n.t('ui.time.minutesAgo', { count: diffMin })
    if (diffHour < 24) return i18n.t('ui.time.hoursAgo', { count: diffHour })
    if (diffDay < 30) return i18n.t('ui.time.daysAgo', { count: diffDay })
    return formatDate(isoString)
}

/**
 * 渲染鎖定狀態 badge
 */
function LockStatusBadge({ lockoutStatus }: { lockoutStatus: UserLockoutStatus | null }) {
    if (!lockoutStatus) return <span className="text-text-secondary">--</span>

    if (lockoutStatus.is_locked) {
        return (
            <div className="tag tag-red">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--sys-red)]" />
                {lockoutStatus.minutes_until_unlock ? i18n.t('ui.users.lockedFor', { minutes: lockoutStatus.minutes_until_unlock }) : i18n.t('ui.users.locked')}
            </div>
        )
    }

    if (lockoutStatus.failures_last_7d >= 3) {
        return (
            <div className="tag tag-orange">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--sys-orange)]" />
                {i18n.t('ui.users.failures', { count: lockoutStatus.failures_last_7d })}
            </div>
        )
    }

    return <span className="text-xs text-text-secondary">{i18n.t('ui.users.normal')}</span>
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
    // 選單放在按鈕下方；下面放不下時 useKeepInViewport 會翻到按鈕上方（不用寫死選單高度）
    const [menuPos, setMenuPos] = useState<{ top: number; right: number; anchor: { top: number; bottom: number } } | null>(null)
    const menuContainerRef = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)

    const closeMenu = () => {
        setOpenMenuId(null)
        setMenuPos(null)
    }

    useEffect(() => {
        if (!openMenuId) return

        // 捲動或縮放視窗時選單位置會跑掉，直接關閉
        function handleMove() {
            closeMenu()
        }
        window.addEventListener('resize', handleMove)
        window.addEventListener('scroll', handleMove, true)
        return () => {
            window.removeEventListener('resize', handleMove)
            window.removeEventListener('scroll', handleMove, true)
        }
    }, [openMenuId])

    // 點選單和按鈕以外的地方、按 Esc 關閉
    useDismiss(!!openMenuId, closeMenu, [menuContainerRef, menuRef])
    useKeepInViewport(menuRef, menuPos, menuPos?.anchor)

    const openUser = users.find((u) => u.id === openMenuId) || null
    const isSelf = (u: AdminUserRow | null) => !!u && !!currentUserId && u.id === currentUserId
    // 權限比自己高的帳號（租戶管理員看 engineer）不能編輯、踢出、刪除（後端也會擋）
    const myRole = useAuthStore((s) => s.user?.role)
    const isHigher = (u: AdminUserRow | null) => !!u && u.role === 'engineer' && myRole !== 'engineer'

    return (
        <Panel className="admin-fill">
            <SectionHeader
                title={t('admin.users.title', '使用者') + ` (${users.length})`}
                eyebrow={isLoading && !users.length ? <SkelText>{t('admin.users.activeOperators', { active: 0 })}</SkelText> : t('admin.users.activeOperators', { active: activeUsers })}
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
            <div className="admin-fill-body overflow-x-auto pb-[var(--sp-4)]">
                <table className="w-full sm:min-w-[var(--sz-720)]">
                    <thead className={tableHeadRowClass}>
                        <tr>
                            <th className="pl-[var(--sp-21)] pr-4 py-3">{t('admin.users.table.user', '使用者')}</th>
                            <th className="px-4 py-3">{t('admin.users.table.role', '角色')}</th>
                            <th className="hidden sm:table-cell px-4 py-3">{t('admin.users.table.status', '狀態')}</th>
                            <th className="hidden sm:table-cell px-4 py-3">{t('admin.users.table.lockStatus', '鎖定狀態')}</th>
                            <th className="hidden sm:table-cell px-4 py-3">{t('admin.users.table.lastLogin', '最後登入')}</th>
                            <th className="pl-4 pr-[var(--sp-16)] py-3 text-right">{t('admin.users.table.action', '操作')}</th>
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
                                    <td className="pl-[var(--sp-21)] pr-4 py-3">
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
                                    <td className="hidden sm:table-cell px-4 py-3">
                                        <StatusPill active={item.isActive} />
                                    </td>
                                    <td className="hidden sm:table-cell px-4 py-3">
                                        <LockStatusBadge lockoutStatus={lockoutMap[item.email] || null} />
                                    </td>
                                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                                        {formatRelativeTime(item.lastLoginAt)}
                                    </td>
                                    <td className="pl-4 pr-[var(--sp-16)] py-3">
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
                                                    setMenuPos({
                                                        top: rect.bottom + 6,
                                                        right: window.innerWidth - rect.right,
                                                        anchor: { top: rect.top, bottom: rect.bottom },
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
                    className="fixed z-[1000] min-w-[var(--sz-168)] overflow-hidden paper !rounded-[var(--r-20)] p-1.5"
                    style={{
                        top: menuPos.top,
                        right: menuPos.right,
                    }}
                >
                    <LensMenu className="">
                    <button
                        type="button"
                        role="menuitem"
                        disabled={isHigher(openUser)}
                        title={isHigher(openUser) ? t('ui.users.higherRole') : undefined}
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
                        disabled={isSelf(openUser) || isHigher(openUser)}
                        title={isSelf(openUser) ? t('ui.users.cantLogoutSelf') : isHigher(openUser) ? t('ui.users.higherRole') : undefined}
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
                        disabled={isSelf(openUser) || isHigher(openUser)}
                        title={isSelf(openUser) ? t('ui.users.cantDeleteSelf') : isHigher(openUser) ? t('ui.users.higherRole') : undefined}
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
