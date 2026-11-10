/**
 * 設定頁面 (Modal)
 */

import GlassNav from '@/components/ui/GlassNav'
import { AlertTriangle, Book, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Globe, Info, Lock, Palette, ShieldCheck, User, X } from '@/components/snow/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { useUIStore, type AccentColorType } from '../../store/uiStore'
import { authApi } from '../../api/auth'
import { usersApi } from '../../api/users'
import { ACCENT_COLORS } from '@/design-system'
import GuideSection from './GuideSection'
import AboutSection from './AboutSection'
import Tooltip from '@/components/ui/Tooltip'
import GlassSwitch from '@/components/ui/GlassSwitch'

// --- Icons ---
const CloseIcon = () => (
    <X className="w-5 h-5" />
)

const UserIcon = () => (
    <User className="w-5 h-5" />
)

const PaletteIcon = () => (
    <Palette className="w-5 h-5" />
)

const GlobeIcon = () => (
    <Globe className="w-5 h-5" />
)

const InfoIcon = () => (
    <Info className="w-5 h-5" />
)

const BookIcon = () => (
    <Book className="w-5 h-5" />
)

/** 盾牌 Icon 用於管理後台入口 */
const ShieldIcon = () => (
    <ShieldCheck className="w-5 h-5" />
)

type SettingSection = 'profile' | 'appearance' | 'language' | 'guide' | 'about'

const ACCENT_OPTIONS = Object.entries(ACCENT_COLORS) as [AccentColorType, (typeof ACCENT_COLORS)[string]][]

