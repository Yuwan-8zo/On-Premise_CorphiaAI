/**
 * 設定頁面 (Modal)
 */

import { AlertTriangle, Book, Check, ChevronLeft, ChevronRight, Edit2, Eye, EyeOff, Globe, Info, Lock, Moon, Palette, ShieldCheck, Sun, User, X } from '@/components/snow/icons'
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

/** 亮色模式 Icon */
const SunIcon = () => (
    <Sun className="w-10 h-10 text-amber-400" />
)

/** 深色模式 Icon */
const MoonIcon = () => (
    <Moon className="w-10 h-10 text-text-secondary" />
)



const LockIcon = () => (
    <Lock className="w-5 h-5" />
)

/** 盾牌 Icon 用於管理後台入口 */
const ShieldIcon = () => (
    <ShieldCheck className="w-5 h-5" />
)

type SettingSection = 'profile' | 'appearance' | 'language' | 'guide' | 'about'

/**
 * 主題卡的選中／未選中外觀。獨立成常數避免在 JSX 內重複貼三次同樣的字串，
 * 也順便修掉 `bg-[rgb(...)/0.05]` 缺一個右括號的舊 bug。
 */
const THEME_CARD_BASE = 'flex-1 p-2 pb-3 rounded-[24px] transition-all snow-well'
const THEME_CARD_SELECTED =
    '!bg-accent/10 ring-2 ring-accent'
