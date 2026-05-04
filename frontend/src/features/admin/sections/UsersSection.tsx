/**
 * Admin > Users tab
 * -----------------
 * Table of all users with avatar, name, email, role badge, status pill,
 * last-login timestamp, and edit/delete actions per row.
 */

import { Plus, Trash2, UserRoundCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
    Panel,
    SectionHeader,
    ActionButton,
    StatusPill,
    RoleBadge,
    formatDate,
    type AdminUserRole,
} from '@/features/admin/components/AdminPrimitives'

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

export default function UsersSection({
    users,
    activeUsers,
    isLoading,
    onAddUser,
    onEditUser,
    onDeleteUser,
}: UsersSectionProps) {
    const { t } = useTranslation()

    return (
        <Panel className="overflow-hidden">
            <SectionHeader
                title={t('admin.users.title') + ` (${users.length})`}
                eyebrow={t('admin.users.activeOperators', { active: activeUsers })}
                action={
                    <ActionButton onClick={onAddUser}>
                        <Plus className="h-4 w-4" />
                        {t('admin.users.addUser')}
                    </ActionButton>
                }
            />
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                    <thead className="border-b border-border-subtle bg-bg-elevated/40 text-left text-xs uppercase tracking-wider text-text-secondary">
                        <tr>
                            <th className="px-6 py-4">{t('admin.users.table.user')}</th>
                            <th className="px-6 py-4">{t('admin.users.table.role')}</th>
                            <th className="px-6 py-4">{t('admin.users.table.status')}</th>
                            <th className="px-6 py-4">{t('admin.users.table.lastLogin')}</th>
                            <th className="px-6 py-4 text-right">{t('admin.users.table.action')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {isLoading ? (
                            <tr>
                                <td className="px-6 py-10 text-center text-text-secondary" colSpan={5}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td className="px-6 py-10 text-center text-text-secondary" colSpan={5}>
                                    {t('admin.users.noUsers')}
                                </td>
                            </tr>
                        ) : (
                            users.map((item) => (
                                <tr key={item.id} className="transition hover:bg-white/[0.04] dark:hover:bg-white/[0.04]">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-bold shadow-sm shadow-accent/20"
                                                style={{ color: 'var(--text-on-accent, #fff)' }}
                                            >
                                                {item.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-text-primary">{item.name}</p>
                                                <p className="text-sm text-text-secondary">{item.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <RoleBadge role={item.role} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusPill active={item.isActive} />
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {formatDate(item.lastLoginAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-end gap-2">
                                            <ActionButton variant="secondary" onClick={() => onEditUser(item)}>
                                                <UserRoundCog className="h-4 w-4" />
                                                {t('common.edit')}
                                            </ActionButton>
                                            <ActionButton variant="danger" onClick={() => onDeleteUser(item)}>
                                                <Trash2 className="h-4 w-4" />
                                                {t('common.delete')}
                                            </ActionButton>
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
