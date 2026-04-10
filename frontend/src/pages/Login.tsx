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
                await authApi.register({ email, password })
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

            {/* ── 左側：品牌介紹 (桌面 50%) ── */}
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
            </div>

            {/* ── 右側：登入表單 (桌面 50%，手機 100%) ── */}
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
                        className="w-full max-w-[420px] bg-[#1f1f1f] rounded-[36px] p-8 flex flex-col"
                        style={{ aspectRatio: '1 / 1' }}
                    >
                        {/* ── Pill Tab 切換（滑動黑色背景） ── */}
                        <div
                            className="relative flex mb-8 rounded-full select-none cursor-pointer"
                            style={{ background: '#2a2a2a', padding: '5px' }}
                        >
                            {/* 滑動黑色 Pill 背景 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    left: activeTab === 'login' ? '5px' : 'calc(50% + 0px)',
                                    width: 'calc(50% - 5px)',
                                    height: 'calc(100% - 10px)',
                                    background: '#fff',
                                    borderRadius: '999px',
                                    transition: 'left 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
                                    zIndex: 1,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                                }}
                            />
                            {/* 登入 */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('login')}
                                style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                className={`flex-1 py-3 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                    activeTab === 'login' ? 'text-[#111]' : 'text-gray-500 hover:text-gray-300'
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
                                    activeTab === 'register' ? 'text-[#111]' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {t('auth.register')}
                            </button>
                        </div>


                        {/* ── 表單區域 ── */}
                        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
                            {/* 錯誤訊息 */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            {/* 帳號 — flex 直接子元素，justify-between 自動分配 */}
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder={t('auth.account')}
                                className="w-full px-5 py-4 rounded-full bg-[#2a2a2a] border-none text-white text-sm placeholder-gray-500 outline-none"
                            />

                            {/* 密碼 — flex 直接子元素 */}
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder={t('auth.password')}
                                className="w-full px-5 py-4 rounded-full bg-[#2a2a2a] border-none text-white text-sm placeholder-gray-500 outline-none"
                            />

                            {/* 確認密碼 — height 動畫，0 → 56px
                                 height=0 時 justify-between 將其視為不占位的元素，自動展開 3 個空白
                                 height=56px 時 justify-between 重新平均分配 4 個元素 */}
                            <div
                                style={{
                                    height: activeTab === 'register' ? '56px' : '0px',
                                    opacity: activeTab === 'register' ? 1 : 0,
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    transition: 'height 0.4s cubic-bezier(0.23,1,0.32,1), opacity 0.25s ease',
                                }}
                            >
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required={activeTab === 'register'}
                                    placeholder={t('auth.confirmPassword')}
                                    className="w-full h-full px-5 rounded-full bg-[#2a2a2a] border-none text-white text-sm placeholder-gray-500 outline-none"
                                />
                            </div>

                            {/* 提交按鈕 — flex 直接子元素 */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 bg-transparent border border-[#4a4a4a] hover:border-gray-400
                                       text-white font-medium rounded-full text-sm
                                       focus:outline-none
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
    )
}
