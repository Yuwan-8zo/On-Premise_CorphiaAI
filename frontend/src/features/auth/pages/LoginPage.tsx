/**
 * 登入/註冊頁面
 *
 * 卡片內排版改為靈活設計：1:1 正方形
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { authApi } from '@/api/auth'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { MessageSquare, FileText, Shield, HelpCircle, X } from 'lucide-react'
import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'
import { BackendBootSplash, BackendStatusPill, FloatingInput, type BackendStatus } from '@/features/auth'
import { springSnappy } from '@/lib/motionPresets'
import Tooltip from '@/components/ui/Tooltip'

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { setAuth, setLoading, isLoading } = useAuthStore()
    const { theme, toggleTheme, language, setLanguage } = useUIStore()

    const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
    const langMenuRef = useRef<HTMLDivElement>(null)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
    const [hasInitialConnected, setHasInitialConnected] = useState(false)

    // 登入失敗一次後：登入按鈕內縮，右側出現 `?` 按鈕（聯絡管理員）
    // 切換 tab / 改 email 會 reset，避免使用者改完帳號後 ? 按鈕還賴著不走
    const [loginFailedOnce, setLoginFailedOnce] = useState(false)
    const [showResetModal, setShowResetModal] = useState(false)

    // 註冊成功後切回 login tab，顯示「請以新帳號登入」綠色提示一次
    const [registerSuccessHint, setRegisterSuccessHint] = useState(false)

    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

    useEffect(() => {
        let isCancelled = false

        // health check —— 同時包 try/catch 把 ERR_ABORTED / 500 都靜默吞掉，
        // 不然 backend 沒開時 console 會被 fetch 失敗紅色錯誤淹沒
        const checkBackend = async () => {
            try {
                const response = await fetch('/api/v1/health', {
                    // signal 讓 unmount 時可中斷未完成的請求，避免 lingering 500 紀錄
                    cache: 'no-store',
                })
                if (response.ok) {
                    if (!isCancelled) {
                        setBackendStatus('online')
                        setHasInitialConnected(true)
                    }
                } else {
                    if (!isCancelled) setBackendStatus('offline')
                }
            } catch {
                // network error / abort —— 一律當 offline，不 log
                if (!isCancelled) setBackendStatus('offline')
            }
        }

        checkBackend()

        // offline 時用 5s（之前 3s 太密集 → console 每 3 秒一條 500 紅字）；
        // 連上後降頻到 30s 維持心跳
        const intervalId = setInterval(() => {
            checkBackend()
        }, hasInitialConnected ? 30000 : 5000)

        return () => {
            isCancelled = true
            clearInterval(intervalId)
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

                // 註冊完不要 auto-login —— 改成導回 login tab，
                // 強迫使用者用新帳號重新打一次密碼確認他真的記得。
                // 這也避免「註冊完直接跳 chat 頁」時使用者搞不清楚到底有沒有成功註冊。
                setActiveTab('login')
                setPassword('')
                setConfirmPassword('')
                setLoginFailedOnce(false)
                setRegisterSuccessHint(true)
                setLoading(false)
                return
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

            // 登入模式下任何認證失敗（401/403）都觸發「忘記密碼?」UI
            // 後端為了防 user enumeration 故意把「帳號不存在」跟「密碼錯」都回 401，
            // 我們無法區分，乾脆統一視為「使用者可能忘了密碼」，給他重設管道
            if (activeTab === 'login' && (status === 401 || status === 403)) {
                setLoginFailedOnce(true)
            }

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

    // Login 鎖品牌色，但 border 要根據 light/dark 模式給不同混色，
    // 不然 dark mix 寫死在 light 背景上會變成超深的線。
    // 公式：bronze 7% + 當前 base bg 93%
    //   light bg (250,250,248) → ~242 240 236（極淡的暖白）
    //   dark  bg (32, 32, 34)  → ~39 37 37（極淡的深棕）
    // store 的 theme 已是 resolved 過的 'light' | 'dark'，'system' 在 themePreference 裡
    const isDark = theme === 'dark'
    const loginBorderSubtle = isDark ? '39 37 37' : '242 240 236'
    const loginBorderStrong = isDark ? '55 49 45' : '225 219 212'

    // ── 後端首次連線前蓋全螢幕 splash —————————————————————————
    // 沒過 200 health check 就讓使用者看 splash，不要被 disabled 表單騙。
    // 一旦 hasInitialConnected 翻 true，splash 整個 unmount，正常走表單流程。
    if (!hasInitialConnected) {
        return <BackendBootSplash status={backendStatus} />
    }

    return (
        // 登入/註冊頁強制鎖品牌色（Titanium Bronze）—— 跟全域 accent 解耦。
        //
        // 注意：CSS custom property 是 early binding —— `--accent: var(--color-ios-accent-light)`
        // 在 :root 被計算時就 resolve 成具體 RGB 值，子樹繼承的是已 resolve 的值，
        // 不會重新計算。所以光蓋 --color-ios-accent-light 沒用，必須把
        // --accent / --accent-hover / --accent-active / --accent-soft 全部蓋成 bronze
        // 的 RGB tuple，這樣 bg-accent / text-accent / Tailwind alpha 修飾子才會用 bronze。
        //
        // border-subtle / border-strong 根據當前 light/dark 動態切，避免硬編譯
        // 在反向背景上看起來太深或太淺。
        <div
            className="min-h-[100dvh] flex bg-bg-base transition-colors duration-300 relative overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none"
            style={{
                ['--color-ios-accent-light' as string]: '137 110 83',
                ['--color-ios-accent-dark' as string]: '137 110 83',
                // 直接覆蓋 --accent 系列（不能依靠 var(--color-ios-accent-light) 重新解析）
                ['--accent' as string]: '137 110 83',
                ['--accent-hover' as string]: '137 110 83',
                ['--accent-active' as string]: '137 110 83',
                ['--accent-soft' as string]: '137 110 83',
                ['--border-subtle' as string]: loginBorderSubtle,
                ['--border-strong' as string]: loginBorderStrong,
                // iOS safe-area —— 避免 Dynamic Island / 底部 Home Indicator 蓋到 Online pill / 內容
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02] transition-colors duration-300" d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03] transition-colors duration-300" d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z" />
                    <path className="fill-corphia-bronze dark:fill-white opacity-[0.02] dark:opacity-[0.01] transition-colors duration-300" d="M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z" />
                </svg>
            </div>

            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative z-10">
                <BackendStatusPill status={backendStatus} />

                <div className="flex-1 flex items-center justify-center w-full">
                    <div className="mx-auto max-w-[460px] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                        <h2 className="text-[44px] xl:text-[52px] font-bold text-text-primary tracking-[-0.025em] leading-tight relative z-10 transition-colors">
                            {t('auth.welcomeTitle')}
                        </h2>
                        <div className="mt-5 -mb-6 relative z-0 flex items-center">
                            <CorphiaWordmark className="h-[96px] w-auto max-w-full object-contain object-left pointer-events-none select-none" />
                        </div>
                        <p className="mt-2 mb-10 text-[13px] tracking-[0.18em] uppercase text-text-secondary/80">
                            Enterprise Knowledge Engine · {t('auth.localDeploy', '地端部署')}
                        </p>

                        <div className="space-y-7">
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated dark:bg-[#202022] border border-transparent dark:border-white/5 flex items-center justify-center relative">
                                    <MessageSquare className="w-6 h-6 text-corphia-bronze" />
                                    <span className="absolute text-[10px] font-bold text-corphia-bronze mt-[-2px]">AI</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[1.1rem] font-medium text-text-primary transition-colors leading-tight mb-1">{t('auth.feature1')}</span>
                                    <span className="text-sm text-text-secondary transition-colors">{t('auth.feature1Desc')}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated dark:bg-[#202022] border border-transparent dark:border-white/5 flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-corphia-bronze" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[1.1rem] font-medium text-text-primary transition-colors leading-tight mb-1">{t('auth.feature2')}</span>
                                    <span className="text-sm text-text-secondary transition-colors">{t('auth.feature2Desc')}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full bg-bg-elevated dark:bg-[#202022] border border-transparent dark:border-white/5 flex items-center justify-center relative">
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

            </div>

            <div className="w-full lg:w-1/2 flex flex-col relative z-30">
                <div className="flex justify-between items-center p-6 w-full">
                    <div className="lg:hidden">
                        <BackendStatusPill status={backendStatus} compact />
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <Tooltip label={t('settings.theme')}>
                            <button
                                onClick={toggleTheme}
                                className="relative w-10 h-10 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
                                aria-label={t('settings.theme')}
                            >
                            {/*
                              主題切換動畫：兩個圖示同時掛在 DOM，用 absolute 疊合，
                              依 theme 切 opacity / rotate / scale 做 cross-fade。
                              motion/AnimatePresence 在這個專案裡是 no-op（gsapMotion 包裝），
                              所以改用 CSS transition + Tailwind 的 conditional class，
                              效果一樣絲滑，且不依賴第三方動畫庫。

                              dark 模式顯示太陽（rotate-0/scale-100/opacity-100），
                              light 模式顯示月亮（同上）。另一個圖示反向：
                              旋轉 -90/+90 度 + 縮小 + 透明，視覺上會看到「旋轉著消失/出現」。
                              duration-500 比 default 慢一點，更有質感；ease 用 apple cubic。
                            */}
                            <span
                                className="absolute inset-0 flex items-center justify-center transition-all duration-500"
                                style={{
                                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                                    opacity: theme === 'dark' ? 1 : 0,
                                    transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
                                }}
                                aria-hidden="true"
                            >
                                {/* Sun (太陽) — 深色模式時顯示，提示「點一下切到淺色」 */}
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.071-7.071l-1.414 1.414M6.343 17.657l-1.414 1.414m12.728 0l-1.414-1.414M6.343 6.343L4.929 4.929M12 17a5 5 0 100-10 5 5 0 000 10z" />
                                </svg>
                            </span>
                            <span
                                className="absolute inset-0 flex items-center justify-center transition-all duration-500"
                                style={{
                                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                                    opacity: theme === 'light' ? 1 : 0,
                                    transform: theme === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
                                }}
                                aria-hidden="true"
                            >
                                {/* Moon (月亮) — 淺色模式時顯示，提示「點一下切到深色」 */}
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                            </span>
                            </button>
                        </Tooltip>

                        <div className="relative" ref={langMenuRef}>
                            <Tooltip label={t('settings.language')}>
                                <button
                                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                                    className={`p-2 transition-colors rounded-full ${isLangMenuOpen ? 'text-text-primary bg-bg-surface' : 'text-text-muted hover:text-text-secondary hover:bg-bg-base'}`}
                                >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                </svg>
                            </button>
                            </Tooltip>

                            <AnimatePresence>
                                {isLangMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="absolute right-0 mt-2 w-28 bg-bg-base border border-border-subtle shadow-xl rounded-cv-lg overflow-hidden z-50 flex flex-col p-1.5"
                                    >
                                        <button
                                            onClick={() => handleLanguageSelect('zh-TW')}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between ${language === 'zh-TW' ? 'text-white font-semibold bg-accent' : 'text-text-secondary hover:bg-bg-base'}`}
                                        >
                                            繁體中文
                                        </button>
                                        <button
                                            onClick={() => handleLanguageSelect('en-US')}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'en-US' ? 'text-white font-semibold bg-accent' : 'text-text-secondary hover:bg-bg-base'}`}
                                        >
                                            English
                                        </button>
                                        <button
                                            onClick={() => handleLanguageSelect('ja-JP')}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors rounded-full flex items-center justify-between mt-1 ${language === 'ja-JP' ? 'text-white font-semibold bg-accent' : 'text-text-secondary hover:bg-bg-base'}`}
                                        >
                                            日本語
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6 px-4">
                    {/*
                      手機板用 CorphiaWordmark（含 LOGO 圖檔 + 字標），不再用「C 圖示 + 文字 Corphia」拼接。
                      CorphiaWordmark 內部已 dark:hidden / hidden dark:block 自動切換淺/深色版 PNG，
                      不需要額外處理 theme。

                      尺寸：h-14 (56px) → sm: h-16 (64px)，比原本的「40px 字 + 36px icon」視覺份量略大但不溢位。
                      max-w-[80%] 防止超寬螢幕（直式 iPad）logo 拉到頁面邊緣。
                    */}
                    <h2 className="text-xl font-bold text-text-primary mb-3 transition-colors">
                        {t('auth.welcomeTitle')}
                    </h2>
                    <CorphiaWordmark className="h-14 sm:h-16 w-auto max-w-[80%] object-contain mb-3 select-none pointer-events-none" />
                    <p className="text-text-secondary text-sm">{t('auth.engineDesc')}</p>
                </div>

                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        className="w-full max-w-[360px] bg-bg-base/60 backdrop-blur-2xl shadow-lg dark:shadow-black/30 border border-border-subtle rounded-[38px] p-5 flex flex-col transition-colors aspect-square relative z-20"
                    >
                            {/*
                              切換動畫策略：
                              - 不再用 motion.div + layout 在每個 spacer 上做 FLIP，
                                因為 layout 動畫會跟 CSS flex 的即時 relayout 互相打架，
                                導致 0.3s 切換期間整列元素抖動。
                              - 改成「純 CSS flex-1 spacer + 兩個明確動畫」：
                                1) confirm-pw 上方的 spacer 用 flexGrow 0↔1
                                2) confirm-pw wrapper 用 height 0↔auto + opacity
                                兩個都用同一條 easing / duration，flex-1 spacer 跟著 CSS
                                重新分配空間，視覺上完全同步。
                              - 所有可見間距統一 flex-1：
                                Login   → A = B = C   (3 個等寬空隙)
                                Register → D = E = F = G (4 個等寬空隙)
                            */}
                            <div
                                className="relative flex rounded-full select-none cursor-pointer bg-bg-base border border-border-subtle transition-colors shrink-0"
                                style={{ padding: '5px' }}
                            >
                                <motion.div
                                    className="absolute top-[5px] bottom-[5px] w-[calc(50%-5px)] bg-bg-elevated shadow-sm rounded-full border border-border-subtle"
                                    initial={false}
                                    animate={{ x: activeTab === 'login' ? 0 : '100%' }}
                                    transition={springSnappy}
                                    style={{ left: '5px', zIndex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('login')
                                        setFieldErrors({})
                                    }}
                                    style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                    className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                        activeTab === 'login' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    {t('auth.login')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('register')
                                        setFieldErrors({})
                                        // 切換到註冊：把「忘記密碼?」按鈕收掉，登入失敗的訊息也清掉。
                                        // email/password 沿用（這就是「轉移文字到註冊頁」的意思）。
                                        setLoginFailedOnce(false)
                                        setRegisterSuccessHint(false)
                                    }}
                                    style={{ position: 'relative', zIndex: 2, WebkitTapHighlightColor: 'transparent' }}
                                    className={`flex-1 py-2 text-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                        activeTab === 'register' ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    {t('auth.register')}
                                </button>
                            </div>

                            {/* Gap A / D */}
                            <div className="flex-1" />

                            <div className="shrink-0 w-full">
                                <FloatingInput
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        setFieldErrors(prev => ({ ...prev, email: '' }))
                                        // 改帳號 → 收掉「忘記密碼?」按鈕（可能是換帳號了，不是忘密碼）
                                        setLoginFailedOnce(false)
                                        // 改任何欄位都把「註冊成功」綠色提示收掉
                                        setRegisterSuccessHint(false)
                                    }}
                                    required
                                    label={t('auth.account')}
                                    error={fieldErrors.email}
                                />
                            </div>

                            {/* Gap B / E */}
                            <div className="flex-1" />

                            <div className="shrink-0 w-full">
                                <FloatingInput
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value)
                                        setFieldErrors(prev => ({ ...prev, password: '' }))
                                        setRegisterSuccessHint(false)
                                    }}
                                    required
                                    label={t('auth.password')}
                                    error={fieldErrors.password}
                                />
                            </div>

                            {/*
                              Gap F：register 時補上等寬間距，login 時為 0。
                              用 flexGrow 0↔1 動畫，跟下面 confirm-pw 的 height 動畫同 easing/duration → 同步生效。
                            */}
                            <motion.div
                                initial={false}
                                animate={{ flexGrow: activeTab === 'register' ? 1 : 0 }}
                                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                                style={{ flexShrink: 0, flexBasis: 0, minHeight: 0 }}
                            />

                            {/*
                              Confirm-password wrapper：
                                - overflow-hidden 讓 height 0↔auto 的 collapse 動畫乾淨。
                                - pt-3 (12px) 留空間給 FloatingInput 的浮動 label
                                  （label 用 top:0 + translateY(-50%)，半個 label 會跑到 input 上緣外，
                                  沒有 pt-3 的話會被 overflow-hidden 切掉）。
                                - marginTop: -12 抵銷 pt-3：等於 wrapper 整個往上拉 12px，
                                  讓「password-bottom → input-top」的視覺距離 =（F spacer 的 flex-share）
                                  跟 D / E / G 完全等距。沒這層補償的話，F 會比其他 gap 多 12px。
                            */}
                            <motion.div
                                initial={false}
                                animate={{
                                    height: activeTab === 'register' ? 'auto' : 0,
                                    opacity: activeTab === 'register' ? 1 : 0,
                                    marginTop: activeTab === 'register' ? -12 : 0,
                                }}
                                transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                                className="w-full shrink-0 overflow-hidden"
                                style={{ pointerEvents: activeTab === 'register' ? 'auto' : 'none' }}
                                aria-hidden={activeTab !== 'register'}
                            >
                                <div className="pt-3">
                                    <FloatingInput
                                        id="confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: '' })) }}
                                        required={activeTab === 'register'}
                                        label={t('auth.confirmPassword')}
                                        tabIndex={activeTab === 'register' ? 0 : -1}
                                        error={fieldErrors.confirmPassword}
                                    />
                                </div>
                            </motion.div>

                            {/* Gap C / G — 統一 flex-1（原本是 1.15 會偏大） */}
                            <div className="flex-1" />

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

                                    {/* 註冊成功 → 切回 login tab 後顯示一次 */}
                                    <AnimatePresence>
                                        {registerSuccessHint && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, height: 0 }}
                                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                                                className="w-full text-center overflow-hidden"
                                            >
                                                <div className="inline-flex items-center gap-2 justify-center px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200 shadow-sm dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50">
                                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span>{t('auth.registerSuccessReLogin', '註冊成功，請以新帳號登入')}</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/*
                                      登入 / 註冊送出按鈕區。
                                      - 平常：送出按鈕單獨佔滿整列。
                                      - 登入失敗後：送出按鈕內縮成 flex-1，右邊出現 ? 按鈕（h-[42px] 跟主按鈕等高）
                                        ? 按鈕點下去 → 彈「請聯絡管理員」modal。
                                      - 切到註冊 / 改 email 後 loginFailedOnce 會被 reset，UI 退回單按鈕狀態。
                                      transition-all 處理 width 變化的 smooth animation。
                                    */}
                                    <div className="w-full flex gap-2 items-stretch">
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="flex-1 min-w-0 py-2.5 bg-corphia-bronze hover:bg-opacity-90 text-white font-semibold rounded-full text-[15px]
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

                                        <AnimatePresence>
                                            {activeTab === 'login' && loginFailedOnce && (
                                                <Tooltip label={t('auth.forgotPassword')}>
                                                    <motion.button
                                                        type="button"
                                                        onClick={() => setShowResetModal(true)}
                                                        initial={{ opacity: 0, scale: 0.5, width: 0 }}
                                                        animate={{ opacity: 1, scale: 1, width: 42 }}
                                                        exit={{ opacity: 0, scale: 0.5, width: 0 }}
                                                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                                        aria-label={t('auth.forgotPassword')}
                                                        className="shrink-0 h-[42px] rounded-full border border-corphia-bronze/30 bg-bg-base/60 text-corphia-bronze hover:bg-corphia-bronze/10 flex items-center justify-center shadow-sm overflow-hidden"
                                                    >
                                                        <HelpCircle className="w-5 h-5 shrink-0" />
                                                    </motion.button>
                                                </Tooltip>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                    </form>
                </div>
            </div>

            {/*
              「忘記密碼?」彈出 modal —— 因為這是地端系統沒有寄信功能，
              所以重設只能走管理員手動處理流程。modal 用簡單的 backdrop blur + 中央卡片，
              不依賴任何 Modal 元件框架，避免拉進額外依賴。
              z-50 蓋過所有東西；點 backdrop 跟 X 按鈕都能關閉。
            */}
            <AnimatePresence>
                {showResetModal && (
                    <>
                        <motion.div
                            key="reset-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowResetModal(false)}
                        />
                        <motion.div
                            key="reset-card"
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="reset-modal-title"
                                className="pointer-events-auto w-full max-w-sm bg-bg-base rounded-3xl shadow-2xl border border-border-subtle p-6 relative"
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                                    aria-label={t('common.close', '關閉')}
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="flex flex-col items-center text-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-corphia-bronze/10 text-corphia-bronze flex items-center justify-center">
                                        <HelpCircle className="w-6 h-6" />
                                    </div>
                                    <h3
                                        id="reset-modal-title"
                                        className="text-lg font-semibold text-text-primary"
                                    >
                                        {t('auth.contactAdminTitle', '無法登入？')}
                                    </h3>
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                        {t(
                                            'auth.contactAdminBody',
                                            '請聯絡您的企業 IT 管理員協助重設密碼。基於資料主權與離線部署考量，本系統不提供自助式信件重設。',
                                        )}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    className="mt-5 w-full py-2.5 bg-corphia-bronze hover:bg-opacity-90 text-white font-semibold rounded-full text-[15px] transition-all shadow-sm"
                                >
                                    {t('common.confirm', '我知道了')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
