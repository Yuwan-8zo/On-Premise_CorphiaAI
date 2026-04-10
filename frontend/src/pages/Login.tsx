/**
 * 登入/註冊頁面
 * 
 * 精確復刻用戶設計：1:1 正方形卡片
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { authApi } from '../api/auth'

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    delayClass?: string;
    id?: string;
}

const FloatingInput = ({ label, delayClass, id, value, className, ...props }: FloatingInputProps) => {
    const isFilled = Boolean(value && value.toString().length > 0);
    
    return (
        <div className={`relative w-full shrink-0 animate-fade-in ${delayClass || ''}`}>
            <input
                id={id}
                value={value}
                className={`peer w-full px-6 py-4 rounded-full bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-transparent text-gray-900 dark:text-white text-base outline-none focus:ring-1 focus:ring-[#1877F2]/50 transition-all placeholder:text-transparent ${className || ''}`}
                placeholder={label}
                {...props}
            />
            <label
                htmlFor={id}
                className={`absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none rounded-full px-3 origin-left whitespace-nowrap
                    ${isFilled 
                        ? 'top-0 scale-[0.85] bg-black dark:bg-[#e0e0e0] text-white dark:text-black font-semibold py-0.5' 
                        : 'scale-100 bg-transparent text-gray-400 dark:text-[#777] py-0'}
                    peer-focus:top-0 peer-focus:scale-[0.85] peer-focus:bg-black dark:peer-focus:bg-[#e0e0e0] peer-focus:text-white dark:peer-focus:text-black peer-focus:font-semibold peer-focus:py-0.5
                `}
            >
                {label}
            </label>
        </div>
    );
};

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()
    const { theme, toggleTheme } = useUIStore()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
    
    // 登入狀態
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPassword, setLoginPassword] = useState('')
    
    // 註冊狀態
    const [registerEmail, setRegisterEmail] = useState('')
    const [registerPassword, setRegisterPassword] = useState('')
    const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')

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

    // 語言切換
    const toggleLanguage = () => {
        const langs = ['zh-TW', 'en', 'ja']
        const currentIndex = langs.indexOf(i18n.language)
        const nextIndex = (currentIndex + 1) % langs.length
        i18n.changeLanguage(langs[nextIndex])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (activeTab === 'register') {
                if (registerPassword !== registerConfirmPassword) {
                    setError(t('auth.passwordMismatch'))
                    setLoading(false)
                    return
                }
                await authApi.register({ email: registerEmail, password: registerPassword })
                const tokens = await authApi.login({ email: registerEmail, password: registerPassword })
                useAuthStore.setState({ accessToken: tokens.accessToken })
                const user = await authApi.me()
                setAuth(user, tokens.accessToken, tokens.refreshToken)
                navigate(from, { replace: true })
            } else {
                const tokens = await authApi.login({ email: loginEmail, password: loginPassword })
                useAuthStore.setState({ accessToken: tokens.accessToken })
                const user = await authApi.me()
                setAuth(user, tokens.accessToken, tokens.refreshToken)
                navigate(from, { replace: true })
            }
        } catch (err) {
            console.error('Auth error:', err)
            setError(activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-gray-50 dark:bg-[#131314] transition-colors duration-300">

            {/* ── 左側：品牌介紹 (桌面 50%) ── */}
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative">
                {/* 後端狀態指示器 */}
                <div className="flex items-center gap-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-transparent px-3 py-1.5 rounded-full w-fit shadow-sm dark:shadow-none transition-colors">
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
                        <h1 className="text-5xl font-light text-gray-900 dark:text-white mb-4 transition-colors">
                            Corphia AI
                        </h1>
                        <p className="text-gray-600 dark:text-gray-500 mb-10 transition-colors">
                            {t('auth.engineDesc')}
                        </p>

                        {/* 功能列表 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2]"></span>
                                <span className="text-gray-700 dark:text-gray-300 transition-colors">{t('auth.feature1')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2]"></span>
                                <span className="text-gray-700 dark:text-gray-300 transition-colors">{t('auth.feature2')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#1877F2]"></span>
                                <span className="text-gray-700 dark:text-gray-300 transition-colors">{t('auth.feature3')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 右側：登入表單 (桌面 50%，手機 100%) ── */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {/* 右上角區塊 */}
                <div className="flex justify-end p-6 gap-2">
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

                    <button
                        onClick={toggleLanguage}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white transition-colors"
                        title={t('settings.language')}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </button>
                </div>
                {/* 手機版品牌標題 (僅在行動裝置顯示) */}
                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 transition-colors">
                        {t('auth.welcomeTitle')}
                    </h2>
                    <h1 className="text-4xl font-light text-gray-900 dark:text-white mb-2 transition-colors">
                        Corphia AI
                    </h1>
                    <p className="text-gray-500 text-sm whitespace-nowrap">{t('auth.engineDesc')}</p>
                </div>

                {/* 登入卡片容器 - 居中 */}
                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    {/* 卡片本體：桌面版為 1:1 正方形，手機版為自適應高度加固定間距 */}
                    <div
                        className="w-full max-w-[420px] relative bg-white dark:bg-[#1c1c1c] shadow-xl dark:shadow-none border border-gray-100 dark:border-transparent rounded-[32px] lg:rounded-[40px] p-6 lg:p-8 flex flex-col justify-between transition-colors aspect-auto lg:aspect-square min-h-[400px] lg:min-h-0 gap-6 lg:gap-0"
                    >
                        {/* ── Pill Tab 切換（滑動背景） ── */}
                        <div
                            className="relative flex rounded-full select-none cursor-pointer bg-gray-100 dark:bg-[#2a2a2a] transition-colors shrink-0"
                            style={{ padding: '5px' }}
                        >
                            {/* 滑動背景 Pill */}
                            <div
                                className="bg-white dark:bg-[#fff] shadow-sm"
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
                                className={`flex-1 py-3 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'login' ? 'text-gray-900 dark:text-[#111]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {t('auth.login')}
                            </button>
                            {/* 註冊 */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('register')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-3 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'register' ? 'text-gray-900 dark:text-[#111]' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >
                                {t('auth.register')}
                            </button>
                        </div>


                        {/* ── 表單區域 ── */}
                        <form onSubmit={handleSubmit} className="contents">
                            {/* 錯誤訊息 (改為浮動，不影響均分排版) */}
                            {error && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center z-50 shadow-sm animate-fade-in-up">
                                    {error}
                                </div>
                            )}

                            {activeTab === 'login' ? (
                                    <>
                                        {/* 登入表單 - 獨立2個 */}
                                        <FloatingInput
                                            id="login-email"
                                            type="email"
                                            value={loginEmail}
                                            onChange={(e) => setLoginEmail(e.target.value)}
                                            required
                                            label={t('auth.account')}
                                            delayClass=""
                                        />
                                        <FloatingInput
                                            id="login-password"
                                            type="password"
                                            value={loginPassword}
                                            onChange={(e) => setLoginPassword(e.target.value)}
                                            required
                                            label={t('auth.password')}
                                            delayClass="delay-75"
                                        />
                                    </>
                                ) : (
                                    <>
                                        {/* 註冊表單 - 獨立3個 */}
                                        <FloatingInput
                                            id="reg-email"
                                            type="email"
                                            value={registerEmail}
                                            onChange={(e) => setRegisterEmail(e.target.value)}
                                            required
                                            label={t('auth.account')}
                                            delayClass=""
                                        />
                                        <FloatingInput
                                            id="reg-password"
                                            type="password"
                                            value={registerPassword}
                                            onChange={(e) => setRegisterPassword(e.target.value)}
                                            required
                                            label={t('auth.password')}
                                            delayClass="delay-75"
                                        />
                                        <FloatingInput
                                            id="reg-confirm"
                                            type="password"
                                            value={registerConfirmPassword}
                                            onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                            required
                                            label={t('auth.confirmPassword')}
                                            delayClass="delay-150"
                                        />
                                    </>
                                )}

                            {/* 提交按鈕 — flex 直接子元素 */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-white dark:bg-transparent border border-gray-300 dark:border-[#4a4a4a] hover:border-gray-400 dark:hover:border-gray-400
                                       text-gray-900 dark:text-white font-medium rounded-full text-sm shadow-sm dark:shadow-none
                                       focus:outline-none focus:ring-1 focus:ring-[#1877F2]/50
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       transition-all"
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
                        </form>
                    </div>
                </div>
            </div>

        </div>
    )
}
