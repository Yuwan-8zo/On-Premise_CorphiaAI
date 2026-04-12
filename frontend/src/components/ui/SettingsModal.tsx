/**
 * 設定頁面 (Modal)
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { authApi } from '../../api/auth'

// --- Icons ---
const CloseIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
)

const UserIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
)

const PaletteIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
)

const GlobeIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
)

const InfoIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

/** 主題－日間模式 Icon */
const SunIcon = () => (
    <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
    </svg>
)

/** 主題－夜間模式 Icon */
const MoonIcon = () => (
    <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
)

/** 關於頁面 AI Robot Icon */
const RobotIcon = () => (
    <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-2.4 2.4m0 0-2.4 2.4M19.8 15l2.4 2.4m-2.4-2.4-2.4-2.4M9 9h.01M15 9h.01M9 12h6M7.5 19.5h9" />
    </svg>
)

type SettingSection = 'profile' | 'appearance' | 'language' | 'about'

export default function SettingsModal() {
    const { t, i18n } = useTranslation()
    const { user, clearAuth } = useAuthStore()
    const { theme, toggleTheme, isSettingsOpen, setSettingsOpen } = useUIStore()

    const [activeSection, setActiveSection] = useState<SettingSection>('profile')

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

    const menuItems = [
        { id: 'profile' as const, icon: <UserIcon />, label: t('settings.profile') },
        { id: 'appearance' as const, icon: <PaletteIcon />, label: t('settings.theme') },
        { id: 'language' as const, icon: <GlobeIcon />, label: t('settings.language') },
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
            // 即使 API 失敗也繼續清除本地 Token
        }
        clearAuth()
        setSettingsOpen(false)
        window.location.href = '/login'
    }

    /**
     * 即時檢查密碼強度
     */
    const handleNewPasswordChange = async (value: string) => {
        setNewPassword(value)
        setPasswordError('')
        setPasswordSuccess('')

        if (value.length === 0) {
            setPasswordStrength(null)
            return
        }

        // 本地即時驗證（避免過多 API 請求）
        const errors: string[] = []
        if (value.length < 8) errors.push('至少 8 個字元')
        if (!/[A-Z]/.test(value)) errors.push('需包含大寫字母')
        if (!/[a-z]/.test(value)) errors.push('需包含小寫字母')
        if (!/\d/.test(value)) errors.push('需包含數字')
        if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(value)) errors.push('需包含特殊字元')

        let score = 0
        if (value.length >= 8) score += 20
        if (value.length >= 12) score += 10
        if (value.length >= 16) score += 10
        if (/[a-z]/.test(value)) score += 15
        if (/[A-Z]/.test(value)) score += 15
        if (/\d/.test(value)) score += 15
        if (/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(value)) score += 15
        score = Math.min(score, 100)

        let level = 'weak'
        if (score >= 80) level = 'very_strong'
        else if (score >= 60) level = 'strong'
        else if (score >= 40) level = 'medium'

        setPasswordStrength({ score, level, errors, is_valid: errors.length === 0 })
    }

    /**
     * 提交密碼修改
     */
    const handleChangePassword = async () => {
        setPasswordError('')
        setPasswordSuccess('')

        if (!currentPassword) {
            setPasswordError('請輸入當前密碼')
            return
        }
        if (!newPassword) {
            setPasswordError('請輸入新密碼')
            return
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('新密碼與確認密碼不一致')
            return
        }
        if (passwordStrength && !passwordStrength.is_valid) {
            setPasswordError('新密碼不符合安全要求')
            return
        }

        setIsChangingPassword(true)
        try {
            await authApi.changePassword(currentPassword, newPassword)
            setPasswordSuccess('密碼修改成功！')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setPasswordStrength(null)
            // 3 秒後收起表單
            setTimeout(() => {
                setShowPasswordForm(false)
                setPasswordSuccess('')
            }, 3000)
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } }
            setPasswordError(error?.response?.data?.detail || '密碼修改失敗')
        } finally {
            setIsChangingPassword(false)
        }
    }

    /** 密碼強度指示器顏色 */
    const getStrengthColor = (level: string) => {
        switch (level) {
            case 'very_strong': return 'bg-green-500'
            case 'strong': return 'bg-blue-500'
            case 'medium': return 'bg-yellow-500'
            default: return 'bg-red-500'
        }
    }
    const getStrengthLabel = (level: string) => {
        switch (level) {
            case 'very_strong': return '非常強'
            case 'strong': return '強'
            case 'medium': return '中等'
            default: return '弱'
        }
    }

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSettingsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative w-full max-w-5xl h-full max-h-[750px] bg-white/95 dark:bg-ios-dark-gray5/95 backdrop-blur-2xl rounded-[20px] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-gray-100 dark:border-white/10"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSettingsOpen(false)}
                            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 hover:bg-black/5 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-colors z-20"
                        >
                            <CloseIcon />
                        </button>

                        {/* 側邊選單 */}
                        <div className="md:w-64 bg-gray-50/50 dark:bg-ios-dark-gray6/30 border-r border-gray-200/50 dark:border-white/5 flex-shrink-0 flex flex-col">
                            <div className="p-6 pb-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-wide">
                                    {t('settings.title')}
                                </h2>
                            </div>
                            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-left transition-all ${activeSection === item.id
                                                ? 'bg-white dark:bg-ios-dark-gray4 text-ios-blue-light dark:text-ios-blue-light shadow-sm font-semibold'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                                            }`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* 內容區域 */}
                        <div className="flex-1 overflow-y-auto min-h-0 bg-transparent p-6 md:p-10 relative">
                            {/* 個人資料 */}
                            {activeSection === 'profile' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
                                        {t('settings.profile')}
                                    </h2>

                                    {/* 頭像與資訊 */}
                                    <div className="flex items-center gap-8 mb-10">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-ios-blue-light to-ios-blue-dark flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0">
                                            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                                {user?.name}
                                            </h3>
                                            <p className="text-lg text-gray-500 dark:text-gray-400 mb-3">
                                                {user?.email}
                                            </p>
                                            <span className="inline-block px-4 py-1.5 text-sm font-semibold bg-ios-blue-light/10 dark:bg-ios-blue-dark/20 text-ios-blue-light rounded-full">
                                                {user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 修改密碼區塊 */}
                                    <div className="mb-8">
                                        <button
                                            onClick={() => {
                                                setShowPasswordForm(!showPasswordForm)
                                                setPasswordError('')
                                                setPasswordSuccess('')
                                                setCurrentPassword('')
                                                setNewPassword('')
                                                setConfirmNewPassword('')
                                                setPasswordStrength(null)
                                            }}
                                            className="flex items-center gap-2 px-5 py-3 bg-gray-100 dark:bg-ios-dark-gray4 hover:bg-gray-200 dark:hover:bg-ios-dark-gray3 text-gray-700 dark:text-gray-300 font-semibold rounded-full transition-colors"
                                        >
                                            🔒 {showPasswordForm ? '收起' : '修改密碼'}
                                        </button>

                                        {showPasswordForm && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-4 p-6 bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[16px] border border-gray-200 dark:border-white/5 space-y-4 max-w-md"
                                            >
                                                {/* 密碼策略提示 */}
                                                <div className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-ios-dark-gray4 rounded-xl p-3 space-y-1">
                                                    <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">密碼安全要求：</p>
                                                    <p>• 至少 8 個字元</p>
                                                    <p>• 包含大寫字母 (A-Z)</p>
                                                    <p>• 包含小寫字母 (a-z)</p>
                                                    <p>• 包含數字 (0-9)</p>
                                                    <p>• 包含特殊字元 (!@#$% 等)</p>
                                                </div>

                                                {/* 當前密碼 */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">當前密碼</label>
                                                    <input
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={e => { setCurrentPassword(e.target.value); setPasswordError('') }}
                                                        className="w-full px-4 py-3 rounded-full bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-ios-blue-light focus:border-transparent outline-none transition-all"
                                                        placeholder="輸入當前密碼"
                                                    />
                                                </div>

                                                {/* 新密碼 */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">新密碼</label>
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={e => handleNewPasswordChange(e.target.value)}
                                                        className="w-full px-4 py-3 rounded-full bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-ios-blue-light focus:border-transparent outline-none transition-all"
                                                        placeholder="輸入新密碼"
                                                    />

                                                    {/* 密碼強度指示器 */}
                                                    {passwordStrength && (
                                                        <div className="mt-2">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="flex-1 h-2 bg-gray-200 dark:bg-ios-dark-gray3 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength.level)}`}
                                                                        style={{ width: `${passwordStrength.score}%` }}
                                                                    />
                                                                </div>
                                                                <span className={`text-xs font-semibold ${
                                                                    passwordStrength.level === 'very_strong' ? 'text-green-600 dark:text-green-400' :
                                                                    passwordStrength.level === 'strong' ? 'text-blue-600 dark:text-blue-400' :
                                                                    passwordStrength.level === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                                                                    'text-red-600 dark:text-red-400'
                                                                }`}>
                                                                    {getStrengthLabel(passwordStrength.level)}
                                                                </span>
                                                            </div>
                                                            {passwordStrength.errors.length > 0 && (
                                                                <ul className="text-xs text-red-500 dark:text-red-400 space-y-0.5">
                                                                    {passwordStrength.errors.map((err, i) => (
                                                                        <li key={i}>✗ {err}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 確認新密碼 */}
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">確認新密碼</label>
                                                    <input
                                                        type="password"
                                                        value={confirmNewPassword}
                                                        onChange={e => { setConfirmNewPassword(e.target.value); setPasswordError('') }}
                                                        className="w-full px-4 py-3 rounded-full bg-white dark:bg-ios-dark-gray4 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:ring-2 focus:ring-ios-blue-light focus:border-transparent outline-none transition-all"
                                                        placeholder="再次輸入新密碼"
                                                    />
                                                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                                                        <p className="mt-1 text-xs text-red-500">密碼不一致</p>
                                                    )}
                                                </div>

                                                {/* 錯誤/成功訊息 */}
                                                {passwordError && (
                                                    <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                                                        ⚠️ {passwordError}
                                                    </div>
                                                )}
                                                {passwordSuccess && (
                                                    <div className="p-3 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-xl text-sm font-medium">
                                                        ✅ {passwordSuccess}
                                                    </div>
                                                )}

                                                {/* 提交按鈕 */}
                                                <button
                                                    onClick={handleChangePassword}
                                                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                                    className="w-full py-3 bg-ios-blue-light hover:bg-ios-blue-light/90 disabled:opacity-50 disabled:hover:bg-ios-blue-light text-white font-semibold rounded-full transition-colors"
                                                >
                                                    {isChangingPassword ? '修改中...' : '確認修改密碼'}
                                                </button>
                                            </motion.div>
                                        )}
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            onClick={handleLogout}
                                            className="px-6 py-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 font-semibold rounded-full transition-colors"
                                        >
                                            {t('auth.logout')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* 外觀設定 */}
                            {activeSection === 'appearance' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
                                        {t('settings.theme')}
                                    </h2>

                                    <div className="flex gap-6 max-w-md">
                                        {/* 日間模式 */}
                                        <button
                                            onClick={() => theme === 'dark' && toggleTheme()}
                                            className={`flex-1 p-4 rounded-[20px] transition-all border-2 ${theme === 'light'
                                                    ? 'border-ios-blue-light bg-ios-blue-light/5 dark:bg-ios-blue-light/10 ring-4 ring-ios-blue-light/20'
                                                    : 'border-gray-200 dark:border-ios-dark-gray3 hover:border-gray-300 dark:hover:border-ios-dark-gray2'
                                                }`}
                                        >
                                            <div className="w-full h-24 rounded-xl bg-white border border-gray-200 shadow-sm mb-4 flex items-center justify-center transition-transform hover:scale-105">
                                                <SunIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${theme === 'light' ? 'text-ios-blue-light' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {t('settings.themeLight')}
                                            </p>
                                        </button>

                                        {/* 夜間模式 */}
                                        <button
                                            onClick={() => theme === 'light' && toggleTheme()}
                                            className={`flex-1 p-4 rounded-[20px] transition-all border-2 ${theme === 'dark'
                                                    ? 'border-ios-blue-light bg-ios-blue-light/5 dark:bg-ios-blue-light/10 ring-4 ring-ios-blue-light/20'
                                                    : 'border-gray-200 dark:border-ios-dark-gray3 hover:border-gray-300 dark:hover:border-ios-dark-gray2'
                                                }`}
                                        >
                                            <div className="w-full h-24 rounded-xl bg-ios-dark-gray6 border border-white/5 shadow-inner mb-4 flex items-center justify-center transition-transform hover:scale-105">
                                                <MoonIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${theme === 'dark' ? 'text-ios-blue-light dark:text-ios-blue-light' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {t('settings.themeDark')}
                                            </p>
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* 語言設定 */}
                            {activeSection === 'language' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
                                        {t('settings.language')}
                                    </h2>

                                    <div className="space-y-3 max-w-md">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center justify-between px-6 py-5 rounded-full transition-all border-2 ${i18n.language === lang.code
                                                        ? 'bg-ios-blue-light/5 dark:bg-ios-blue-light/10 text-ios-blue-light dark:text-ios-blue-light border-ios-blue-light'
                                                        : 'bg-white dark:bg-ios-dark-gray4 hover:bg-gray-50 dark:hover:bg-ios-dark-gray3 text-gray-700 dark:text-gray-300 border-transparent shadow-sm'
                                                    }`}
                                            >
                                                <span className="font-semibold text-[16px]">{lang.label}</span>
                                                {i18n.language === lang.code && (
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* 關於 */}
                            {activeSection === 'about' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 pb-4 border-b border-gray-100 dark:border-white/5">
                                        {t('settings.about')}
                                    </h2>

                                    <div className="text-center py-6">
                                        <div className="inline-flex items-center justify-center w-28 h-28 rounded-[20px] bg-gradient-to-tr from-ios-blue-dark to-ios-blue-light mb-6 shadow-xl shadow-ios-blue-light/30">
                                            <RobotIcon />
                                        </div>
                                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                                            Corphia AI Platform
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-6 text-lg">
                                            版本 2.2.0
                                        </p>
                                        <p className="text-[16px] text-gray-600 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                                            企業級私有部署 AI 問答系統，支援本地 LLM 推論和 RAG 知識庫檢索。
                                        </p>
                                    </div>

                                    <div className="mt-8 p-6 bg-gray-50 dark:bg-ios-dark-gray6/50 rounded-[20px] border border-transparent dark:border-white/5">
                                        <div className="grid grid-cols-2 gap-4 text-sm text-left">
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm font-medium">技術棧</p>
                                                <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">React + FastAPI</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm font-medium">LLM Engine</p>
                                                <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">llama.cpp</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm font-medium">向量資料庫</p>
                                                <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">ChromaDB</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm font-medium">授權</p>
                                                <p className="text-gray-900 dark:text-gray-100 font-semibold text-lg">MIT License</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
