/**
 * 登入/註冊頁面
 *
 * 卡片內排版改為靈活設計：1:1 正方形
 */

import LensMenu from '@/components/ui/LensMenu'
import GlassSegmented from '@/components/ui/GlassSegmented'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useToastStore } from '@/store/toastStore'
import { authApi } from '@/api/auth'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { AlertTriangle, FileText, Globe, HelpCircle, MessageSquare, Moon, Shield, Sun, X } from '@/components/snow/icons'
import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'
import { BackendBootSplash, BackendStatusPill, FloatingInput, type BackendStatus } from '@/features/auth'
import Tooltip from '@/components/ui/Tooltip'
import WaveBackground from '@/components/ui/WaveBackground'

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
    // `hasCompletedInitialCheck`: 只控制首次載入的 splash 顯示/隱藏
    // `hasEverConnected`: 只用來決定 health polling 頻率（連上後降頻）
    const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState(false)
    const [hasEverConnected, setHasEverConnected] = useState(false)

    // 登入失敗一次後：登入按鈕內縮，右側出現 `?` 按鈕（聯絡管理員）
    // 切換 tab / 改 email 會 reset，避免使用者改完帳號後 ? 按鈕還賴著不走
    const [loginFailedOnce, setLoginFailedOnce] = useState(false)
    const [showResetModal, setShowResetModal] = useState(false)

    // 註冊成功改用全域 toast（不再用 inline hint）

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
                        setHasEverConnected(true)
                        setHasCompletedInitialCheck(true)
                    }
                } else {
                    if (!isCancelled) {
                        setBackendStatus('offline')
                        setHasCompletedInitialCheck(true)
                    }
                }
            } catch {
                // network error / abort —— 一律當 offline，不 log
                if (!isCancelled) {
                    setBackendStatus('offline')
                    setHasCompletedInitialCheck(true)
                }
            }
        }

        checkBackend()

        // offline 時用 5s（之前 3s 太密集 → console 每 3 秒一條 500 紅字）；
        // 連上後降頻到 30s 維持心跳
        const intervalId = setInterval(() => {
            checkBackend()
        }, hasEverConnected ? 30000 : 5000)

        return () => {
            isCancelled = true
            clearInterval(intervalId)
        }
    }, [hasEverConnected])

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
                useToastStore.getState().success(t('auth.registerSuccessReLogin', '註冊成功，請以新帳號登入'))
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

            // 信箱尚未註冊 → 直接切到註冊分頁，信箱保留，提示建立帳號
            const rawDetail = (data as { detail?: unknown } | undefined)?.detail
            const detailObj = rawDetail && typeof rawDetail === 'object' ? (rawDetail as { code?: string; message?: string }) : undefined
            const errCode = detailObj?.code || data?.error?.code
            if (activeTab === 'login' && status === 404 && errCode === 'ACCOUNT_NOT_FOUND') {
                setActiveTab('register')
                setConfirmPassword('')
                setLoginFailedOnce(false)
                // 提示顯示在欄位右側，字太長會把信箱擠掉；已切到註冊分頁，短短一句就夠
                setFieldErrors({ email: '尚未註冊' })
                return
            }

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
                    // 後端驗證訊息是英文：依欄位改成中文提示，標在對應的輸入框
                    const errs: { email?: string; password?: string } = {}
                    if (details.some(d => d.field?.includes('email'))) errs.email = t('auth.invalidEmail', '信箱格式不正確')
                    if (details.some(d => d.field?.includes('password'))) errs.password = t('auth.invalidPassword', '密碼格式不符合規定')
                    setFieldErrors(Object.keys(errs).length ? errs : { password: activeTab === 'login' ? t('auth.loginFailed') : t('auth.registerFailed') })
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
    const loginBorderSubtle = isDark ? '56 56 58' : '198 198 200'
    const loginBorderStrong = isDark ? '72 72 74' : '174 174 178'

    // ── 後端首次檢查前蓋全螢幕 splash —————————————————————————
    // 只在「第一次 health check 還沒完成」時顯示，避免 backend offline 時永遠卡 splash。
    if (!hasCompletedInitialCheck) {
        return <BackendBootSplash status={backendStatus} />
    }

    return (
        // 登入/註冊頁跟隨系統強調色（預設藍色）；以前鎖古銅色，改預設藍後會出現一半藍一半古銅。
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
            // 用多重 vh 單位做 fallback，避免在某些 WebView/內嵌瀏覽器 dvh 計算異常造成版面上下偏移
            className="min-h-screen min-h-[100svh] min-h-[100dvh] flex bg-bg-base transition-colors duration-300 relative overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none"
            style={{
                ['--border-subtle' as string]: loginBorderSubtle,
                ['--border-strong' as string]: loginBorderStrong,
                // iOS safe-area —— 避免 Dynamic Island / 底部 Home Indicator 蓋到 Online pill / 內容
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <WaveBackground />
            </div>

            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative z-10">
                <BackendStatusPill status={backendStatus} />

                {/* 左側整塊往右推約 4% 視窗寬，視覺重心不要太靠左 */}
                <div className="flex-1 flex items-center justify-center w-full pl-[4vw]">
                    <div className="mx-auto max-w-[460px] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                        <h2 className="text-[44px] xl:text-[52px] font-bold text-text-primary tracking-[-0.025em] leading-tight relative z-10 transition-colors">
                            {t('auth.welcomeTitle')}
                        </h2>
                        <div className="mt-5 -mb-6 relative z-0 flex items-center">
                            <CorphiaWordmark className="h-[96px] w-auto max-w-full object-contain object-left pointer-events-none select-none" />
                        </div>
                        {/* 副標（規範：不放眉標；Apple 副標 17／22 次要字，不用全大寫加字距） */}
                        <p className="mt-2 mb-10 text-[17px] leading-[22px] text-text-secondary">
                            {t('auth.engineSubtitle', '企業知識引擎')} · <span className="whitespace-nowrap">{t('auth.localDeploy', '地端部署')}</span>
                        </p>

                        <div className="space-y-7">
                            {[
                                { icon: <MessageSquare className="w-6 h-6 text-accent" />, title: t('auth.feature1'), desc: t('auth.feature1Desc') },
                                { icon: <FileText className="w-6 h-6 text-accent" />, title: t('auth.feature2'), desc: t('auth.feature2Desc') },
                                { icon: <Shield className="w-6 h-6 text-accent" />, title: t('auth.feature3'), desc: t('auth.feature3Desc') },
                            ].map((f) => (
                                <div key={f.title} className="flex items-center gap-4">
                                    <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full glass-chip flex items-center justify-center relative">
                                        {f.icon}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[17px] leading-[22px] font-semibold text-text-primary mb-0.5">{f.title}</span>
                                        <span className="text-[15px] leading-[20px] text-text-secondary">{f.desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            <div className="w-full lg:w-1/2 flex flex-col relative z-30">
                <div className="relative z-40 flex justify-between items-center px-6 pb-6 pt-14 lg:pt-6 w-full">
                    <div className="lg:hidden">
                        <BackendStatusPill status={backendStatus} compact />
                    </div>

                    {/* 主題／語言：兩顆獨立玻璃圓鈕，大小與後台「回上一頁」相同（36） */}
                    <div className="flex items-center gap-2 ml-auto">
                        
                            <button
                                onClick={toggleTheme}
                                className="btn-icon !w-9 !h-9 text-text-secondary"
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
                                    transitionTimingFunction: 'var(--ease-out)',
                                    opacity: theme === 'dark' ? 1 : 0,
                                    transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.5)',
                                }}
                                aria-hidden="true"
                            >
                                {/* Sun (太陽) — 深色模式時顯示，提示「點一下切到淺色」 */}
                                <Sun className="w-5 h-5" />
                            </span>
                            <span
                                className="absolute inset-0 flex items-center justify-center transition-all duration-500"
                                style={{
                                    transitionTimingFunction: 'var(--ease-out)',
                                    opacity: theme === 'light' ? 1 : 0,
                                    transform: theme === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
                                }}
                                aria-hidden="true"
                            >
                                {/* Moon (月亮) — 淺色模式時顯示，提示「點一下切到深色」 */}
                                <Moon className="w-5 h-5" />
                            </span>
                            </button>
                        

                        <div className="relative" ref={langMenuRef}>
                            
                                <button
                                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                                    className={`btn-icon !w-9 !h-9 ${isLangMenuOpen ? 'is-current' : 'text-text-secondary'}`}
                                >
                                <Globe className="w-5 h-5" />
                            </button>
                            

                            <AnimatePresence>
                                {isLangMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-2 w-32 paper !rounded-[20px] overflow-hidden z-50 p-1.5"
                                    >
                                        <LensMenu className="flex flex-col">
                                        <button
                                            onClick={() => handleLanguageSelect('zh-TW')}
                                            className={`menu-item !text-[14px] ${language === 'zh-TW' ? 'is-selected' : '!text-text-secondary'}`}
                                        >
                                            繁體中文
                                        </button>
                                        <button
                                            onClick={() => handleLanguageSelect('en-US')}
                                            className={`menu-item !text-[14px] mt-1 ${language === 'en-US' ? 'is-selected' : '!text-text-secondary'}`}
                                        >
                                            English
                                        </button>
                                        <button
                                            onClick={() => handleLanguageSelect('ja-JP')}
                                            className={`menu-item !text-[14px] mt-1 ${language === 'ja-JP' ? 'is-selected' : '!text-text-secondary'}`}
                                        >
                                            日本語
                                        </button>
                                        </LensMenu>
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
                        className="w-full max-w-[360px] paper !rounded-[43.5px] p-5 flex flex-col transition-colors aspect-square relative z-20"
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
                            {/* 分段切換：照範本拉桿旋鈕，按住放大變玻璃、可拖動 */}
                            <GlassSegmented
                                className="shrink-0 h-[52px]"
                                pad={5}
                                value={activeTab}
                                onChange={(v) => {
                                    setActiveTab(v)
                                    setFieldErrors({})
                                }}
                                options={[
                                    { value: 'login', label: t('auth.login') },
                                    { value: 'register', label: t('auth.register') },
                                ]}
                            />

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
                                                <div className="inline-flex items-center gap-2 justify-center px-4 py-2 glass-chip text-red-600 dark:text-red-400 rounded-full text-sm font-medium transition-colors">
                                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                                    <span>{error}</span>
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
                                            className="btn btn-lg btn-primary flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
                                                        className="shrink-0 h-[42px] btn-icon !w-[42px] !h-[42px] [--R:21px] text-accent flex items-center justify-center  overflow-hidden"
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
                            className="fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-sm"
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
                                className="pointer-events-auto w-full max-w-sm dialog-sheet relative"
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    className="btn-icon dialog-close absolute text-text-secondary"
                                    aria-label={t('common.close', '關閉')}
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="flex flex-col items-center text-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
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
                                    className="btn btn-lg btn-primary btn-block mt-5"
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
