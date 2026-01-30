/**
 * 登入/註冊頁面
 * 
 * 設計風格：深色主題、分割式布局
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { authApi } from '../api/auth'

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()
    const { theme, toggleTheme } = useUIStore()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
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
                // 註冊
                if (password !== confirmPassword) {
                    setError(t('auth.passwordMismatch'))
                    setLoading(false)
                    return
                }
                await authApi.register({ email, password, name })
                // 註冊成功後自動登入
            }

            // 登入
            const tokens = await authApi.login({ email, password })
            useAuthStore.setState({ accessToken: tokens.accessToken })
            const user = await authApi.me()
            setAuth(user, tokens.accessToken, tokens.refreshToken)
            navigate(from, { replace: true })
        } catch (err) {
            console.error('Auth error:', err)
            setError(activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-slate-900">
            {/* 左側品牌區 */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative">
                {/* 後端狀態指示器 */}
                <div className="absolute top-6 left-6 flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg">
                    <span className="text-slate-400 text-sm">Backend:</span>
                    <span className={`flex items-center gap-1 text-sm ${backendStatus === 'online' ? 'text-green-400' :
                            backendStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-400' :
                                backendStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                            }`}></span>
                        {backendStatus === 'online' ? 'Online' :
                            backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                </div>

                {/* 品牌內容 */}
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {t('auth.welcomeTitle')}
                    </h2>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent mb-4">
                        Corphia AI
                    </h1>
                    <p className="text-xl text-slate-400 mb-8">
                        {t('auth.subtitle')}
                    </p>

                    {/* 功能列表 */}
                    <div className="space-y-3 text-left inline-block">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-slate-300">{t('auth.feature1')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            <span className="text-slate-300">{t('auth.feature2')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            <span className="text-slate-300">{t('auth.feature3')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右側登入區 */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {/* 右上角控制按鈕 */}
                <div className="flex justify-end gap-2 p-6">
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title={t('settings.theme')}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={toggleLanguage}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title={t('settings.language')}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                    </button>
                </div>

                {/* 登入卡片 */}
                <div className="flex-1 flex items-center justify-center px-6 pb-12">
                    <div className="w-full max-w-md bg-slate-800/50 rounded-2xl p-8 border border-slate-700">
                        {/* 標籤切換 */}
                        <div className="flex mb-8 bg-slate-700/50 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab('login')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'login'
                                        ? 'bg-slate-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {t('auth.login')}
                            </button>
                            <button
                                onClick={() => setActiveTab('register')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'register'
                                        ? 'bg-slate-600 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {t('auth.register')}
                            </button>
                        </div>

                        {/* 表單 */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* 錯誤訊息 */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            {/* 名稱 (註冊時) */}
                            {activeTab === 'register' && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">
                                        {t('auth.name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 
                                                   text-white placeholder-slate-500
                                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                                   transition-all"
                                        placeholder={t('auth.namePlaceholder')}
                                    />
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    {t('auth.email')}
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 
                                               text-white placeholder-slate-500
                                               focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                               transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">
                                    {t('auth.password')}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 
                                                   text-white placeholder-slate-500
                                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                                   transition-all pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* 確認密碼 (註冊時) */}
                            {activeTab === 'register' && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">
                                        {t('auth.confirmPassword')}
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-slate-600 
                                                   text-white placeholder-slate-500
                                                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                                   transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}

                            {/* 提交按鈕 */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 
                                           text-white font-medium rounded-xl
                                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800
                                           disabled:opacity-50 disabled:cursor-not-allowed
                                           transition-all mt-6"
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

                        {/* 手機版品牌顯示 */}
                        <div className="lg:hidden mt-8 pt-6 border-t border-slate-700 text-center">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                                Corphia AI
                            </h1>
                            <p className="text-sm text-slate-400 mt-1">{t('auth.subtitle')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
