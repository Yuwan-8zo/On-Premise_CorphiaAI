/**
 * 登入／註冊表單的狀態與送出
 *   - 註冊成功不自動登入：切回登入分頁、請使用者用新帳號再登入一次
 *   - 信箱還沒註冊：直接切到註冊分頁，信箱保留
 *   - 登入失敗（401／403）：出現「?」按鈕（聯絡管理員重設密碼）
 *   - 後端錯誤依欄位標在對應的輸入框
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useToastStore } from '@/store/toastStore'

export type AuthTab = 'login' | 'register'
type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>

interface AuthErrorResponse {
    status?: number
    data?: {
        detail?: unknown
        error?: { message?: string; code?: string; details?: Array<{ field: string; message: string }> }
    }
}

export function useAuthForm() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading } = useAuthStore()
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

    const [tab, setTabState] = useState<AuthTab>('login')
    const [email, setEmailState] = useState('')
    const [password, setPasswordState] = useState('')
    const [confirmPassword, setConfirmState] = useState('')
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    // 登入失敗一次後出現「?」；換分頁或改信箱就收掉（可能是換帳號了，不是忘密碼）
    const [loginFailedOnce, setLoginFailedOnce] = useState(false)

    const clearError = (key: keyof FieldErrors) => setFieldErrors((prev) => ({ ...prev, [key]: '' }))
    const setTab = (next: AuthTab) => {
        setTabState(next)
        setFieldErrors({})
    }
    const setEmail = (v: string) => {
        setEmailState(v)
        clearError('email')
        setLoginFailedOnce(false)
    }
    const setPassword = (v: string) => {
        setPasswordState(v)
        clearError('password')
    }
    const setConfirmPassword = (v: string) => {
        setConfirmState(v)
        clearError('confirmPassword')
    }

    const failedText = () => (tab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed'))

    /** 把後端錯誤轉成欄位提示 */
    const handleError = (err: unknown) => {
        const { status, data } = (err as { response?: AuthErrorResponse })?.response ?? {}
        const detail = data?.detail
        const detailText = typeof detail === 'string' ? detail : undefined
        const code = (detail && typeof detail === 'object' ? (detail as { code?: string }).code : undefined) || data?.error?.code

        // 信箱尚未註冊 → 切到註冊分頁（提示放欄位右側，要短）
        if (tab === 'login' && status === 404 && code === 'ACCOUNT_NOT_FOUND') {
            setTabState('register')
            setConfirmState('')
            setLoginFailedOnce(false)
            setFieldErrors({ email: '尚未註冊' })
            return
        }
        // 後端為了不洩漏帳號是否存在，帳號不存在與密碼錯都回 401：一律給「聯絡管理員重設」的入口
        if (tab === 'login' && (status === 401 || status === 403)) setLoginFailedOnce(true)

        if (status === 429) {
            setFieldErrors({ password: detailText || data?.error?.message || '請求過於頻繁，或者發生了錯誤' })
        } else if (status === 422) {
            // 後端驗證訊息是英文：依欄位改成中文提示
            const details = data?.error?.details ?? []
            const errs: FieldErrors = {}
            if (details.some((d) => d.field?.includes('email'))) errs.email = t('auth.invalidEmail', '信箱格式不正確')
            if (details.some((d) => d.field?.includes('password'))) errs.password = t('auth.invalidPassword', '密碼格式不符合規定')
            setFieldErrors(Object.keys(errs).length ? errs : { password: failedText() })
        } else {
            setFieldErrors({ password: detailText || data?.error?.message || failedText() })
        }
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFieldErrors({})

        const errs: FieldErrors = {}
        if (!email.trim()) errs.email = t('auth.account') + '不能為空'
        if (!password) errs.password = t('auth.password') + '不能為空'
        if (tab === 'register' && !confirmPassword) errs.confirmPassword = t('auth.confirmPassword') + '不能為空'
        if (Object.keys(errs).length) return setFieldErrors(errs)
        if (tab === 'register' && password !== confirmPassword) return setFieldErrors({ confirmPassword: t('auth.passwordMismatch') })

        setLoading(true)
        try {
            if (tab === 'register') {
                await authApi.register({ email, password })
                setTabState('login')
                setPasswordState('')
                setConfirmState('')
                setLoginFailedOnce(false)
                useToastStore.getState().success(t('auth.registerSuccessReLogin', '註冊成功，請以新帳號登入'))
                return
            }
            const tokens = await authApi.login({ email, password })
            useAuthStore.setState({ accessToken: tokens.accessToken })
            const user = await authApi.me()
            setAuth(user, tokens.accessToken, tokens.refreshToken)
            navigate(from, { replace: true })
        } catch (err) {
            console.error('Auth error:', err)
            handleError(err)
        } finally {
            setLoading(false)
        }
    }

    return {
        tab, setTab,
        email, setEmail,
        password, setPassword,
        confirmPassword, setConfirmPassword,
        fieldErrors, loginFailedOnce, submit,
    }
}