export default function SettingsModal() {
    const { t, i18n } = useTranslation()
    const { user, clearAuth, updateUser } = useAuthStore()
    const {
        theme, accentColor, setAccentColor,
        isSettingsOpen, setSettingsOpen,
        ragDebugMode, setRAGDebugMode,
        themePreference, setThemePreference,
        demoMode, setDemoMode,
    } = useUIStore()

    const navigate = useNavigate()
    const [activeSection, setActiveSection] = useState<SettingSection>('profile')

    /**
     * 開合動畫 ——
     * 本專案的 motion lib（gsapMotion）AnimatePresence 是 no-op Fragment，
     * 所以 motion exit prop 不會生效，要關 modal 時直接 unmount → 沒退場動畫。
     * 這裡用「延遲 unmount」手動實作：
     *   - isVisible 控制是否真的 render（包含退場期間）
     *   - isClosing 控制要套退場 class
     * 開：isSettingsOpen true → isVisible true → 下一 frame 自動進入動畫尾態
     * 關：isSettingsOpen false → isClosing true → 等 ANIM_MS 後 isVisible false unmount
     */
    const ANIM_MS = 300
    const [isVisible, setIsVisible] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    useEffect(() => {
        if (isSettingsOpen) {
            // 進場：先 mount 在「關閉」狀態（isClosing=true），double rAF 後 flip 成 false 觸發 transition
            setIsVisible(true)
            setIsClosing(true)
            const id1 = requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsClosing(false))
            })
            return () => cancelAnimationFrame(id1)
        }
        // 退場：isClosing=true 觸發 exit transition，等動畫結束才真正 unmount
        setIsClosing(true)
        const id = window.setTimeout(() => {
            setIsVisible(false)
            setIsClosing(false)
        }, ANIM_MS)
        return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSettingsOpen])

    // 密碼修改狀態
    const [showPasswordForm, setShowPasswordForm] = useState(false)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<{
        score: number; level: string; errors: string[]; is_valid: boolean
    } | null>(null)
    // 名稱修改狀態
    const [isEditingName, setIsEditingName] = useState(false)
    const [editName, setEditName] = useState(user?.name || '')
    const [isUpdatingName, setIsUpdatingName] = useState(false)

    // Mobile view state: 'menu' or 'content'
    const [mobileView, setMobileView] = useState<'menu' | 'content'>('menu')

    const menuItems = [
        { id: 'profile' as const, icon: <UserIcon />, label: t('settings.profile') },
        { id: 'appearance' as const, icon: <PaletteIcon />, label: t('settings.theme') },
        { id: 'language' as const, icon: <GlobeIcon />, label: t('settings.language') },
        { id: 'guide' as const, icon: <BookIcon />, label: t('settings.guide') },
        { id: 'about' as const, icon: <InfoIcon />, label: t('settings.about') },
    ]

    const languages = [
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '日本語' },
    ]

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode)
        localStorage.setItem('language', langCode)
    }

    const handleLogout = async () => {
        try {
            await authApi.logout()
        } catch {
            // 即使 API 失敗也清除本地 Token
        }
        clearAuth()
        setSettingsOpen(false)
        window.location.href = '/login'
    }

    const handleUpdateName = async () => {
        if (!editName.trim() || editName.trim() === user?.name) {
            setIsEditingName(false)
            return
        }

        try {
            setIsUpdatingName(true)
            const updatedUser = await usersApi.updateMe({ name: editName.trim() })
            updateUser(updatedUser)
            setIsEditingName(false)
        } catch (error) {
            console.error('更新名稱失敗:', error)
            // 可選：加入 toast 提示
        } finally {
            setIsUpdatingName(false)
        }
    }

    /**
     * 單獨檢查密碼強度
     */
    const handleNewPasswordChange = async (value: string) => {
        setNewPassword(value)
        setPasswordError('')
        setPasswordSuccess('')

        if (value.length === 0) {
            setPasswordStrength(null)
            return
        }

        // 密碼規則驗證
        const errors: string[] = []
        if (value.length < 8) errors.push(t('settings.pwdRuleLength'))
        if (!/[A-Z]/.test(value)) errors.push(t('settings.pwdRuleUpper'))
        if (!/[a-z]/.test(value)) errors.push(t('settings.pwdRuleLower'))
        if (!/\d/.test(value)) errors.push(t('settings.pwdRuleNumber'))
        if (!/[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(value)) errors.push(t('settings.pwdRuleSpecial'))

        let score = 0
        if (value.length >= 8) score += 20
        if (value.length >= 12) score += 10
        if (value.length >= 16) score += 10
        if (/[a-z]/.test(value)) score += 15
        if (/[A-Z]/.test(value)) score += 15
        if (/\d/.test(value)) score += 15
        if (/[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(value)) score += 15
        score = Math.min(score, 100)

        let level = 'weak'
        if (score >= 80) level = 'very_strong'
        else if (score >= 60) level = 'strong'
        else if (score >= 40) level = 'medium'

        setPasswordStrength({ score, level, errors, is_valid: errors.length === 0 })
    }

    /**
     * 處理密碼修改
     */
    const handleChangePassword = async () => {
        setPasswordError('')
        setPasswordSuccess('')

        if (!currentPassword) {
            setPasswordError(t('settings.pwdReqCurrent'))
            return
        }
        if (!newPassword) {
            setPasswordError(t('settings.pwdReqNew'))
            return
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError(t('settings.pwdReqNotMatch'))
            return
        }
        if (passwordStrength && !passwordStrength.is_valid) {
            setPasswordError(t('settings.pwdReqUnsafe'))
            return
        }

        setIsChangingPassword(true)
        try {
            await authApi.changePassword(currentPassword, newPassword)
            setPasswordSuccess(t('settings.pwdChangeSuccess'))
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setPasswordStrength(null)
            // 3 秒後關閉表單
            setTimeout(() => {
                setShowPasswordForm(false)
                setPasswordSuccess('')
            }, 3000)
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } }
            setPasswordError(error?.response?.data?.detail || t('settings.pwdChangeFail'))
        } finally {
            setIsChangingPassword(false)
        }
    }

    /** 密碼強度顯示顏色與文字 */
    const getStrengthColor = (level: string) => {
        switch (level) {
            case 'very_strong': return 'bg-green-500'
            case 'strong': return 'bg-light-accent'
            case 'medium': return 'bg-yellow-500'
            default: return 'bg-red-500'
        }
    }
    const getStrengthLabel = (level: string) => {
        switch (level) {
            case 'very_strong': return t('settings.pwdStrengthVeryStrong')
            case 'strong': return t('settings.pwdStrengthStrong')
            case 'medium': return t('settings.pwdStrengthMedium')
            default: return t('settings.pwdStrengthWeak')
        }
    }

    if (!isVisible) return (<></>)

    return (
        <>
            <div
                className={`fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-md transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={() => setSettingsOpen(false)}
            />
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 pointer-events-none transition-[opacity,transform] duration-normal ease-apple ${isClosing ? 'opacity-0 scale-[0.95]' : 'opacity-100 scale-100'}`}
            >
                    {/* Modal Content —— 玻璃感（半透明 + backdrop-blur + 白邊 + 浮起陰影） */}
                    <div
                        className="relative w-full max-w-5xl h-auto md:h-full max-h-[90vh] md:max-h-[750px] paper !rounded-[34px] flex flex-col md:flex-row overflow-hidden select-none pointer-events-auto"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSettingsOpen(false)}
                            className="btn-icon !w-[36px] !h-[36px] absolute top-[16px] right-[16px] text-text-secondary z-20"
                        >
                            <CloseIcon />
                        </button>

                        {/* 側邊導航 —— 內層淡淡的暈染對比，跟 modal 主體有層次但仍維持玻璃透明感 */}
                        <div className={`md:w-64 flex-shrink-0 flex-col ${mobileView === 'content' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-6 pb-2">
                                <h2 className="text-xl font-bold text-text-primary tracking-wide">
                                    {t('settings.title')}
                                </h2>
                            </div>
              <nav className="flex-1 p-4 overflow-y-auto scrollbar-none">
                                <GlassNav
                                    aria-label={t('settings.title')}
                                    value={activeSection}
                                    onChange={(id) => {
                                        setActiveSection(id)
                                        setMobileView('content')
                                    }}
                                    items={menuItems.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
                                />
                            </nav>

                            {/* 底部：管理後台入口（僅 admin / engineer 可見），清單列樣式 */}
                            {(user?.role === 'admin' || user?.role === 'engineer') && (
                                <div className="p-4 pt-2">
                                    <div className="set-group">
                                        <button
                                            type="button"
                                            onClick={() => { setSettingsOpen(false); navigate('/admin') }}
                                            className="set-row set-row-btn has-icon"
                                        >
                                            <span className="set-icon"><ShieldIcon /></span>
                                            <span className="set-label">{t('settings.adminLabel')}</span>
                                            <ChevronRight className="set-chevron" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 主內容區域 */}
                        <div className={`flex-1 overflow-y-auto scrollbar-none min-h-0 bg-transparent relative ${mobileView === 'menu' ? 'hidden md:block' : 'block'}`}>
                            <div className="p-6 md:px-10 md:pt-14 md:pb-10 min-h-full">
                                {/* 手機版返回上一層（iOS：箭頭＋上一頁的標題） */}
                                <button
                                    className="md:hidden mb-4 -ml-1 flex items-center text-accent text-[15px] font-medium"
                                    onClick={() => setMobileView('menu')}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    {t('settings.title')}
                                </button>
                                {/* 個人資料（Apple 帳號頁：置中頭像＋分組清單） */}
                                {activeSection === 'profile' && (
                                    <motion.div className="set-page" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42 }}>
                                        <div className="set-section set-hero">
                                            <div className="w-20 h-20 rounded-full bg-accent-fill text-text-on-accent flex items-center justify-center text-[32px] font-bold mb-2">
                                                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                            </div>
                                            <h2 className="text-[22px] leading-[28px] font-bold text-text-primary">{user?.name}</h2>
                                            <p className="text-[15px] text-text-secondary">{user?.email}</p>
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
                                                            className="flex-1 min-w-0 text-right bg-transparent outline-none text-[15px] text-text-primary"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdateName()
                                                                if (e.key === 'Escape') {
                                                                    setEditName(user?.name || '')
                                                                    setIsEditingName(false)
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => { setEditName(user?.name || ''); setIsEditingName(false) }}
                                                            disabled={isUpdatingName}
                                                            className="btn btn-sm btn-secondary flex-shrink-0"
                                                        >
                                                            {t('common.cancel', '取消')}
                                                        </button>
                                                        <button onClick={handleUpdateName} disabled={isUpdatingName} className="btn btn-sm btn-primary flex-shrink-0">
                                                            {isUpdatingName ? t('common.loading') : t('common.save')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button type="button" className="set-row set-row-btn" onClick={() => { setEditName(user?.name || ''); setIsEditingName(true) }}>
                                                        <span className="set-label">{t('settings.nameLabel', '名稱')}</span>
                                                        <span className="set-value">{user?.name}</span>
                                                        <ChevronRight className="set-chevron" />
                                                    </button>
                                                )}
                                                <div className="set-row">
                                                    <span className="set-label">{t('settings.emailLabel', '電子郵件')}</span>
                                                    <span className="set-value">{user?.email}</span>
                                                </div>
                                                <div className="set-row">
                                                    <span className="set-label">{t('settings.roleLabel', '角色')}</span>
                                                    <span className={`tag ${user?.role === 'admin' || user?.role === 'engineer' ? 'tag-accent' : ''}`}>{user?.role}</span>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="set-section">
                                            <div className="set-header">{t('settings.securitySection', '安全性')}</div>
                                            <div className="set-group">
                                                <button
                                                    type="button"
                                                    className="set-row set-row-btn has-icon"
                                                    onClick={() => {
                                                        setShowPasswordForm(true)
                                                        setPasswordError('')
                                                        setPasswordSuccess('')
                                                        setCurrentPassword('')
                                                        setNewPassword('')
                                                        setConfirmNewPassword('')
                                                        setPasswordStrength(null)
                                                    }}
                                                >
                                                    <span className="set-icon"><Lock className="w-[18px] h-[18px]" /></span>
                                                    <span className="set-label">{t('auth.changePassword', '修改密碼')}</span>
                                                    <ChevronRight className="set-chevron" />
                                                </button>
                                            </div>
                                        </section>

                                        <section className="set-section">
                                            <div className="set-group">
                                                <button type="button" className="set-row set-row-btn set-danger" onClick={handleLogout}>
                                                    {t('auth.logout')}
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {/* 外觀（Apple：外觀預覽圖、強調色、進階開關） */}
                                {activeSection === 'appearance' && (
                                    <motion.div className="set-page" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42 }}>
                                        <h2 className="set-title">{t('settings.theme')}</h2>

                                        <section className="set-section">
                                            <div className="set-header">{t('settings.appearanceSection', '外觀')}</div>
                                            <div className="set-group p-4">
                                                <div className="flex gap-4">
                                                    {APPEARANCE_MODES.map((mode) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            aria-pressed={themePreference === mode}
                                                            onClick={() => setThemePreference(mode)}
                                                            className={`set-appearance ${themePreference === mode ? 'is-current' : ''}`}
                                                        >
                                                            <span className="set-thumb">
                                                                <AppearancePreview mode={mode} />
                                                            </span>
                                                            {mode === 'light' ? t('settings.themeLight') : mode === 'dark' ? t('settings.themeDark') : t('settings.themeSystem')}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>

                                        <section className="set-section">
                                            <div className="set-group">
                                                <div className="set-row">
                                                    <span className="set-label">{t('settings.accentColor', '強調顏色')}</span>
                                                    <div className="flex items-center gap-1">
                                                        {ACCENT_OPTIONS.map(([key, color]) => (
                                                            <Tooltip key={key} label={color.label}>
                                                                <button
                                                                    type="button"
                                                                    aria-label={color.label}
                                                                    aria-pressed={accentColor === key}
                                                                    onClick={() => setAccentColor(key)}
                                                                    className={`set-swatch ${accentColor === key ? 'is-current' : ''}`}
                                                                >
                                                                    <span style={{ backgroundColor: color.hex }} />
                                                                </button>
                                                            </Tooltip>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="set-section">
                                            <div className="set-header">{t('settings.advancedSection', '進階')}</div>
                                            <div className="set-group">
                                                <label className="set-row cursor-pointer">
                                                    <span className="set-label">
                                                        {t('settings.ragDebugToggle', '顯示 RAG Debug 資訊')}
                                                        <span className="set-sub">{t('settings.ragDebugHint', '每次 AI 回覆下方顯示檢索文件、相似度與來源。')}</span>
                                                    </span>
                                                    <GlassSwitch checked={ragDebugMode} onChange={() => setRAGDebugMode(!ragDebugMode)} />
                                                </label>
                                                <label className="set-row cursor-pointer">
                                                    <span className="set-label">
                                                        {t('settings.demoModeToggle', '隱藏敏感資訊')}
                                                        <span className="set-sub">{t('settings.demoModeHint', '對外展示時隱藏絕對路徑等敏感字串。')}</span>
                                                    </span>
                                                    <GlassSwitch checked={demoMode} onChange={() => setDemoMode(!demoMode)} />
                                                </label>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {/* 語言（Apple：勾選清單） */}
                                {activeSection === 'language' && (
                                    <motion.div className="set-page" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42 }}>
                                        <h2 className="set-title">{t('settings.language')}</h2>
                                        <section className="set-section">
                                            <div className="set-group" role="radiogroup" aria-label={t('settings.language')}>
                                                {languages.map((lang) => {
                                                    const on = i18n.language === lang.code
                                                    return (
                                                        <button
                                                            key={lang.code}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={on}
                                                            onClick={() => handleLanguageChange(lang.code)}
                                                            className="set-row set-row-btn"
                                                        >
                                                            <span className="set-label">{lang.label}</span>
                                                            {on && <Check className="w-[18px] h-[18px] text-accent" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                            {/* 使用指南 */}
                            {activeSection === 'guide' && (
                                <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <GuideSection />
                                </motion.div>
                            )}
                            {activeSection === 'about' && (
                                <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.42 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <AboutSection />
                                </motion.div>
                            )}

                            </div>
                        </div>
                    </div>
            </div>



            <AnimatePresence>
                {showPasswordForm && (
                    <motion.div
                        key="pwd-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setShowPasswordForm(false)}
                        className="fixed inset-0 z-[60] bg-black/20 dark:bg-black/45 backdrop-blur-md"
                    />
                )}
                {showPasswordForm && (
                    <motion.div 
                        key="pwd-modal"
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ type:"spring", stiffness: 300, damping: 28 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
                    >
                        {/* 修改密碼（Apple 表單：三個欄位一組清單，規則與強度放在組下說明，最下面一顆主要按鈕） */}
                        <div className="relative w-full max-w-[460px] dialog-sheet flex flex-col pointer-events-auto">
                            <button
                                onClick={() => setShowPasswordForm(false)}
                                aria-label={t('common.close', '關閉')}
                                className="btn-icon dialog-close absolute text-text-secondary"
                            >
                                <CloseIcon />
                            </button>

                            <h3 className="dialog-title text-center">{t('auth.changePassword', '修改密碼')}</h3>

                            <div className="set-group mt-5">
                                <PwdRow label={t('settings.currentPassword')} value={currentPassword} onChange={(v) => { setCurrentPassword(v); setPasswordError('') }} />
                                <PwdRow label={t('settings.newPassword')} value={newPassword} onChange={handleNewPasswordChange} />
                                <PwdRow label={t('settings.confirmNewPassword')} value={confirmNewPassword} onChange={(v) => { setConfirmNewPassword(v); setPasswordError('') }} />
                            </div>

                            {/* 組下說明：密碼規則（逐條打勾）＋強度 */}
                            <div className="set-footer space-y-1.5">
                                {[
                                    t('settings.pwdRuleLength'),
                                    t('settings.pwdRuleUpper'),
                                    t('settings.pwdRuleLower'),
                                    t('settings.pwdRuleNumber'),
                                    t('settings.pwdRuleSpecial'),
                                ].map((rule, i) => {
                                    const passed = passwordStrength ? !passwordStrength.errors.some((e) => e === rule) : null
                                    return (
                                        <div key={i} className={`flex items-center gap-1.5 ${passed === true ? 'text-[#30d158]' : passed === false ? 'text-[var(--danger-ink,#ff4245)]' : ''}`}>
                                            {passed === true ? <Check className="w-3.5 h-3.5 shrink-0" /> : passed === false ? <X className="w-3.5 h-3.5 shrink-0" /> : <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">·</span>}
                                            <span>{rule}</span>
                                        </div>
                                    )
                                })}
                                {passwordStrength && (
                                    <div className="pt-2">
                                        <div className="flex items-center mb-1">
                                            <span>{t('settings.pwdStrengthLabel')}</span>
                                            <span className="ml-auto font-semibold text-text-primary">{getStrengthLabel(passwordStrength.level)}</span>
                                        </div>
                                        <div className="h-1.5 bg-[var(--chip)] rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${getStrengthColor(passwordStrength.level)}`} style={{ width: `${passwordStrength.score}%` }} />
                                        </div>
                                    </div>
                                )}
                                {confirmNewPassword && newPassword !== confirmNewPassword && (
                                    <p className="pt-1 text-[var(--danger-ink,#ff4245)]">{t('settings.pwdMismatch')}</p>
                                )}
                            </div>

                            {(passwordError || passwordSuccess) && (
                                <div className={`mt-4 flex items-center gap-2 text-[13px] font-medium ${passwordError ? 'text-[var(--danger-ink,#ff4245)]' : 'text-[#30d158]'}`}>
                                    {passwordError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                                    {passwordError || passwordSuccess}
                                </div>
                            )}

                            <div className="dialog-actions">
                                <button onClick={() => setShowPasswordForm(false)} className="btn btn-lg btn-secondary">
                                    {t('common.cancel', '取消')}
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                    className="btn btn-lg btn-primary"
                                >
                                    {isChangingPassword ? t('common.loading') : t('settings.pwdSubmit', '更改')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </>
    )
}

