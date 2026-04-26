/**
 * Ë®≠Â??ÅÈù¢ (Modal)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { authApi } from '../../api/auth'
import { usersApi } from '../../api/users'
import GuideSection from './GuideSection'
import AboutSection from './AboutSection'
import SystemMonitorPanel from '../system/SystemMonitorPanel'

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

const BookIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
)

/** ‰∏ªÈ?ÔºçÊó•?ìÊ®°Âº?Icon */
const SunIcon = () => (
    <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M3 12h2m14 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
    </svg>
)

/** ‰∏ªÈ?ÔºçÂ??ìÊ®°Âº?Icon */
const MoonIcon = () => (
    <svg className="w-10 h-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
)



const LockIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
)

/** ?æÁ? Icon ??ÁÆ°Á?ÂæåÂè∞?•Âè£ */
const ShieldIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
)

const QrCodeIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
    </svg>
)

/** ?àË? Icon ??Á≥ªÁµ±??éß */
const PulseIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l5.47-5.47a.75.75 0 011.06 0l3.44 3.44a.75.75 0 001.06 0l5.47-5.47M3.75 17.25h16.5" />
    </svg>
)

type SettingSection = 'profile' | 'appearance' | 'language' | 'monitor' | 'guide' | 'about'

export default function SettingsModal() {
    const { t, i18n } = useTranslation()
    const { user, clearAuth, updateUser } = useAuthStore()
    const {
        theme, toggleTheme, accentColor, setAccentColor,
        isSettingsOpen, setSettingsOpen,
        ragDebugMode, setRAGDebugMode,
    } = useUIStore()

    const navigate = useNavigate()
    const [activeSection, setActiveSection] = useState<SettingSection>('profile')

    // ÂØÜÁ¢º‰øÆÊîπ?Ä??
    const [showPasswordForm, setShowPasswordForm] = useState(false)

    // QR Code ÂΩàÁ??Ä??
    const [showQR, setShowQR] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<{
        score: number; level: string; errors: string[]; is_valid: boolean
    } | null>(null)
    // ?çÁ®±‰øÆÊîπ?Ä??
    const [isEditingName, setIsEditingName] = useState(false)
    const [editName, setEditName] = useState(user?.name || '')
    const [isUpdatingName, setIsUpdatingName] = useState(false)

    // Mobile view state: 'menu' or 'content'
    const [mobileView, setMobileView] = useState<'menu' | 'content'>('menu')

    const menuItems = [
        { id: 'profile' as const, icon: <UserIcon />, label: t('settings.profile') },
        { id: 'appearance' as const, icon: <PaletteIcon />, label: t('settings.theme') },
        { id: 'language' as const, icon: <GlobeIcon />, label: t('settings.language') },
        { id: 'monitor' as const, icon: <PulseIcon />, label: t('systemMonitor.title') },
        { id: 'guide' as const, icon: <BookIcon />, label: t('settings.guide') },
        { id: 'about' as const, icon: <InfoIcon />, label: t('settings.about') },
    ]

    const languages = [
        { code: 'zh-TW', label: 'ÁπÅÈ?‰∏≠Ê?' },
        { code: 'en-US', label: 'English' },
        { code: 'ja-JP', label: '?•Êú¨Ë™? },
    ]

    const handleLanguageChange = (langCode: string) => {
        i18n.changeLanguage(langCode)
        localStorage.setItem('language', langCode)
    }

    const handleLogout = async () => {
        try {
            await authApi.logout()
        } catch {
            // ?≥‰Ωø API Â§±Ê?‰πüÁπºÁ∫åÊ??§Êú¨??Token
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
            console.error('?¥Êñ∞?çÁ®±Â§±Ê?:', error)
            // ?ØÈÅ∏ÔºöÂ???toast ?êÁ§∫
        } finally {
            setIsUpdatingName(false)
        }
    }

    /**
     * ?≥Ê?Ê™¢Êü•ÂØÜÁ¢ºÂº∑Â∫¶
     */
    const handleNewPasswordChange = async (value: string) => {
        setNewPassword(value)
        setPasswordError('')
        setPasswordSuccess('')

        if (value.length === 0) {
            setPasswordStrength(null)
            return
        }

        // ?¨Âú∞?≥Ê?È©óË?ÔºàÈÅø?çÈ?Â§?API Ë´ãÊ?Ôº?
        const errors: string[] = []
        if (value.length < 8) errors.push('?≥Â? 8 ?ãÂ???)
        if (!/[A-Z]/.test(value)) errors.push('?Ä?ÖÂê´Â§ßÂØ´Â≠óÊ?')
        if (!/[a-z]/.test(value)) errors.push('?Ä?ÖÂê´Â∞èÂØ´Â≠óÊ?')
        if (!/\d/.test(value)) errors.push('?Ä?ÖÂê´?∏Â?')
        if (!/[!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|`~]/.test(value)) errors.push('?Ä?ÖÂê´?πÊ?Â≠óÂ?')

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
     * ?ê‰∫§ÂØÜÁ¢º‰øÆÊîπ
     */
    const handleChangePassword = async () => {
        setPasswordError('')
        setPasswordSuccess('')

        if (!currentPassword) {
            setPasswordError('Ë´ãËº∏?•Áï∂?çÂ?Á¢?)
            return
        }
        if (!newPassword) {
            setPasswordError('Ë´ãËº∏?•Êñ∞ÂØÜÁ¢º')
            return
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('?∞Â?Á¢ºË?Á¢∫Ë?ÂØÜÁ¢º‰∏ç‰???)
            return
        }
        if (passwordStrength && !passwordStrength.is_valid) {
            setPasswordError('?∞Â?Á¢º‰?Á¨¶Â?ÂÆâÂÖ®Ë¶ÅÊ?')
            return
        }

        setIsChangingPassword(true)
        try {
            await authApi.changePassword(currentPassword, newPassword)
            setPasswordSuccess('ÂØÜÁ¢º‰øÆÊîπ?êÂ?Ôº?)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setPasswordStrength(null)
            // 3 ÁßíÂ??∂Ëµ∑Ë°®ÂñÆ
            setTimeout(() => {
                setShowPasswordForm(false)
                setPasswordSuccess('')
            }, 3000)
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } }
            setPasswordError(error?.response?.data?.detail || 'ÂØÜÁ¢º‰øÆÊîπÂ§±Ê?')
        } finally {
            setIsChangingPassword(false)
        }
    }

    /** ÂØÜÁ¢ºÂº∑Â∫¶?áÁ§∫?®È???*/
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
            case 'very_strong': return '?ûÂ∏∏Âº?
            case 'strong': return 'Âº?
            case 'medium': return '‰∏≠Á?'
            default: return 'Âº?
        }
    }

    return (
        <>
            <AnimatePresence>
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 bg-black/50 backdrop-blur-md">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSettingsOpen(false)}
                        className="absolute inset-0 bg-black/50 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type:"spring", stiffness: 300, damping: 30 }}
                        className="relative w-full max-w-5xl h-auto md:h-full max-h-[90vh] md:max-h-[750px] bg-bg-base/95 /95 backdrop-blur-2xl rounded-[20px] shadow-2xl flex flex-col md:flex-row overflow-hidden border border-border-subtle"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSettingsOpen(false)}
                            className="absolute top-4 right-4 p-2 text-text-secondary hover:text-text-primary bg-bg-main /10 rounded-full transition-colors z-20"
                        >
                            <CloseIcon />
                        </button>

                        {/* ?¥È??∏ÂñÆ */}
                        <div className={`md:w-64 bg-bg-base/50 /30 border-r border-border-subtle/50 /5 flex-shrink-0 flex-col ${mobileView === 'content' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-6 pb-2">
                                <h2 className="text-xl font-bold text-text-primary tracking-wide">
                                    {t('settings.title')}
                                </h2>
                            </div>
                            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                                {menuItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setActiveSection(item.id)
                                            setMobileView('content')
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-left transition-all ${activeSection === item.id
                                                ? 'md:bg-bg-base md: text-text-primary  md:text-[rgb(var(--color-ios-accent-light))] md:(var(--color-ios-accent-dark))] md:shadow-sm font-semibold'
                                                : 'text-text-secondary  bg-bg-main hover:text-text-primary  font-medium'
                                            }`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </nav>

                            {/* Â∫ïÈÉ®?âÈ??Ä */}
                            <div className="p-3 border-t border-border-subtle space-y-0.5">
                                {/* ÁÆ°Á?ÂæåÂè∞?•Âè£ÔºöÂ? admin / engineer ?ØË? */}
                                {(user?.role === 'admin' || user?.role === 'engineer') && (
                                    <button
                                        onClick={() => { setSettingsOpen(false); navigate('/admin') }}
                                        title="?çÂ?ÁÆ°Á?ÂæåÂè∞"
                                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-text-secondary bg-bg-main hover:text-text-primary transition-all font-medium text-sm group"
                                    >
                                        <span className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:scale-110 transition-transform">
                                            <ShieldIcon />
                                        </span>
                                        <span>ÁÆ°Á?ÂæåÂè∞</span>
                                        <svg className="w-3.5 h-3.5 ml-auto opacity-40 group-hover:opacity-70 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowQR(true)}
                                    title="?ÉÊ? QR Code ?®Ê?Ê©ü‰??ãÂ?"
                                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-text-secondary bg-bg-main hover:text-text-primary transition-all font-medium text-sm"
                                >
                                    <QrCodeIcon />
                                    <span>{t('settings.mobileScanner')}</span>
                                </button>
                            </div>
                        </div>

                        {/* ?ßÂÆπ?Ä??*/}
                        <div className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-transparent relative ${mobileView === 'menu' ? 'hidden md:block' : 'block'}`}>
                            <div className="p-6 md:p-10 min-h-full">
                                {/* Ë°åÂ??àË??ûÊ???*/}
                                <button 
                                    className="md:hidden mb-6 flex items-center text-corphia-bronze font-medium hover:opacity-80 transition-opacity"
                                    onClick={() => setMobileView('menu')}
                                >
                                    <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                    {t('common.cancel', 'ËøîÂ?')}
                                </button>
                                {/* ?ã‰∫∫Ë≥áÊ? */}
                                {activeSection === 'profile' && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                        <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-border-subtle">
                                            {t('settings.profile')}
                                        </h2>

                                    {/* ?≠Â??áË?Ë®?*/}
                                    <div className="flex items-center gap-8 mb-10">
                                        <div className="w-24 h-24 rounded-full bg-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] flex items-center justify-center text-text-primary text-4xl font-bold shadow-lg shrink-0">
                                            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                {isEditingName ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="text-xl font-bold text-text-primary bg-bg-base border border-corphia-bronze/50 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-corphia-bronze w-48"
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
                                                            className="p-1 px-2 text-sm bg-accent text-text-primary rounded-md flex-shrink-0"
                                                        >
                                                            {isUpdatingName ? t('common.loading') : t('common.save')}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setEditName(user?.name || '')
                                                                setIsEditingName(false)
                                                            }}
                                                            disabled={isUpdatingName}
                                                            className="p-1 px-2 text-sm bg-bg-surface text-text-primary rounded-md flex-shrink-0"
                                                        >
                                                            {t('common.cancel', '?ñÊ?')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h3 className="text-2xl font-bold text-text-primary">
                                                            {user?.name}
                                                        </h3>
                                                        <button 
                                                            onClick={() => setIsEditingName(true)}
                                                            className="text-text-muted hover:text-corphia-bronze transition-colors"
                                                            title={t('common.changeName')}
                                                        >
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-lg text-text-secondary mb-3">
                                                {user?.email}
                                            </p>
                                            <span className="inline-block px-4 py-1.5 text-sm font-semibold bg-[rgb(var(--color-ios-accent-light)/0.15)] (var(--color-ios-accent-dark)/0.15)] text-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] rounded-full">
                                                {user?.role}
                                            </span>
                                        </div>
                                    </div>

                                    {/* ‰øÆÊîπÂØÜÁ¢º?ÄÂ°?*/}
                                    <div className="mb-8">
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
                                            className="flex items-center gap-2 px-5 py-3 bg-bg-surface hover:bg-bg-surface text-text-primary font-semibold rounded-full transition-colors"
                                        >
                                            <LockIcon /> {t('auth.changePassword', '‰øÆÊîπÂØÜÁ¢º')}
                                        </button>
                                    </div>

                                    <div className="pt-4">
                                        <button
                                            onClick={handleLogout}
                                            className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-full transition-colors"
                                        >
                                            {t('auth.logout')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Â§ñË?Ë®≠Â? */}
                            {activeSection === 'appearance' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-border-subtle">
                                        {t('settings.theme')}
                                    </h2>

                                    <div className="flex gap-6 max-w-md">
                                        {/* ?•È?Ê®°Â? */}
                                        <button
                                            onClick={() => theme === 'dark' && toggleTheme()}
                                            className={`flex-1 p-4 rounded-[20px] transition-all border-2 ${theme === 'light'
                                                    ? 'border-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] bg-[rgb(var(--color-ios-accent-light)/0.05)] (var(--color-ios-accent-dark)/0.1)] ring-4 ring-[rgb(var(--color-ios-accent-light)/0.2)] (var(--color-ios-accent-dark)/0.2)]'
                                                    : 'border-border-subtle  hover:border-border-subtle '
                                                }`}
                                        >
                                            <div className="w-full h-24 rounded-xl bg-bg-base border border-border-subtle shadow-sm mb-4 flex items-center justify-center transition-transform hover:scale-105">
                                                <SunIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${theme === 'light' ? 'text-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))]' : 'text-text-primary '}`}>
                                                {t('settings.themeLight')}
                                            </p>
                                        </button>

                                        {/* Â§úÈ?Ê®°Â? */}
                                        <button
                                            onClick={() => theme === 'light' && toggleTheme()}
                                            className={`flex-1 p-4 rounded-[20px] transition-all border-2 ${theme === 'dark'
                                                    ? 'border-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] bg-[rgb(var(--color-ios-accent-light)/0.05)] (var(--color-ios-accent-dark)/0.1)] ring-4 ring-[rgb(var(--color-ios-accent-light)/0.2)] (var(--color-ios-accent-dark)/0.2)]'
                                                    : 'border-border-subtle  hover:border-border-subtle '
                                                }`}
                                        >
                                            <div className="w-full h-24 rounded-xl bg-bg-surface border border-border-subtle shadow-inner mb-4 flex items-center justify-center transition-transform hover:scale-105">
                                                <MoonIcon />
                                            </div>
                                            <p className={`text-[15px] font-semibold ${theme === 'dark' ? 'text-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))]' : 'text-text-primary '}`}>
                                                {t('settings.themeDark')}
                                            </p>
                                        </button>
                                    </div>

                                    {/* ?çÈ??≤Ë®≠ÂÆ?*/}
                                    <div className="mt-12">
                                        <h3 className="text-xl font-bold text-text-primary mb-6">
                                            {t('settings.accentColor', '?çÈ?È°èËâ≤')}
                                        </h3>
                                        <div className="flex flex-wrap gap-4">
                                            {(['default', 'blue', 'purple', 'pink', 'orange', 'green'] as const).map((color) => {
                                                const bgColors: Record<string, string> = {
                                                    default: 'bg-corphia-bronze',
                                                    blue: 'bg-[#3f8ef7]',
                                                    purple: 'bg-[#DB37F4]',
                                                    pink: 'bg-[#F64066]',
                                                    orange: 'bg-[#FB8D2D]',
                                                    green: 'bg-[#22D9C5]'
                                                }
                                                const isActive = accentColor === color
                                                return (
                                                    <button
                                                        key={color}
                                                        onClick={() => setAccentColor(color)}
                                                        className={`w-12 h-12 rounded-full ${bgColors[color]} shadow-sm transition-transform hover:scale-110 flex items-center justify-center`}
                                                        title={t(`settings.color_${color}`, color)}
                                                    >
                                                        {isActive && (
                                                            <svg className="w-6 h-6 text-text-primary drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* C2: RAG Debug Mode ?ãÈ? */}
                                    <div className="mt-12 max-w-md">
                                        <h3 className="text-xl font-bold text-text-primary mb-3">
                                            {t('settings.ragDebug', 'RAG ?§ÈåØÊ®°Â?')}
                                        </h3>
                                        <p className="text-[13px] text-text-secondary mb-4 leading-relaxed">
                                            {t('settings.ragDebugHint', '?ãÂ?ÂæåÔ?ÊØèÊ¨° AI ?ûÊ?‰∏ãÊñπ?ÉÈ°ØÁ§∫ÂëΩ‰∏≠Á??•Ë??áÊÆµ?ÅÁõ∏‰ººÂ∫¶?ÜÊï∏?áË∑Ø?±Ê±∫Á≠ñÔ??π‰æøËøΩËπ§Ê™¢Á¥¢?ÅË≥™??)}
                                        </p>
                                        <label className="flex items-center justify-between gap-3 px-5 py-3 rounded-full bg-bg-base border border-transparent cursor-pointer">
                                            <span className="text-[15px] font-semibold text-text-primary">
                                                ?? {t('settings.ragDebugToggle', 'È°ØÁ§∫ RAG Debug ?¢Êùø')}
                                            </span>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={ragDebugMode}
                                                onClick={() => setRAGDebugMode(!ragDebugMode)}
                                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                                    ragDebugMode
                                                        ? 'bg-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))]'
                                                        : 'bg-bg-surface '
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-bg-base shadow transition-transform ${
                                                        ragDebugMode ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </label>
                                    </div>
                                </motion.div>
                            )}

                            {/* Ë™ûË?Ë®≠Â? */}
                            {activeSection === 'language' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                                    <h2 className="text-2xl font-bold text-text-primary mb-8 pb-4 border-b border-border-subtle">
                                        {t('settings.language')}
                                    </h2>

                                    <div className="space-y-3 max-w-md">
                                        {languages.map(lang => (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`w-full flex items-center justify-between p-5 rounded-[20px] transition-all border-2 ${i18n.language === lang.code
                                                        ? 'bg-[rgb(var(--color-ios-accent-light)/0.05)] (var(--color-ios-accent-dark)/0.1)] text-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))] border-[rgb(var(--color-ios-accent-light))] (var(--color-ios-accent-dark))]'
                                                        : 'bg-bg-base  hover:bg-bg-base  text-text-primary  border-transparent shadow-sm'
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

                            {/* ‰ΩøÁî®Ë™™Ê? */}
                            {activeSection === 'guide' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <GuideSection />
                                </motion.div>
                            )}

                            {activeSection === 'monitor' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <SystemMonitorPanel />
                                </motion.div>
                            )}

                            {activeSection === 'about' && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="h-full flex-1 min-h-0 flex flex-col">
                                    <AboutSection />
                                </motion.div>
                            )}

                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            </AnimatePresence>



            <AnimatePresence>
                {showPasswordForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPasswordForm(false)}
                            className="absolute inset-0 bg-black/50 backdrop-blur-md"
                        />

                        {/* Card ??‰ªøÁôª?•È?Ê≠?ñπÂΩ¢Âç°?áÈ¢®??*/}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            transition={{ type:"spring", stiffness: 300, damping: 28 }}
                            className="relative w-full max-w-[640px] bg-bg-base shadow-2xl dark:shadow-black border border-border-subtle rounded-[38px] p-9 flex flex-col gap-6 transition-colors overflow-hidden"
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowPasswordForm(false)}
                                className="absolute top-5 right-5 p-2 text-text-muted hover:text-text-primary bg-bg-main rounded-full transition-colors"
                            >
                                <CloseIcon />
                            </button>

                            {/* Title */}
                            <div>
                                <h3 className="text-[22px] font-bold text-text-primary tracking-tight">
                                    {t('auth.changePassword', '‰øÆÊîπÂØÜÁ¢º')}
                                </h3>
                            </div>

                            {/* ?©Ê?ÂºèÂ?Á¢ºË???+ Ëº∏ÂÖ•Ê¨Ñ‰? */}
                            <div className="flex gap-6">
                                {/* Â∑¶Ê?ÔºöÂ?Á¢ºË???*/}
                                <div className="flex-1 bg-bg-base rounded-[20px] p-5 text-[13px] text-text-secondary space-y-2.5 border border-transparent">
                                    <p className="font-semibold text-text-primary text-[14px] mb-2">ÂØÜÁ¢ºÂÆâÂÖ®Ë¶ÅÊ?</p>
                                    {[
                                        '?≥Â? 8 ?ãÂ???,
                                        '?ÖÂê´Â§ßÂØ´Â≠óÊ? (A-Z)',
                                        '?ÖÂê´Â∞èÂØ´Â≠óÊ? (a-z)',
                                        '?ÖÂê´?∏Â? (0-9)',
                                        '?ÖÂê´?πÊ?Â≠óÂ?',
                                    ].map((rule, i) => {
                                        const passed = passwordStrength
                                            ? !passwordStrength.errors.some(e => e.includes(rule.split(' ')[1] || rule))
                                            : null
                                        return (
                                            <div key={i} className={`flex items-center gap-1.5 transition-colors ${
                                                passed === true ? 'text-green-600 ' :
                                                passed === false ? 'text-red-500 ' : ''
                                            }`}>
                                                {passed === true ? (
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : passed === false ? (
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                ) : (
                                                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">??/span>
                                                )}
                                                <span>{rule}</span>
                                            </div>
                                        )
                                    })}

                                    {/* ÂØÜÁ¢ºÂº∑Â∫¶Ê¢???ÁΩÆÊñºÂ∑¶Ê?Â∫ïÈÉ® */}
                                    <AnimatePresence>
                                        {passwordStrength && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="pt-3 mt-1 border-t border-border-subtle/60 /10 overflow-hidden"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[11px] text-text-secondary">Âº∑Â∫¶</span>
                                                    <span className={`text-[11px] font-semibold ml-auto ${
                                                        passwordStrength.level === 'very_strong' ? 'text-green-600 ' :
                                                        passwordStrength.level === 'strong' ? 'text-light-accent ' :
                                                        passwordStrength.level === 'medium' ? 'text-yellow-600 ' :
                                                        'text-red-600 '
                                                    }`}>
                                                        {getStrengthLabel(passwordStrength.level)}
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-bg-surface rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${getStrengthColor(passwordStrength.level)}`}
                                                        style={{ width: `${passwordStrength.score}%` }}
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* ?≥Ê?ÔºöËº∏?•Ê?‰Ω?*/}
                                <div className="flex-1 flex flex-col justify-evenly">
                                    {/* ?∂Â?ÂØÜÁ¢º */}
                                    <PwdFloatingInput
                                        label="?∂Â?ÂØÜÁ¢º"
                                        value={currentPassword}
                                        onChange={v => { setCurrentPassword(v); setPasswordError('') }}
                                    />

                                    {/* ?∞Â?Á¢?*/}
                                    <PwdFloatingInput
                                        label="?∞Â?Á¢?
                                        value={newPassword}
                                        onChange={handleNewPasswordChange}
                                    />

                                    {/* Á¢∫Ë??∞Â?Á¢?*/}
                                    <div>
                                        <PwdFloatingInput
                                            label="Á¢∫Ë??∞Â?Á¢?
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
                                                    ÂØÜÁ¢º‰∏ç‰???
                                                </motion.p>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* Ë®äÊÅØ */}
                            <AnimatePresence>
                                {(passwordError || passwordSuccess) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        {passwordError && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2.5 w-full bg-red-50 text-red-600 rounded-full text-[13px] font-medium border border-red-200">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                {passwordError}
                                            </div>
                                        )}
                                        {passwordSuccess && (
                                            <div className="inline-flex items-center gap-2 px-4 py-2.5 w-full bg-green-50 text-green-600 rounded-full text-[13px] font-medium border border-green-200">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {passwordSuccess}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ?ê‰∫§?âÈ? ??‰ªøÁôª?•È??çÂ??ìË??âÈ? */}
                            <button
                                onClick={handleChangePassword}
                                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                className="w-full py-3 bg-accent hover:bg-opacity-90 disabled:opacity-50 text-text-primary font-semibold rounded-full transition-all text-[15px] shadow-sm focus:outline-none focus:ring-2 focus:ring-corphia-bronze focus:ring-offset-2"
                            >
                                {isChangingPassword ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        ‰øÆÊîπ‰∏?..
                                    </span>
                                ) : 'Á¢∫Ë?‰øÆÊîπÂØÜÁ¢º'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* QR Code ÂΩàÁ? */}
            <AnimatePresence>
                {showQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
                        onClick={() => setShowQR(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type:"spring", damping: 25, stiffness: 300 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-bg-base p-5 rounded-[32px] shadow-2xl flex flex-col items-center gap-4"
                        >
                            {/* QR Code ?ñÁ? */}
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=${encodeURIComponent(window.location.origin)}`}
                                alt="Mobile Access QR Code"
                                className="w-full max-w-[380px] aspect-square object-contain mx-auto rounded-[16px]"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

// ?Ä?Ä ÂØÜÁ¢ºËº∏ÂÖ•Ê°ÜÔ?‰ªøÁôª?•È? FloatingInput È¢®Ê†ºÔº??Ä?Ä
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
                className={`peer w-full px-5 py-3.5 rounded-full bg-bg-base  border border-transparent  text-text-primary  text-[15px] outline-none focus:ring-1 focus:ring-corphia-bronze  transition-all placeholder:text-transparent ${isFilled ? 'pr-12' : ''}`}
            />
            <label className={`absolute left-4 -translate-y-1/2 transition-all duration-300 pointer-events-none rounded-full px-2 origin-left whitespace-nowrap
                ${isFilled
                    ? 'top-0 scale-[0.82] bg-bg-main  text-text-primary  font-semibold py-0.5'
                    : 'top-1/2 scale-100 bg-transparent text-text-secondary  py-0'}
                peer-focus:top-0 peer-focus:scale-[0.82] peer-bg-accent dark:peer-bg-accent peer-text-text-primary peer-focus:font-semibold peer-focus:py-0.5
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
                            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                        >
                            {visible ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