const THEME_CARD_UNSELECTED =
    ''
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
    const ANIM_MS = 220
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
                className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-md transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={() => setSettingsOpen(false)}
            />
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 pointer-events-none transition-all duration-200 ease-out ${isClosing ? 'opacity-0 scale-[0.97] translate-y-2' : 'opacity-100 scale-100 translate-y-0'}`}
            >
                    {/* Modal Content —— 玻璃感（半透明 + backdrop-blur + 白邊 + 浮起陰影） */}
                    <div
                        className="relative w-full max-w-5xl h-auto md:h-full max-h-[90vh] md:max-h-[750px] paper !rounded-[34px] flex flex-col md:flex-row overflow-hidden select-none pointer-events-auto"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSettingsOpen(false)}
                            className="btn-icon !w-9 !h-9 absolute top-[18px] right-[18px] text-text-secondary z-20"
                        >
                            <CloseIcon />
                        </button>

                        {/* 側邊導航 —— 內層淡淡的暈染對比，跟 modal 主體有層次但仍維持玻璃透明感 */}
                        <div className={`md:w-64 border-r border-[var(--paper-line)] flex-shrink-0 flex-col ${mobileView === 'content' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-6 pb-2">
                                <h2 className="text-xl font-bold text-text-primary tracking-wide">
                                    {t('settings.title')}
                                </h2>
                            </div>
                            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveSection(item.id)
                                            setMobileView('content')
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-[16px] text-left transition-all ${
                                            activeSection === item.id
                                                ? 'bg-[var(--chip)] text-text-primary font-semibold border border-transparent'
                                                : 'text-text-secondary bg-transparent font-medium border border-transparent'
                                        }`}
                                    >
                                        <div className={`${activeSection === item.id ? 'text-accent' : 'text-text-secondary'}`}>
                                            {item.icon}
                                        </div>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </nav>

                            {/* 底部按鈕區 */}
                            <div className="p-4 border-t border-[var(--paper-line)] space-y-2">
                                {/* 管理後台入口：僅 admin / engineer 可見 */}
                                {(user?.role === 'admin' || user?.role === 'engineer') && (
                                    <Tooltip label={t('settings.enterAdmin')}>
                                        <button
                                            onClick={() => { setSettingsOpen(false); navigate('/admin') }}
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-[18px] text-text-secondary bg-[var(--chip)] transition-all font-medium text-sm group"
                                        >
                                        <span className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors">
                                            <ShieldIcon />
                                        </span>
                                        <span>{t('settings.adminLabel')}</span>
                                        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-70 transition-opacity" />
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        {/* 主內容區域 */}
                        <div className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-transparent relative ${mobileView === 'menu' ? 'hidden md:block' : 'block'}`}>
                            <div className="p-6 md:p-10 min-h-full">
                                {/* 手機版返回導航*/}
                                <button 
                                    className="md:hidden mb-6 flex items-center text-corphia-bronze font-medium  transition-opacity"
                                    onClick={() => setMobileView('menu')}
                                >
                                    <ChevronLeft className="w-5 h-5 mr-1" />
                                    {t('common.cancel', '取消')}
                                </button>
                                {/* 個人資料 */}
                                {activeSection === 'profile' && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                        <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-[var(--paper-line)]">
                                            {t('settings.profile')}
                                        </h2>

                                    {/* 頭像與名稱*/}
                                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-10 text-center md:text-left">
                                        <div className="w-24 h-24 rounded-full bg-accent text-text-on-accent flex items-center justify-center text-4xl font-bold  shrink-0">
                                            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                        </div>
                                        <div className="flex flex-col items-center md:items-start">
                                            <div className="flex items-center gap-3 mb-1">
                                                {isEditingName ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="text-xl font-bold text-text-primary snow-field rounded-[14px] px-3 py-1 outline-none w-48"
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
                                                            onClick={handleUpdateName}
                                                            disabled={isUpdatingName}
                                                            className="btn btn-sm btn-primary flex-shrink-0"
                                                        >
                                                            {isUpdatingName ? t('common.loading') : t('common.save')}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setEditName(user?.name || '')
                                                                setIsEditingName(false)
                                                            }}
                                                            disabled={isUpdatingName}
                                                            className="btn btn-sm btn-secondary flex-shrink-0"
                                                        >
                                                            {t('common.cancel', '取消')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h3 className="text-[28px] leading-none font-bold text-text-primary tracking-tight">
                                                            {user?.name}
                                                        </h3>
                                                        <Tooltip label={t('common.changeName')}>
                                                            <button
                                                                onClick={() => setIsEditingName(true)}
                                                                className="text-text-muted  transition-colors p-1 rounded-full "
                                                            >
                                                            <Edit2 className="w-5 h-5" />
                                                            </button>
                                                        </Tooltip>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-[15px] font-medium text-text-secondary mb-3">
                                                {user?.email}
                                            </p>
                                            <span className="inline-block px-4 py-1 text-[13px] font-bold bg-accent/10 text-accent rounded-full border border-accent/20 tracking-wide uppercase">
                                                {user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 帳號操作區塊 */}
                                    <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-[var(--paper-line)] pt-8">
                                        <button
                                            onClick={() => {
                                                setShowPasswordForm(true)
                                                setPasswordError('')
                                                setPasswordSuccess('')
                                                setCurrentPassword('')
                                                setNewPassword('')
                                                setConfirmNewPassword('')
                                                setPasswordStrength(null)
                                            }}
                                            className="btn btn-secondary w-full sm:w-auto"
                                        >
                                            <LockIcon /> {t('auth.changePassword', '修改密碼')}
                                        </button>

                                        <button
                                            onClick={handleLogout}
                                            className="btn btn-danger w-full sm:w-auto"
                                        >
                                            {t('auth.logout')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* 外觀設定 */}
                            {activeSection === 'appearance' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-[var(--paper-line)]">
                                        {t('settings.theme')}
                                    </h2>

                                    <div className="grid grid-cols-3 gap-4 max-w-2xl">
                                        {/* 淺色模式 */}
                                        <button
                                            onClick={() => setThemePreference('light')}
                                            className={`${THEME_CARD_BASE} ${themePreference === 'light' ? THEME_CARD_SELECTED : THEME_CARD_UNSELECTED}`}
                                        >
                                            <div className="w-full h-24 rounded-[16px] bg-[#F6F4F0] mb-3 flex items-center justify-center">
                                                <SunIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${themePreference === 'light' ? 'text-accent' : 'text-text-primary'}`}>
                                                {t('settings.themeLight')}
                                            </p>
                                        </button>

                                        {/* 深色模式 */}
                                        <button
                                            onClick={() => setThemePreference('dark')}
                                            className={`${THEME_CARD_BASE} ${themePreference === 'dark' ? THEME_CARD_SELECTED : THEME_CARD_UNSELECTED}`}
                                        >
                                            <div className="w-full h-24 rounded-[16px] bg-[#28282A] mb-3 flex items-center justify-center">
                                                <MoonIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${themePreference === 'dark' ? 'text-accent' : 'text-text-primary'}`}>
                                                {t('settings.themeDark')}
                                            </p>
                                        </button>

                                        {/* 跟隨系統 */}
                                        <Tooltip label={t('settings.themeSystemHint')} className="flex-1 min-w-0 flex">
                                            <button
                                                onClick={() => setThemePreference('system')}
                                                className={`w-full ${THEME_CARD_BASE} ${themePreference === 'system' ? THEME_CARD_SELECTED : THEME_CARD_UNSELECTED}`}
                                            >
                                            <div className="w-full h-24 rounded-[17px] mb-3 flex items-center justify-center overflow-hidden">
                                                {/* 半邊太陽半邊月亮，呼應 prefers-color-scheme */}
                                                <div className="flex w-full h-full">
                                                    <div className="flex-1 bg-[#F6F4F0] flex items-center justify-center">
                                                        <SunIcon />
                                                    </div>
                                                    <div className="flex-1 bg-[#28282A] flex items-center justify-center">
                                                        <MoonIcon />
                                                    </div>
                                                </div>
                                            </div>
                                            <p className={`text-[15px] font-semibold ${themePreference === 'system' ? 'text-accent' : 'text-text-primary'}`}>
                                                {t('settings.themeSystem')}
                                            </p>
                                            </button>
                                        </Tooltip>
                                    </div>

                                    {/* 強調色設定*/}
                                    <div className="mt-12">
                                        <h3 className="text-xl font-bold text-text-primary mb-6">
                                            {t('settings.accentColor', '強調顏色')}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3">
                                            {ACCENT_OPTIONS.map(([key, color]) => (
                                                <Tooltip key={key} label={color.label}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAccentColor(key)}
                                                        className={`tap h-11 w-11 rounded-full border p-1 transition-all ${
                                                            accentColor === key
                                                                ? 'border-accent ring-4 ring-accent/20'
                                                                : 'border-[var(--paper-line)] '
                                                        }`}
                                                    >
                                                    <span
                                                        className="block h-full w-full rounded-full "
                                                        style={{ backgroundColor: color.hex }}
                                                    />
                                                    </button>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </div>

                                    {/* iOS Settings 風格群組：把進階開關集中在一個帶髮絲線的容器裡 */}
                                    <div className="mt-12 max-w-md">
                                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted mb-2 px-1">
                                            {t('settings.advancedSection', '進階')}
                                        </h3>
                                        <div className="ios-list">
                                            {/* RAG Debug */}
                                            <label className="ios-list-row cursor-pointer">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-[15px] font-medium text-text-primary">
                                                        {t('settings.ragDebugToggle', '顯示 RAG Debug 資訊')}
                                                    </span>
                                                    <span className="text-[12px] text-text-secondary leading-snug">
                                                        {t('settings.ragDebugHint', '每次 AI 回覆下方顯示檢索文件、相似度與來源。')}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={ragDebugMode}
                                                    onClick={() => setRAGDebugMode(!ragDebugMode)}
                                                    className={`tap relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                                                        ragDebugMode
                                                            ? 'bg-accent'
                                                            : 'bg-[var(--well)]'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_0.5px_4px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.1)] transition-transform ${
                                                            ragDebugMode ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            </label>

                                            {/* Demo Mode */}
                                            <label className="ios-list-row cursor-pointer">
                                                <div className="flex flex-col gap-0.5 min-w-0">
                                                    <span className="text-[15px] font-medium text-text-primary">
                                                        {t('settings.demoModeToggle', '隱藏敏感資訊')}
                                                    </span>
                                                    <span className="text-[12px] text-text-secondary leading-snug">
                                                        {t('settings.demoModeHint', '對外展示時隱藏絕對路徑等敏感字串。')}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={demoMode}
                                                    onClick={() => setDemoMode(!demoMode)}
                                                    className={`tap relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                                                        demoMode
                                                            ? 'bg-accent'
                                                            : 'bg-[var(--well)]'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-[0_0.5px_4px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.1)] transition-transform ${
                                                            demoMode ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            </label>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* 語言設定 */}
                            {activeSection === 'language' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-[var(--paper-line)]">
                                        {t('settings.language')}
                                    </h2>

                                    <div className="space-y-3 max-w-md">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center justify-between px-5 py-4 rounded-[18px] transition-all ${i18n.language === lang.code
                                                        ? 'bg-accent/10 text-accent ring-2 ring-accent'
                                                        : 'snow-well text-text-primary'
                                                    }`}
                                            >
                                                <span className="font-semibold text-[16px]">{lang.label}</span>
                                                {i18n.language === lang.code && (
                                                    <Check className="w-6 h-6" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* 使用指南 */}
                            {activeSection === 'guide' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <GuideSection />
                                </motion.div>
                            )}
                            {activeSection === 'about' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="h-full flex-1 min-h-0 flex flex-col">
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
                        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md"
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
                        {/* Card 內排版改為靈活設計：1:1 正方形 */}
                        <div
                            className="relative w-full max-w-[640px] paper !rounded-[38px] p-9 flex flex-col gap-6 transition-colors overflow-hidden pointer-events-auto"
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowPasswordForm(false)}
                                className="btn-icon !w-9 !h-9 absolute top-5 right-5 text-text-secondary"
                            >
                                <CloseIcon />
                            </button>

                            {/* Title */}
                            <div>
                                <h3 className="text-[22px] font-bold text-text-primary tracking-tight">
                                    {t('auth.changePassword', '修改密碼')}
                                </h3>
                            </div>

                            {/* 左右分欄排版：密碼規則 + 輸入區域 */}
                            <div className="flex gap-6">
                                {/* 左側：密碼規則 */}
                                <div className="flex-1 snow-well rounded-[20px] p-5 text-[13px] text-text-secondary space-y-2.5">
                                    <p className="font-semibold text-text-primary text-[14px] mb-2">{t('settings.pwdRequirements')}</p>
                                    {[
                                        t('settings.pwdRuleLength'),
                                        t('settings.pwdRuleUpper'),
                                        t('settings.pwdRuleLower'),
                                        t('settings.pwdRuleNumber'),
                                        t('settings.pwdRuleSpecial'),
                                    ].map((rule, i) => {
                                        const passed = passwordStrength
                                            ? !passwordStrength.errors.some(e => e === rule)
                                            : null
                                        return (
                                            <div key={i} className={`flex items-center gap-1.5 transition-colors ${
                                                passed === true ? 'text-green-600 ' :
                                                passed === false ? 'text-red-500 ' : ''
                                            }`}>
                                                {passed === true ? (
                                                    <Check className="w-3.5 h-3.5 shrink-0" />
                                                ) : passed === false ? (
                                                    <X className="w-3.5 h-3.5 shrink-0" />
                                                ) : (
                                                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">-</span>
                                                )}
                                                <span>{rule}</span>
                                            </div>
                                        )
                                    })}

                                    {/* 密碼強度評估：固定於左側底部 */}
                                    <AnimatePresence>
                                        {passwordStrength && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="pt-3 mt-1 border-t border-[var(--paper-line)] /10 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[11px] text-text-secondary">{t('settings.pwdStrengthLabel')}</span>
                                                    <span className={`text-[11px] font-semibold ml-auto ${
                                                        passwordStrength.level === 'very_strong' ? 'text-green-600 ' :
                                                        passwordStrength.level === 'strong' ? 'text-light-accent ' :
                                                        passwordStrength.level === 'medium' ? 'text-yellow-600 ' :
                                                        'text-red-600 '
                                                    }`}>
                                                        {getStrengthLabel(passwordStrength.level)}
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-[var(--chip)] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${getStrengthColor(passwordStrength.level)}`}
                                                        style={{ width: `${passwordStrength.score}%` }}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* 右側：輸入欄位 */}
                                <div className="flex-1 flex flex-col gap-4 justify-center">
                                    {/* 目前密碼 */}
                                    <PwdFloatingInput
                                        label={t('settings.currentPassword')}
                                        value={currentPassword}
                                        onChange={v => { setCurrentPassword(v); setPasswordError('') }}
                                    />

                                    {/* 新密碼 */}
                                    <PwdFloatingInput
                                        label={t('settings.newPassword')}
                                        value={newPassword}
                                        onChange={handleNewPasswordChange}
                                    />

                                    {/* 確認新密碼 */}
                                    <div>
                                        <PwdFloatingInput
                                            label={t('settings.confirmNewPassword')}
                                            value={confirmNewPassword}
                                            onChange={v => { setConfirmNewPassword(v); setPasswordError('') }}
                                        />
                                        <AnimatePresence>
                                            {confirmNewPassword && newPassword !== confirmNewPassword && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="mt-1 pl-3 text-[11px] font-medium text-red-500 overflow-hidden"
                                                >
                                                    {t('settings.pwdMismatch')}                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* 關閉按鈕 */}
                            <AnimatePresence>
                                {(passwordError || passwordSuccess) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        {passwordError && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2.5 w-full bg-red-50 text-red-600 rounded-full text-[13px] font-medium border border-red-200">
                                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                                {passwordError}
                                            </div>
                                        )}
                                        {passwordSuccess && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2.5 w-full bg-green-50 text-green-600 rounded-full text-[13px] font-medium border border-green-200">
                                                <Check className="w-4 h-4 shrink-0" />
                                                {passwordSuccess}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 處理按鈕：使用與登入頁面相同的設計 */}
                            <button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                className="btn btn-lg btn-primary btn-block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            >
                                {isChangingPassword ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        修改中...
                                    </span>
                                ) : t('auth.changePassword', '確認修改密碼')}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </>
    )
}

