/**
 * 登入頁面
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'

export default function Login() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // 登入
            const tokens = await authApi.login({ email, password })

            // 取得使用者資訊
            useAuthStore.setState({ accessToken: tokens.accessToken })
            const user = await authApi.me()

            // 設定認證狀態
            setAuth(user, tokens.accessToken, tokens.refreshToken)

            // 重導向
            navigate(from, { replace: true })
        } catch (err) {
            console.error('Login error:', err)
            setError(t('auth.loginFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Corphia AI</h1>
                    <p className="text-primary-100">{t('auth.welcomeBack')}</p>
                </div>

                {/* 登入表單 */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 錯誤訊息 */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                            >
                                {t('auth.email')}
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-all"
                                placeholder="you@example.com"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                            >
                                {t('auth.password')}
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent
                         transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        {/* 登入按鈕 */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 
                       text-white font-medium rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-2 h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    {t('common.loading')}
                                </span>
                            ) : (
                                t('auth.login')
                            )}
                        </button>
                    </form>

                    {/* 預設帳號提示 (開發用) */}
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3">
                            測試帳號
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                                <span>engineer@local</span>
                                <span className="text-slate-400">Engineer123!</span>
                            </div>
                            <div className="flex justify-between bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                                <span>admin@local</span>
                                <span className="text-slate-400">Admin123!</span>
                            </div>
                            <div className="flex justify-between bg-slate-50 dark:bg-slate-700/50 p-2 rounded">
                                <span>user@local</span>
                                <span className="text-slate-400">User123!</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
