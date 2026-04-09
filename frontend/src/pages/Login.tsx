/**
 * 登入/註冊頁面
 * 
 * 精確復刻用戶設計：1:1 正方形卡片
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
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
                if (password !== confirmPassword) {
                    setError(t('auth.passwordMismatch'))
                    setLoading(false)
                    return
                }
                await authApi.register({ email, password, name })
            }

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
        <div className="min-h-screen flex bg-[#0a0a0a]">
            {/* 左側品牌區 */}
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative">
                {/* 後端狀態指示器 */}
                <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded-md w-fit">
                    <span className={`w-2.5 h-2.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500' :
                        backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}></span>
                    <span className="text-sm text-gray-400">Backend:</span>
                    <span className={`text-sm ${backendStatus === 'online' ? 'text-green-400' :
                        backendStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        {backendStatus === 'online' ? 'Online' :
                            backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                </div>

                {/* 品牌內容 - 垂直定位於 2/3 處 */}
                <div className="flex-1 flex flex-col max-w-md">
                    <div className="flex-[2]"></div>
                    <div>
                        <h2 className="text-4xl font-bold text-white mb-1 italic">
                            {t('auth.welcomeTitle')}
                        </h2>
                        <h1 className="text-5xl font-light text-white mb-4">
                            Corphia AI
                        </h1>
                        <p className="text-gray-500 mb-10">
                            {t('auth.engineDesc')}
                        </p>

                        {/* 功能列表 */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span className="text-gray-300">{t('auth.feature1')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span className="text-gray-300">{t('auth.feature2')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <span className="text-gray-300">{t('auth.feature3')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-[1]"></div>
                </div>

                {/* 右側登入區 */}
                <div className="w-full lg:w-1/2 flex flex-col">
                    {/* 右上角語言切換 */}
                    <div className="flex justify-end p-6">
                        <button
                            onClick={toggleLanguage}
                            className="p-2 text-gray-500 hover:text-white transition-colors"
                            title={t('settings.language')}
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                        </button>
                    </div>

                    {/* 登入卡片容器 - 居中 */}
                    <div className="flex-1 flex items-center justify-center px-8 pb-12">
                        {/* 1:1 正方形卡片 */}
                        <div
                            className="w-full max-w-[420px] bg-[#1f1f1f] rounded-2xl p-8 flex flex-col"
                            style={{ aspectRatio: '1 / 1' }}
                        >
                            {/* 標籤切換 */}
                            <div className="flex mb-8">
                                <button
                                    onClick={() => setActiveTab('login')}
                                    className={`flex-1 py-3 text-center rounded-full text-sm font-medium transition-all ${activeTab === 'login'
                                        ? 'bg-[#2a2a2a] text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    {t('auth.login')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('register')}
                                    className={`flex-1 py-3 text-center rounded-full text-sm font-medium transition-all ${activeTab === 'register'
                                        ? 'bg-[#2a2a2a] text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    {t('auth.register')}
                                </button>
                            </div>

                            {/* 表單區域 */}
                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                                {/* 錯誤訊息 */}
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-4">
                                        {error}
                                    </div>
                                )}

                                {/* 輸入欄位區 */}
                                <div className="flex-1 flex flex-col justify-center space-y-4">
                                    {/* 名稱 (註冊時) */}
                                    {activeTab === 'register' && (
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] 
                                                   text-white placeholder-gray-500
                                                   focus:ring-1 focus:ring-gray-500 focus:border-gray-500
                                                   transition-all outline-none"
                                            placeholder={t('auth.name')}
                                        />
                                    )}

                                    {/* 帳號 */}
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] 
                                               text-white placeholder-gray-500
                                               focus:ring-1 focus:ring-gray-500 focus:border-gray-500
                                               transition-all outline-none"
                                        placeholder={t('auth.account')}
                                    />

                                    {/* 密碼 */}
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] 
                                               text-white placeholder-gray-500
                                               focus:ring-1 focus:ring-gray-500 focus:border-gray-500
                                               transition-all outline-none"
                                        placeholder={t('auth.password')}
                                    />

                                    {/* 確認密碼 (註冊時) */}
                                    {activeTab === 'register' && (
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            className="w-full px-4 py-3.5 rounded-xl bg-[#2a2a2a] border border-[#3a3a3a] 
                                                   text-white placeholder-gray-500
                                                   focus:ring-1 focus:ring-gray-500 focus:border-gray-500
                                                   transition-all outline-none"
                                            placeholder={t('auth.confirmPassword')}
                                        />
                                    )}
                                </div>

                                {/* 登入按鈕 */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 mt-6 bg-transparent border border-[#4a4a4a] hover:border-gray-400
                                           text-white font-medium rounded-full
                                           focus:outline-none focus:ring-1 focus:ring-gray-500
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

                    {/* 手機版品牌顯示 */}
                    <div className="lg:hidden px-8 pb-8 text-center">
                        <h1 className="text-2xl font-light text-white">Corphia AI</h1>
                        <p className="text-sm text-gray-500 mt-1">{t('auth.engineDesc')}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
