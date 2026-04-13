/**
 * 登入/註冊頁面
 * 
 * 精確復刻用戶設計：1:1 正方形卡片
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { authApi } from '../api/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode } from 'lucide-react'
import { CorphiaLogo } from '../components/icons/CorphiaIcons'

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    delayClass?: string;
    id?: string;
}

const FloatingInput = ({ label, delayClass, id, value, className, type = 'text', ...props }: FloatingInputProps) => {
    const isFilled = Boolean(value && value.toString().length > 0);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPasswordType = type === 'password';
    
    const inputType = isPasswordType ? (isPasswordVisible ? 'text' : 'password') : type;
    
    return (
        <div className={`relative w-full shrink-0 animate-fade-in ${delayClass || ''}`}>
            <input
                id={id}
                type={inputType}
                value={value}
                className={`peer w-full px-5 py-3.5 rounded-full bg-ios-light-gray6 dark:bg-ios-dark-gray4 border border-transparent dark:border-ios-dark-gray3 text-black dark:text-white text-[15px] outline-none focus:ring-1 focus:ring-ios-blue-light dark:focus:ring-ios-blue-dark transition-all placeholder:text-transparent ${isPasswordType && isFilled ? 'pr-12' : ''} ${className || ''}`}
                placeholder={label}
                {...props}
            />
            <label
                htmlFor={id}
                className={`absolute left-5 -translate-y-1/2 transition-all duration-300 pointer-events-none rounded-full px-3 origin-left whitespace-nowrap
                    ${isFilled 
                        ? 'top-0 scale-[0.85] bg-black dark:bg-white text-white dark:text-black font-semibold py-0.5' 
                        : 'top-1/2 scale-100 bg-transparent text-ios-light-gray1 dark:text-ios-dark-gray1 py-0'}
                    peer-focus:top-0 peer-focus:scale-[0.85] peer-focus:bg-ios-blue-light dark:peer-focus:bg-ios-blue-dark peer-focus:text-white dark:peer-focus:text-white peer-focus:font-semibold peer-focus:py-0.5
                `}
            >
                {label}
            </label>

            {isPasswordType && (
                <AnimatePresence>
                    {isFilled && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8, y: "-50%" }}
                            animate={{ opacity: 1, scale: 1, y: "-50%" }}
                            exit={{ opacity: 0, scale: 0.8, y: "-50%" }}
                            transition={{ duration: 0.2 }}
                            type="button"
                            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            className="absolute right-4 top-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors focus:outline-none"
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
    const [showQR, setShowQR] = useState(false) // 新增 QR Modal 狀態
    const langMenuRef = useRef<HTMLDivElement>(null)
    
    // 共用的輸入狀態
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // 註冊專用的確認密碼狀態
    const [confirmPassword, setConfirmPassword] = useState('')

    const [error, setError] = useState('')
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking')

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

    // 檢查後端狀態
    useEffect(() => {
        const checkBackend = async () => {
            try {
                const response = await fetch('/api/v1/health')
                if (response.ok) {
                    setBackendStatus('online')
                } else {
                    setBackendStatus('offline')
                }
            } catch {
                setBackendStatus('offline')
            }
        }
        checkBackend()
        const interval = setInterval(checkBackend, 30000)
        return () => clearInterval(interval)
    }, [])

    // 點擊外部關閉選單
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
                setIsLangMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // 語言選擇處理
    const handleLanguageSelect = (lang: 'zh-TW' | 'en-US' | 'ja-JP') => {
        setLanguage(lang as any)
        i18n.changeLanguage(lang)
        setIsLangMenuOpen(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (activeTab === 'register') {
                if (password !== confirmPassword) {
                    setError(t('auth.passwordMismatch'))
                    setLoading(false)
                    return
                }
                await authApi.register({ email, password })
            }
            
            // 無論登入或註冊成功後都執行登入
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
                // 速率限制：後端同時回傳 detail 和 error.message
                setError(data?.detail || data?.error?.message || '請求過於頻繁，請稍後再試')
            } else if (status === 422) {
                // Pydantic 驗證錯誤 (密碼強度不符合等)
                // 後端回傳格式: { error: { details: [{ field, message }] } }
                const details = (data as any)?.error?.details as Array<{ field: string; message: string }> | undefined
                if (details && details.length > 0) {
                    // 找密碼相關的錯誤
                    const pwdError = details.find(d => d.field?.includes('password'))
                    if (pwdError) {
                        // msg 格式為 "Value error, 密碼長度至少...; 密碼需包含..."
                        const cleaned = pwdError.message.replace(/^Value error,\s*/i, '')
                        setError(cleaned)
                    } else {
                        setError(details.map(d => d.message.replace(/^Value error,\s*/i, '')).join('；'))
                    }
                } else {
                    setError(activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'))
                }
            } else if (data?.detail) {
                setError(data.detail)
            } else if (data?.error?.message) {
                setError(data.error.message)
            } else {
                setError(activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white dark:bg-ios-dark-gray6 transition-colors duration-300 relative overflow-hidden">
            {/* ── 全螢幕 QR Code 虛化背景 Modal ── */}
            <AnimatePresence>
                {showQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
                        onClick={() => setShowQR(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white p-6 rounded-[32px] shadow-2xl flex flex-col items-center"
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

            {/* ── 左側：品牌介紹 (桌面 50%) ── */}
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative">
                {/* 後端狀態指示器 */}
                <div className="flex items-center gap-2 bg-white dark:bg-ios-dark-gray5 border border-gray-200 dark:border-white/5 px-3 py-1.5 rounded-full w-fit shadow-sm dark:shadow-none transition-colors">
                    <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500' :
                        backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Backend:</span>
                    <span className={`text-sm ${backendStatus === 'online' ? 'text-green-600 dark:text-green-400' :
                        backendStatus === 'offline' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                        {backendStatus === 'online' ? 'Online' :
                            backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                </div>

                {/* 品牌內容 - 垂直水平絕對置中 */}
                <div className="flex-1 flex flex-col justify-center w-fit mx-auto">
                    <div className="w-full">
                        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">
                            {t('auth.welcomeTitle')}
                        </h2>
                        <h1 className="text-[64px] font-extrabold text-gray-900 dark:text-white mb-6 transition-colors flex items-center tracking-tight">
                            <CorphiaLogo className="w-[68px] h-[68px] mt-1 mr-[2px]" />
                            orphia
                        </h1>
                        <p className="text-gray-600 dark:text-gray-500 mb-10 transition-colors">
                            {t('auth.engineDesc')}
                        </p>

                        {/* 功能列表 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-ios-blue-light dark:bg-ios-blue-dark"></span>
                                <span className="text-black dark:text-white transition-colors">{t('auth.feature1')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-ios-blue-light dark:bg-ios-blue-dark"></span>
                                <span className="text-black dark:text-white transition-colors">{t('auth.feature2')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-ios-blue-light dark:bg-ios-blue-dark"></span>
                                <span className="text-black dark:text-white transition-colors">{t('auth.feature3')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 左下角：顯示 QR Code 按鈕 (僅圖示) */}
                <button
                    onClick={() => setShowQR(true)}
                    title="掃描條碼體驗行動版"
                    className="absolute bottom-8 left-8 flex items-center justify-center w-12 h-12 bg-white/70 dark:bg-ios-dark-gray5/70 backdrop-blur-lg border border-gray-200/50 dark:border-white/10 rounded-full shadow-sm hover:scale-105 hover:bg-white dark:hover:bg-ios-dark-gray4 transition-all group z-10"
                >
                    <QrCode className="w-[22px] h-[22px] text-gray-700 dark:text-gray-300 group-hover:scale-110 transition-transform" />
                </button>
            </div>

            {/* ── 右側：登入表單 (桌面 50%，手機 100%) ── */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {/* 頂部區塊 (手機版顯示左側狀態與右側按鈕，桌面版只顯示右側按鈕) */}
                <div className="flex justify-between items-center p-6 w-full">
                    <div className="lg:hidden flex items-center gap-2 bg-white dark:bg-ios-dark-gray5 border border-gray-200 dark:border-white/5 px-3 py-1.5 rounded-full shadow-sm dark:shadow-none transition-colors">
                        <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-500' :
                            backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Backend:</span>
                        <span className={`text-xs font-semibold ${backendStatus === 'online' ? 'text-green-600 dark:text-green-400' :
                            backendStatus === 'offline' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                            }`}>
                            {backendStatus === 'online' ? 'Online' :
                                backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                        </span>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button
                        onClick={toggleTheme}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors"
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
                            className={`p-2 transition-colors rounded-full ${isLangMenuOpen ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-ios-dark-gray4' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-ios-dark-gray4'}`}
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
                                    className="absolute right-0 mt-2 w-28 bg-white dark:bg-ios-dark-gray5 border border-gray-100 dark:border-white/5 shadow-xl rounded-[20px] overflow-hidden z-50 flex flex-col p-1.5"
                                >
                                    <button 
                                        onClick={() => handleLanguageSelect('zh-TW')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between ${language === 'zh-TW' ? 'text-ios-blue-light dark:text-ios-blue-dark font-semibold bg-ios-blue-light/10 dark:bg-ios-blue-dark/20' : 'text-ios-light-gray1 dark:text-ios-dark-gray1 hover:bg-ios-light-gray6 dark:hover:bg-ios-dark-gray5'}`}
                                    >
                                        繁體中文
                                    </button>
                                    <button 
                                        onClick={() => handleLanguageSelect('en-US')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'en-US' ? 'text-ios-blue-light dark:text-ios-blue-dark font-semibold bg-ios-blue-light/10 dark:bg-ios-blue-dark/20' : 'text-ios-light-gray1 dark:text-ios-dark-gray1 hover:bg-ios-light-gray6 dark:hover:bg-ios-dark-gray5'}`}
                                    >
                                        English
                                    </button>
                                    <button 
                                        onClick={() => handleLanguageSelect('ja-JP')}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'ja-JP' ? 'text-ios-blue-light dark:text-ios-blue-dark font-semibold bg-ios-blue-light/10 dark:bg-ios-blue-dark/20' : 'text-ios-light-gray1 dark:text-ios-dark-gray1 hover:bg-ios-light-gray6 dark:hover:bg-ios-dark-gray5'}`}
                                    >
                                        日本語
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    </div>
                </div>
                {/* 手機版品牌標題 (僅在行動裝置顯示) */}
                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">
                        {t('auth.welcomeTitle')}
                    </h2>
                    <h1 className="text-[40px] font-extrabold text-gray-900 dark:text-white mb-3 transition-colors flex items-center justify-center gap-4">
                        <CorphiaLogo className="w-12 h-12" />
                        Corphia
                    </h1>
                    <p className="text-gray-500 text-sm whitespace-nowrap">{t('auth.engineDesc')}</p>
                </div>

                {/* 登入卡片容器 - 居中 */}
                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    {/* 卡片本體：強制 1:1 正方形，上下元素固定於邊緣，中間輸入框緊密群聚 */}
                    <motion.form
                        onSubmit={handleSubmit}
                        className="w-full max-w-[360px] relative bg-white dark:bg-ios-dark-gray5 shadow-xl dark:shadow-2xl dark:shadow-black border border-ios-light-gray5 dark:border-white/5 rounded-[38px] p-5 flex flex-col justify-between transition-colors aspect-square overflow-hidden"
                    >
                        {/* ── Pill Tab 切換（滑動背景） ── */}
                        <div
                            className="relative flex rounded-full select-none cursor-pointer bg-ios-light-gray5 dark:bg-ios-dark-gray6 transition-colors shrink-0"
                            style={{ padding: '5px' }}
                        >
                            {/* 滑動背景 Pill */}
                            <div
                                className="bg-white dark:bg-ios-dark-gray4 shadow-sm border border-transparent dark:border-white/5"
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    left: activeTab === 'login' ? '5px' : 'calc(50% + 0px)',
                                    width: 'calc(50% - 5px)',
                                    height: 'calc(100% - 10px)',
                                    borderRadius: '999px',
                                    transition: 'left 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
                                    zIndex: 1,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                }}
                            />
                            {/* 登入 */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('login')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'login' ? 'text-black dark:text-white' : 'text-ios-light-gray1 dark:text-ios-dark-gray1 hover:text-black dark:hover:text-ios-light-gray6'
                                }`}
                            >
                                {t('auth.login')}
                            </button>
                            {/* 註冊 */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('register')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'register' ? 'text-black dark:text-white' : 'text-ios-light-gray1 dark:text-ios-dark-gray1 hover:text-black dark:hover:text-ios-light-gray6'
                                }`}
                            >
                                {t('auth.register')}
                            </button>
                        </div>

                        {/* 輸入欄位群組 - 完美垂直平均分配與平滑佈局動畫 */}
                        <motion.div layout className="w-full flex flex-col flex-1 justify-evenly relative">
                            <motion.div layout className="w-full shrink-0 z-10">
                                <FloatingInput
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    label={t('auth.account')}
                                />
                            </motion.div>
                            
                            <motion.div layout className="w-full shrink-0 z-10">
                                <FloatingInput
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    label={t('auth.password')}
                                />
                            </motion.div>

                            {/* 確認密碼欄位：使用 popLayout 模式，讓元素退場時立刻脫離佈局，觸發完美的 justify-evenly 空間重算動畫 */}
                            <AnimatePresence mode="popLayout" initial={false}>
                                {activeTab === 'register' && (
                                    <motion.div
                                        key="confirm"
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                                        className="w-full shrink-0 z-0"
                                    >
                                        <FloatingInput
                                            id="confirm-password"
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required={activeTab === 'register'}
                                            label={t('auth.confirmPassword')}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* 底層按鈕與錯誤提示區塊 */}
                        <div className="w-full flex flex-col gap-3 shrink-0">
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, height: 0, marginTop: 0 }}
                                            animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 4 }}
                                            exit={{ opacity: 0, scale: 0.95, height: 0, marginTop: 0 }}
                                            className="w-full text-center overflow-hidden"
                                        >
                                            <div className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full text-sm font-medium border border-red-200 dark:border-red-500/30 shadow-sm transition-colors">
                                                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <span>{error}</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* 提交按鈕 - Native iOS Solid Style */}
                                <motion.button
                                    layout
                                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-2.5 mt-1 bg-ios-blue-light dark:bg-ios-blue-dark hover:bg-opacity-90 dark:hover:bg-opacity-90
                                           text-white font-medium rounded-full text-[15px]
                                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-ios-dark-gray5 focus:ring-ios-blue-light dark:focus:ring-ios-blue-dark
                                           disabled:opacity-50 disabled:cursor-not-allowed
                                           transition-all shrink-0 border border-transparent shadow-sm"
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
                            </motion.button>
                        </div>
                    </motion.form>
                </div>
            </div>

        </div>
    )
}
