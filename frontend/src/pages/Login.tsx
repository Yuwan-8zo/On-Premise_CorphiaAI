/**
 * 登入/註冊頁面
 * 
 * 卡片內排版改為靈活設計：1:1 正方形
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { authApi } from '../api/auth'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { QrCode, MessageSquare, FileText, Shield } from 'lucide-react'
import { CorphiaLogo, CorphiaTextLogo, CorphiaBrandLogo, CorphiaWordmark } from '../components/icons/CorphiaIcons'

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    delayClass?: string;
    id?: string;
    error?: string;
}

const FloatingInput = ({ label, delayClass, id, value, className, type = 'text', error, onFocus, onBlur, ...props }: FloatingInputProps) => {
    const isFilled = Boolean(value && value.toString().length > 0);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isPasswordType = type === 'password';
    const isFloating = isFilled || isFocused;
    
    const inputType = isPasswordType ? (isPasswordVisible ? 'text' : 'password') : type;
    
    return (
        <div className={`relative w-full shrink-0 ${delayClass || ''}`}>
            <input
                id={id}
                type={inputType}
                value={value}
                onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
                onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
                className={`w-full px-5 py-3.5 rounded-full bg-bg-surface border text-text-primary text-[15px] outline-none transition-all placeholder:text-transparent ${isPasswordType && isFilled ? 'pr-12' : ''} ${
                    error ? 'border-red-500 focus:border-red-500' : 'border-border-subtle focus:border-corphia-bronze focus:shadow-md focus:ring-0'
                } ${className || ''}`}
                placeholder={label}
                {...props}
            />
            <motion.label
                htmlFor={id}
                animate={isFloating ? {
                    top: 0,
                    scale: 0.85,
                    color: error ? '#ef4444' : 'rgb(var(--accent))',
                    backgroundColor: 'var(--label-bg, #FFFFFF)',
                } : {
                    top: '50%',
                    scale: 1,
                    color: error ? '#ef4444' : 'rgb(var(--text-muted))',
                    backgroundColor: 'transparent',
                }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-5 pointer-events-none rounded-full px-3 py-0.5 origin-left whitespace-nowrap dark:[--label-bg:#1C1815]"
                style={{ y: '-50%' }}
            >
                {label}
            </motion.label>

            {error && (
                <div className={`absolute top-[2px] bottom-[2px] flex items-center pointer-events-none z-10 ${isPasswordType && isFilled ? 'right-10' : 'right-[2px]'}`}>
                    <div className="w-8 h-full bg-gradient-to-r from-transparent to-bg-surface" />
                    <div className="bg-bg-surface h-full flex items-center pr-4 pl-1 rounded-r-full">
                        <span className="text-xs font-semibold text-red-500 whitespace-nowrap">
                            {error}
                        </span>
                    </div>
                </div>
            )}

            {isPasswordType && (
                <AnimatePresence>
                    {isFilled && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8, y:"-50%" }}
                            animate={{ opacity: 1, scale: 1, y:"-50%" }}
                            exit={{ opacity: 0, scale: 0.8, y:"-50%" }}
                            transition={{ duration: 0.2 }}
                            type="button"
                            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            className="absolute right-4 top-1/2 p-2 text-text-muted hover:text-text-secondary transition-colors focus:outline-none"
                            tabIndex={-1}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={isPasswordVisible ? 'visible' : 'hidden'}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {isPasswordVisible ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()
    const { theme, toggleTheme, language, setLanguage } = useUIStore()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
    const [showQR, setShowQR] = useState(false) // 控制 QR Modal 顯示狀態
    const langMenuRef = useRef<HTMLDivElement>(null)
    
    // 登入用的輸入狀態
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // 註冊專用的確認密碼狀態
    const [confirmPassword, setConfirmPassword] = useState('')

    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')
    const [hasInitialConnected, setHasInitialConnected] = useState(false)
    const [showSkipLoading, setShowSkipLoading] = useState(false)

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

    // 檢查後端狀態
    useEffect(() => {
        let isCancelled = false
        const checkBackend = async () => {
            try {
                const response = await fetch('/api/v1/health')
                if (response.ok) {
                    if (!isCancelled) {
                        setBackendStatus('online')
                        setHasInitialConnected(true)
                    }
                } else {
                    if (!isCancelled) setBackendStatus('offline')
                }
            } catch {
                if (!isCancelled) setBackendStatus('offline')
            }
        }
        
        checkBackend()
        
        // 未連線時快速輪詢連線狀態 (每 3 秒)，成功連線後放緩至 30 秒輪詢
        const intervalId = setInterval(() => {
            checkBackend()
        }, hasInitialConnected ? 30000 : 3000)

        return () => {
            isCancelled = true
            clearInterval(intervalId)
        }
    }, [hasInitialConnected])

    useEffect(() => {
        if (!hasInitialConnected) {
            const timer = setTimeout(() => {
                setShowSkipLoading(true)
            }, 10000)
            return () => clearTimeout(timer)
        }
    }, [hasInitialConnected])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
                setIsLangMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLanguageSelect = (lang: 'zh-TW' | 'en-US' | 'ja-JP') => {
        setLanguage(lang)
        i18n.changeLanguage(lang)
        setIsLangMenuOpen(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setFieldErrors({})
        
        let hasError = false
        const newFieldErrors: Record<string, string> = {}
        
        if (!email.trim()) {
            newFieldErrors.email = t('auth.account') + '不能為空'
            hasError = true
        }
        if (!password) {
            newFieldErrors.password = t('auth.password') + '不能為空'
            hasError = true
        }
        if (activeTab === 'register' && !confirmPassword) {
            newFieldErrors.confirmPassword = t('auth.confirmPassword') + '不能為空'
            hasError = true
        }

        if (hasError) {
            setFieldErrors(newFieldErrors)
            return
        }

        setLoading(true)

        try {
            if (activeTab === 'register') {
                if (password !== confirmPassword) {
                    setFieldErrors({ confirmPassword: t('auth.passwordMismatch') })
                    setLoading(false)
                    return
                }
                await authApi.register({ email, password })
            }
            
            const tokens = await authApi.login({ email, password })
            useAuthStore.setState({ accessToken: tokens.accessToken })
            const user = await authApi.me()
            setAuth(user, tokens.accessToken, tokens.refreshToken)
            navigate(from, { replace: true })
        } catch (err: unknown) {
            console.error('Auth error:', err)
            const axiosError = err as {
                response?: {
                    status?: number
                    data?: {
                        detail?: string
                        error?: { message?: string; code?: string }
                        errors?: Array<{ field: string; message: string }>
                    }
                }
            }
            const status = axiosError?.response?.status
            const data = axiosError?.response?.data

            if (status === 429) {
                setFieldErrors({ password: data?.detail || data?.error?.message || '請求過於頻繁，或者發生了錯誤' })
            } else if (status === 422) {
                const details = (data as { error?: { details?: Array<{ field: string; message: string }> } })?.error?.details
                if (details && details.length > 0) {
                    const pwdError = details.find(d => d.field?.includes('password'))
                    if (pwdError) {
                        const cleaned = pwdError.message.replace(/^Value error,\s*/i, '')
                        setFieldErrors({ password: cleaned })
                    } else {
                        setFieldErrors({ password: details.map(d => d.message.replace(/^Value error,\s*/i, '')).join(', ') })
                    }
                } else {
                    setFieldErrors({ password: activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed') })
                }
            } else if (data?.detail) {
                setFieldErrors({ password: data.detail })
            } else if (data?.error?.message) {
                setFieldErrors({ password: data.error.message })
            } else {
                setFieldErrors({ password: activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed') })
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-bg-base transition-colors duration-300 relative overflow-hidden select-none">
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02] transition-colors duration-300" d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03] transition-colors duration-300" d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.02] dark:opacity-[0.01] transition-colors duration-300" d="M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z" />
                </svg>
            </div>

            <AnimatePresence>
                {!hasInitialConnected && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease:"easeInOut" }}
                        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/50 backdrop-blur-md"
                    >
                        <motion.div
                            animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.7, 1, 0.7] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease:"easeInOut" }}
                            className="flex flex-col items-center gap-6"
                        >
                            <CorphiaLogo className="w-24 h-24 text-corphia-bronze drop-shadow-lg" />
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h2 className="text-2xl font-bold text-text-primary">
                                    Corphia AI 啟動中...
                                </h2>
                                <p className="text-text-secondary">
                                    正在連線至後端伺服器，這可能需要幾秒鐘...
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-2">
                                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </motion.div>
                        
                        <AnimatePresence>
                            {showSkipLoading && (
                                <motion.button
                                    initial={{ opacity: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, marginTop: 32 }}
                                    onClick={() => setHasInitialConnected(true)}
                                    className="text-sm text-text-muted hover:text-text-secondary underline transition-colors"
                                >
                                    跳過等待，直接進入主畫面
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
                        onClick={() => setShowQR(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type:"spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-bg-base p-6 rounded-[32px] shadow-2xl flex flex-col items-center"
                        >
                            <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=${encodeURIComponent(window.location.origin)}`} 
                                alt="Mobile Access QR Code" 
                                className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-[16px]"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 左側：歡迎與特色 (佔滿 50%) ── */}
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative z-10">
                <div className="flex items-center gap-2 bg-bg-base border border-border-subtle px-3 py-1.5 rounded-full w-fit shadow-sm dark:shadow-none transition-colors">
                    <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500' :
                        backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                    <span className="text-sm text-text-secondary">Backend:</span>
                    <span className={`text-sm ${backendStatus === 'online' ? 'text-green-600 ' :
                        backendStatus === 'offline' ? 'text-red-600 ' : 'text-yellow-600 '
                        }`}>
                        {backendStatus === 'online' ? 'Online' :
                            backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                </div>

                <div className="flex-1 flex flex-col justify-center w-fit mx-auto">
                    <div className="w-full">
                        <h2 className="text-4xl font-bold text-text-primary relative z-10 transition-colors">
                            {t('auth.welcomeTitle')}
                        </h2>
                        <div className="mt-6 -mb-12 -ml-2 relative z-0 flex items-center">
                            {/* 利用原生高度放大，改用正邊距往下推離標題，並用較大負邊距拉近下方選單 */}
                            <CorphiaWordmark className="h-[130px] w-auto object-contain object-left pointer-events-none select-none" />
                        </div>

                        <div className="space-y-6 mt-8">
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated border border-transparent flex items-center justify-center relative">
                                    <MessageSquare className="w-6 h-6 text-corphia-bronze" />
                                    <span className="absolute text-[10px] font-bold text-corphia-bronze mt-[-2px]">AI</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[1.1rem] font-medium text-text-primary transition-colors leading-tight mb-1">{t('auth.feature1')}</span>
                                    <span className="text-sm text-text-secondary transition-colors">{t('auth.feature1Desc')}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated border border-transparent flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-corphia-bronze" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[1.1rem] font-medium text-text-primary transition-colors leading-tight mb-1">{t('auth.feature2')}</span>
                                    <span className="text-sm text-text-secondary transition-colors">{t('auth.feature2Desc')}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated border border-transparent flex items-center justify-center relative">
                                    <Shield className="w-6 h-6 text-corphia-bronze" />
                                    <span className="absolute text-[10px] font-bold text-corphia-bronze mt-[2px]">A</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[1.1rem] font-medium text-text-primary transition-colors leading-tight mb-1">{t('auth.feature3')}</span>
                                    <span className="text-sm text-text-secondary transition-colors">{t('auth.feature3Desc')}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <button
                    onClick={() => setShowQR(true)}
                    className="absolute bottom-8 left-8 flex items-center justify-center bg-bg-base/60 /5 backdrop-blur-md border border-border-subtle rounded-full p-1.5 shadow-sm hover:bg-bg-base/80 /10 hover:scale-[1.02] transition-all group z-10"
                    title={t('auth.scanToDownload')}
                >
                    <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center group-hover:bg-corphia-card transition-colors">
                        <QrCode className="w-[18px] h-[18px] text-text-primary" />
                    </div>
                </button>
            </div>

            {/* ── 右側：登入表單 (佔滿 50%，手機 100%) ── */}
            <div className="w-full lg:w-1/2 flex flex-col z-10">
                <div className="flex justify-between items-center p-6 w-full">
                    <div className="lg:hidden flex items-center gap-2 bg-bg-base border border-border-subtle px-3 py-1.5 rounded-full shadow-sm dark:shadow-none transition-colors">
                        <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-500' :
                            backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></span>
                        <span className="text-xs font-medium text-text-secondary">Backend:</span>
                        <span className={`text-xs font-semibold ${backendStatus === 'online' ? 'text-green-600 ' :
                            backendStatus === 'offline' ? 'text-red-600 ' : 'text-yellow-600 '
                            }`}>
                            {backendStatus === 'online' ? 'Online' :
                                backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                        </span>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button
                        onClick={toggleTheme}
                        className="p-2 text-text-muted hover:text-text-secondary transition-colors"
                        title={t('settings.theme')}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929M12 17a5 5 0 100-10 5 5 0 000 10z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>

                    <div className="relative" ref={langMenuRef}>
                        <button
                            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                            className={`p-2 transition-colors rounded-full ${isLangMenuOpen ? 'text-text-primary  bg-bg-surface ' : 'text-text-muted  hover:text-text-secondary  hover:bg-bg-base '}`}
                            title={t('settings.language')}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                        </button>
                        
                        <AnimatePresence>
                            {isLangMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute right-0 mt-2 w-28 bg-bg-base border border-border-subtle shadow-xl rounded-[20px] overflow-hidden z-50 flex flex-col p-1.5"
                                >
                                    <button 
                                        onClick={() => handleLanguageSelect('zh-TW')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between ${language === 'zh-TW' ? 'text-white font-semibold bg-accent' : 'text-text-secondary  hover:bg-bg-base '}`}
                                    >
                                        繁體中文
                                    </button>
                                    <button 
                                        onClick={() => handleLanguageSelect('en-US')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'en-US' ? 'text-white font-semibold bg-accent' : 'text-text-secondary  hover:bg-bg-base '}`}
                                    >
                                        English
                                    </button>
                                    <button 
                                        onClick={() => handleLanguageSelect('ja-JP')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'ja-JP' ? 'text-white font-semibold bg-accent' : 'text-text-secondary  hover:bg-bg-base '}`}
                                    >
                                        日本語
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    </div>
                </div>
                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6">
                    <h2 className="text-xl font-bold text-text-primary mb-1 transition-colors">
                        {t('auth.welcomeTitle')}
                    </h2>
                    <h1 className="text-[40px] font-extrabold text-text-primary mb-3 transition-colors flex items-center justify-center gap-4">
                        <CorphiaLogo className="w-12 h-12" />
                        Corphia
                    </h1>
                    <p className="text-text-secondary text-sm whitespace-nowrap">{t('auth.engineDesc')}</p>
                </div>

                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        className="w-full max-w-[360px] bg-bg-base/60 backdrop-blur-2xl shadow-2xl dark:shadow-black/50 border border-border-subtle rounded-[38px] p-5 flex flex-col transition-colors aspect-square relative z-20"
                    >
                    <LayoutGroup>
                        {/* ── Pill Tab 切換（滑動背景） ── */}
                        <div
                            className="relative flex rounded-full select-none cursor-pointer bg-bg-base border border-border-subtle transition-colors shrink-0"
                            style={{ padding: '5px' }}
                        >
                            <motion.div
                                className="absolute top-[5px] bottom-[5px] w-[calc(50%-5px)] bg-bg-elevated shadow-sm rounded-full border border-border-subtle"
                                initial={false}
                                animate={{ x: activeTab === 'login' ? 0 : '100%' }}
                                transition={{ type:"tween", duration: 0.3, ease:"easeInOut" }}
                                style={{ left: '5px', zIndex: 1 }}
                            />
                            <button
                                type="button"
                                onClick={() => setActiveTab('login')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'login' ? 'text-text-primary ' : 'text-text-secondary  hover:text-text-primary '
                                }`}
                            >
                                {t('auth.login')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('register')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'register' ? 'text-text-primary ' : 'text-text-secondary  hover:text-text-primary '
                                }`}
                            >
                                {t('auth.register')}
                            </button>
                        </div>

                        <motion.div layout className="flex-1" />

                        <motion.div layout className="shrink-0 w-full">
                            <FloatingInput
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setFieldErrors(prev => ({...prev, email: ''})) }}
                                required
                                label={t('auth.account')}
                                error={fieldErrors.email}
                            />
                        </motion.div>

                        <motion.div layout className="flex-1" />

                        <motion.div layout className="shrink-0 w-full">
                            <FloatingInput
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setFieldErrors(prev => ({...prev, password: ''})) }}
                                required
                                label={t('auth.password')}
                                error={fieldErrors.password}
                            />
                        </motion.div>

                        {/* ── Spacer B2：保留在 DOM，但只有註冊有 flexGrow ── */}
                        <motion.div
                            animate={{ flexGrow: activeTab === 'register' ? 1 : 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            style={{ flexShrink: 0, flexBasis: 0, minHeight: 0 }}
                        />

                        {/* ── Confirm Password：保留在 DOM，但只有註冊可見 ── */}
                        <motion.div
                            className="w-full shrink-0"
                            animate={{
                                height: activeTab === 'register' ? 'auto' : 0,
                                opacity: activeTab === 'register' ? 1 : 0,
                            }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            style={{ pointerEvents: activeTab === 'register' ? 'auto' : 'none' }}
                        >
                            <FloatingInput
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({...prev, confirmPassword: ''})) }}
                                required={activeTab === 'register'}
                                label={t('auth.confirmPassword')}
                                tabIndex={activeTab === 'register' ? 0 : -1}
                                error={fieldErrors.confirmPassword}
                            />
                        </motion.div>

                        {/* ── Spacer C (底部留白比例 1.15) ── */}
                        <motion.div layout className="flex-[1.15]" />

                        {/* 底部按鈕與錯誤提示區塊 */}
                        <div className="w-full flex flex-col gap-3 shrink-0">
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, height: 0, marginTop: 0 }}
                                            animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 4 }}
                                            exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0 }}
                                            className="w-full text-center overflow-hidden"
                                        >
                                            <div className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-200 shadow-sm transition-colors">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>{error}</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* 處理按鈕 */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-2.5 bg-corphia-bronze hover:bg-opacity-90 text-white font-semibold rounded-full text-[15px]
 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-corphia-ivory focus:ring-corphia-bronze
 disabled:opacity-50 disabled:cursor-not-allowed
 transition-all border border-transparent shadow-sm"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            {t('common.loading')}
                                        </span>
                                    ) : (
                                        activeTab === 'login' ? t('auth.login') : t('auth.register')
                                    )}
                                </button>
                        </div>
                    </LayoutGroup>
                    </form>
                </div>
            </div>

        </div>
    )
}