// ── 密碼輸入框：套用登入頁的 FloatingInput 樣式 ──
interface PwdFloatingInputProps {
    label: string
    value: string
    onChange: (v: string) => void
}

function PwdFloatingInput({ label, value, onChange }: PwdFloatingInputProps) {
    const [visible, setVisible] = useState(false)
    const isFilled = value.length > 0
    return (
        <div className="relative w-full">
            <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={label}
                className={`peer w-full px-5 py-3.5 rounded-full bg-[var(--chip)] border border-transparent text-text-primary text-[15px] outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-transparent ${isFilled ? 'pr-12' : ''}`}
            />
            <label className={`absolute left-4 -translate-y-1/2 transition-all duration-300 pointer-events-none px-2 origin-left whitespace-nowrap
                ${isFilled
                    ? 'top-0 scale-[0.82] bg-transparent text-text-primary font-semibold py-0.5 rounded-full'
                    : 'top-1/2 scale-100 bg-transparent text-text-secondary py-0'}
                peer-focus:top-0 peer-focus:scale-[0.82] peer-focus:bg-transparent peer-focus:text-accent peer-focus:font-semibold peer-focus:py-0.5 peer-focus:rounded-full
            `}>
                {label}
            </label>
            <AnimatePresence>
                {isFilled && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute right-4 inset-y-0 flex items-center"
                    >
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setVisible(v => !v)}
                            className="p-1 text-text-muted  transition-colors"
                        >
                            {visible ? (
                                <Eye className="w-4 h-4" />
                            ) : (
                                <EyeOff className="w-4 h-4" />
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