// ── 密碼欄位（Apple 表單列：左標籤、右輸入、最右顯示／隱藏） ──
interface PwdRowProps {
    label: string
    value: string
    onChange: (v: string) => void
}

function PwdRow({ label, value, onChange }: PwdRowProps) {
    const [visible, setVisible] = useState(false)
    return (
        <label className="set-row cursor-text">
            <span className="w-[96px] flex-none">{label}</span>
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="必填"
                aria-label={label}
                className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-text-primary placeholder:text-text-muted"
            />
            {value.length > 0 && (
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label={visible ? '隱藏密碼' : '顯示密碼'}
                    onClick={() => setVisible((v) => !v)}
                    className="flex-none text-text-secondary"
                >
                    {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
            )}
        </label>
    )
}

const APPEARANCE_MODES = ['light', 'dark', 'system'] as const

// ── 外觀預覽圖（Apple 系統設定的迷你視窗）：淺色、深色、自動（左右各半） ──
function AppearancePreview({ mode }: { mode: 'light' | 'dark' | 'system' }) {
    const win = (dark: boolean) => {
        const page = dark ? '#000000' : '#F2F2F7'
        const card = dark ? '#1C1C1E' : '#FFFFFF'
        return (
            <span className="absolute inset-0 block" style={{ background: page }}>
                {/* 側欄 */}
                <span className="absolute left-[8%] top-[12%] bottom-[12%] w-[24%] rounded-[5px]" style={{ background: card }} />
                {/* 內容卡 */}
                <span className="absolute left-[36%] right-[8%] top-[12%] h-[34%] rounded-[5px]" style={{ background: card }} />
                <span className="absolute left-[36%] right-[8%] top-[52%] bottom-[12%] rounded-[5px]" style={{ background: card }} />
                {/* 強調色按鈕 */}
                <span className="absolute left-[42%] top-[22%] w-[22%] h-[12%] rounded-full" style={{ background: 'rgb(var(--accent))' }} />
            </span>
        )
    }
    if (mode !== 'system') return win(mode === 'dark')
    return (
        <>
            {win(false)}
            <span className="absolute inset-0 block" style={{ clipPath: 'inset(0 0 0 50%)' }}>{win(true)}</span>
        </>
    )
}
