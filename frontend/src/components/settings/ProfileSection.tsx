/**
 * 設定 › 個人資料（Apple 帳號頁：置中頭像＋分組清單）
 *   名稱可以直接點來編輯；修改密碼開彈窗；最下面登出
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Edit2, Lock } from '@/components/snow/icons'
import { authApi } from '@/api/auth'
import { usersApi } from '@/api/users'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import PasswordDialog from './PasswordDialog'
import { RoleBadge } from '@/features/admin/components/AdminPrimitives'

export default function ProfileSection() {
    const { t } = useTranslation()
    const { user, clearAuth, updateUser } = useAuthStore()
    const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

    const [isEditingName, setIsEditingName] = useState(false)
    const [editName, setEditName] = useState(user?.name || '')
    const [isUpdatingName, setIsUpdatingName] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const startEdit = () => {
        setEditName(user?.name || '')
        setIsEditingName(true)
    }
    const cancelEdit = () => {
        setEditName(user?.name || '')
        setIsEditingName(false)
    }

    const saveName = async () => {
        const name = editName.trim()
        if (!name || name === user?.name) {
            setIsEditingName(false)
            return
        }
        try {
            setIsUpdatingName(true)
            updateUser(await usersApi.updateMe({ name }))
            setIsEditingName(false)
        } catch (error) {
            console.error('更新名稱失敗:', error)
        } finally {
            setIsUpdatingName(false)
        }
    }

    const logout = async () => {
        try {
            await authApi.logout()
        } catch {
            // 即使 API 失敗也清除本地登入資料
        }
        clearAuth()
        setSettingsOpen(false)
        window.location.href = '/login'
    }


    return (
        <>
            <div className="set-section set-hero">
                <div className="w-20 h-20 rounded-full bg-accent-fill text-text-on-accent flex items-center justify-center text-[length:var(--fs-32)] font-bold mb-2">
                    {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                </div>
                <h2 className="text-[length:var(--fs-22)] leading-[var(--lh-28)] font-bold text-text-primary">{user?.name}</h2>
                <p className="text-[length:var(--fs-15)] text-text-secondary">{user?.email}</p>
            </div>

            <section className="set-section">
                <div className="set-header">{t('settings.accountSection', '帳號')}</div>
                <div className="set-group">
                    {isEditingName ? (
                        <div className="set-row">
                            <span className="set-label flex-none">{t('settings.nameLabel', '名稱')}</span>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                aria-label={t('settings.nameLabel', '名稱')}
                                className="flex-1 min-w-0 text-right bg-transparent outline-none text-[length:var(--fs-15)] text-text-primary"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveName()
                                    if (e.key === 'Escape') cancelEdit()
                                }}
                            />
                            <button onClick={cancelEdit} disabled={isUpdatingName} className="btn btn-sm btn-secondary flex-shrink-0">
                                {t('common.cancel', '取消')}
                            </button>
                            <button onClick={saveName} disabled={isUpdatingName} className="btn btn-sm btn-primary flex-shrink-0">
                                {isUpdatingName ? t('common.loading') : t('common.save')}
                            </button>
                        </div>
                    ) : (
                        <button type="button" className="set-row set-row-btn" onClick={startEdit}>
                            <span className="set-label">{t('settings.nameLabel', '名稱')}</span>
                            <span className="set-value">{user?.name}</span>
                            {/* 筆：表示名稱可以直接編輯 */}
                            <Edit2 className="set-chevron" />
                        </button>
                    )}
                    <div className="set-row">
                        <span className="set-label">{t('settings.emailLabel', '電子郵件')}</span>
                        <span className="set-value">{user?.email}</span>
                    </div>
                    <div className="set-row">
                        <span className="set-label">{t('settings.roleLabel', '角色')}</span>
                        {user?.role && <RoleBadge role={user.role} />}
                    </div>
                </div>
            </section>

            <section className="set-section">
                <div className="set-header">{t('settings.securitySection', '安全性')}</div>
                <div className="set-group">
                    <button type="button" className="set-row set-row-btn has-icon" onClick={() => setShowPassword(true)}>
                        <span className="set-icon"><Lock className="w-[var(--sz-18)] h-[var(--sz-18)]" /></span>
                        <span className="set-label">{t('auth.changePassword', '修改密碼')}</span>
                        <ChevronRight className="set-chevron" />
                    </button>
                </div>
            </section>

            <section className="set-section">
                <div className="set-group">
                    <button type="button" className="set-row set-row-btn set-danger" onClick={logout}>
                        {t('auth.logout')}
                    </button>
                </div>
            </section>

            <PasswordDialog open={showPassword} onClose={() => setShowPassword(false)} />
        </>
    )
}
