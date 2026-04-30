/**
 * 註冊頁面
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'

export default function Register() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        setError('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // 驗證
        if (!formData.name.trim()) {
            setError('請輸入名稱')
            return
        }
        if (!formData.email.trim()) {
            setError('請輸入電子郵件')
            return
        }
        if (!formData.password) {
            setError('請輸入密碼')
            return
        }
        if (formData.password.length < 8) {
            setError('密碼至少需要 8 個字元')
            return
        }
        if (formData.password !== formData.confirmPassword) {
            setError('兩次輸入的密碼不一致')
            return
        }

        setIsLoading(true)

        try {
            // 註冊（回傳 user 資料）
            const user = await authApi.register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            })

            // 自動登入（取得 token）
            const tokens = await authApi.login({
                email: formData.email,
                password: formData.password,
            })

            setAuth(user, tokens.accessToken, tokens.refreshToken)

            navigate('/')
        } catch (err: unknown) {
            console.error('註冊失敗:', err)
            const axiosErr = err as { response?: { data?: { detail?: string } } }
            if (axiosErr.response?.data?.detail) {
                setError(axiosErr.response.data.detail)
            } else {
                setError('註冊失敗，請稍後再試')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center p-4">
            {/* 背景裝飾 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-600/20 rounded-full blur-3xl" />
            </div>

            {/* 註冊卡片 */}
            <div className="relative w-full max-w-md">
                <div className="bg-bg-base/10 backdrop-blur-xl rounded-cv-lg shadow-2xl border border-border-subtle p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[16px] bg-gradient-to-br from-primary-500 to-primary-700 mb-4">
                            <span className="text-3xl">🤖</span>
                        </div>
                        <h1 className="text-2xl font-bold text-text-primary">Corphia AI</h1>
                        <p className="text-text-muted mt-2">{t('auth.createAccount')}</p>
                    </div>

                    {/* 錯誤訊息 */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* 表單 */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 名稱 */}
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                {t('auth.name')}
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-bg-base/10 border border-border-subtle rounded-full
 text-text-primary placeholder-slate-400 
 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
 transition-colors"
                                placeholder="請輸入您的名稱"
                            />
                        </div>

                        {/* 電子郵件 */}
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                {t('auth.email')}
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-bg-base/10 border border-border-subtle rounded-full
 text-text-primary placeholder-slate-400 
 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
 transition-colors"
                                placeholder="email@example.com"
                            />
                        </div>

                        {/* 密碼 */}
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                {t('auth.password')}
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-bg-base/10 border border-border-subtle rounded-full
 text-text-primary placeholder-slate-400 
 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
 transition-colors"
                                placeholder="至少 8 個字元"
                            />
                        </div>

                        {/* 確認密碼 */}
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">
                                {t('auth.confirmPassword')}
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-bg-base/10 border border-border-subtle rounded-full
 text-text-primary placeholder-slate-400 
 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
 transition-colors"
                                placeholder="再次輸入密碼"
                            />
                        </div>

                        {/* 註冊按鈕 */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 
 hover:from-primary-500 hover:to-primary-400
 text-text-primary font-semibold rounded-full
 transition-all duration-300 transform hover:scale-[1.02]
 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isLoading ? t('common.loading') : t('auth.register')}
                        </button>
                    </form>

                    {/* 登入連結 */}
                    <p className="mt-6 text-center text-text-muted">
                        {t('auth.hasAccount')}{' '}
                        <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
                            {t('auth.login')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
