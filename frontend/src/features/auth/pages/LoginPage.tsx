/**
 * 登入／註冊頁
 *   1. 歡迎頁：Corphia 標誌一筆一筆寫出來，「歡迎使用」在標誌上面，寫完出現「開始使用」
 *   2. 按「開始使用」：按鈕收成玻璃球，球一分為二——小 AI 彈到左邊、登入卡片從球的位置圓形擴散在右邊
 *      （手機：小 AI 在上、卡片在下）。過場見 utils/splitTransition。
 *   3. 小 AI 陪著登入（沒有嘴巴，表情只靠眼睛、手、身體）：
 *      打信箱眼睛跟著字走、打密碼閉眼（按顯示密碼會偷看）、送出時思考、成功開心跳、失敗皺眉搖頭（hooks/useLoginMascot）
 *      出錯時錯誤原因由小 AI 的泡泡說，卡片邊緣變紅
 *   卡片：分段切換（登入／註冊）＋信箱、密碼（註冊時多「確認密碼」）＋送出
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from '@/components/snow/icons'
import Mascot from '@/components/mascot/Mascot'
import GlassSegmented from '@/components/ui/GlassSegmented'
import Tooltip from '@/components/ui/Tooltip'
import WaveBackground from '@/components/ui/WaveBackground'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import ContactAdminDialog from '../components/ContactAdminDialog'
import FloatingInput from '../components/FloatingInput'
import LoginToolbar from '../components/LoginToolbar'
import LogoWrite from '../components/LogoWrite'
import { useAuthForm } from '../hooks/useAuthForm'
import { SAY_MS, useLoginMascot } from '../hooks/useLoginMascot'
import { prefersReducedMotion, shrinkToOrb, splitOrb, type Orb } from '../utils/splitTransition'
import { EASE_DECEL } from '@/lib/motionPresets'
import './login.css'

/** 註冊欄位展開／收合：0.32 秒減速（規範曲線） */
const EXPAND = { duration: 0.32, ease: EASE_DECEL }

type Stage = 'welcome' | 'leaving' | 'auth'

export default function Login() {
    const { t } = useTranslation()
    const { isLoading } = useAuthStore()
    const isDark = useUIStore((s) => s.theme === 'dark')
    const [showContactAdmin, setShowContactAdmin] = useState(false)

    // ── 小 AI（表情、看哪裡、泡泡：hooks/useLoginMascot）──
    const mascot = useLoginMascot()

    // ── 卡片 ──
    const cardRef = useRef<HTMLFormElement>(null)
    const shakeCard = () => {
        const card = cardRef.current
        if (!card) return
        card.classList.remove('is-shake')
        card.getBoundingClientRect() // 先讓瀏覽器排一次版，拿掉再加回去的晃動才會重播
        card.classList.add('is-shake')
    }

    const form = useAuthForm({
        onResult: (ok) => {
            if (!ok) shakeCard()
            // 成功時等小 AI 開心跳完（登入才換頁）
            return mascot.react(ok, form.tab === 'register')
        },
    })
    const isRegister = form.tab === 'register'
    // 目前的錯誤（欄位沒填、密碼錯、尚未註冊…）：不寫在輸入框下方，由小 AI 說；卡片邊緣同時變紅。改了內容錯誤消失就收起來
    // 好幾欄都有錯（例如信箱、密碼都沒填）就一行一個，一起說
    const errorText = Object.values(form.fieldErrors).filter(Boolean).join('\n') || null

    // ── 歡迎頁 → 登入 ──
    const pageRef = useRef<HTMLDivElement>(null)
    const startRef = useRef<HTMLButtonElement>(null)
    const pendingOrb = useRef<Orb | null>(null)
    const [stage, setStage] = useState<Stage>('welcome')
    const start = async () => {
        if (stage !== 'welcome') return
        const canAnimate = typeof Element.prototype.animate === 'function' && !prefersReducedMotion()
        if (!canAnimate || !startRef.current || !pageRef.current) {
            setStage('auth')
            mascot.speak(t('auth.mascotHello'), SAY_MS.hello)
            return
        }
        setStage('leaving')
        pendingOrb.current = await shrinkToOrb(startRef.current, pageRef.current)
        setStage('auth')
    }
    // 登入區畫上去之後（還沒顯示前）量位置，接著分裂
    useLayoutEffect(() => {
        const orb = pendingOrb.current
        const mascotEl = mascot.ref.current?.el
        if (stage !== 'auth' || !orb || !mascotEl || !cardRef.current || !pageRef.current) return
        pendingOrb.current = null
        const total = splitOrb(orb, pageRef.current, mascotEl, cardRef.current)
        // 彈到定位後：照新位置後面的背景色重算身體顏色，再打招呼
        const timer = window.setTimeout(() => {
            mascot.ref.current?.retint()
            mascot.speak(t('auth.mascotHello'), SAY_MS.hello)
        }, total)
        return () => clearTimeout(timer)
        // 只在進到登入區那一次
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage])

    return (
        <div
            ref={pageRef}
            // 重新整理一律回到歡迎頁：停在登入區時不記骨架版面（見 lib/layoutSnapshot）
            data-skel-nosave={stage !== 'welcome' || undefined}
            className="login-page min-h-screen min-h-[100svh] min-h-[100dvh] flex flex-col bg-bg-base transition-colors duration-300 relative overflow-x-hidden overflow-y-auto select-none"
            style={{
                // 輸入框邊線：依深淺色給不同灰
                ['--border-subtle' as string]: isDark ? '56 56 58' : '198 198 200',
                ['--border-strong' as string]: isDark ? '72 72 74' : '174 174 178',
                // iOS 瀏海／底部橫條不要蓋到內容
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <WaveBackground />
            </div>

            <div className="login-head relative z-40 flex justify-end items-center px-6 pb-6 pt-14 lg:pt-6 w-full">
                <LoginToolbar />
            </div>

            {/* 歡迎頁：蓋在整頁正中間 */}
            <section
                className={`login-welcome${stage === 'welcome' ? '' : ' is-out'}`}
                aria-hidden={stage !== 'welcome' || undefined}
            >
                <LogoWrite title={t('auth.welcomeTitle')} />
                <button
                    ref={startRef}
                    type="button"
                    onClick={start}
                    className={`login-start btn btn-lg btn-secondary${stage === 'welcome' ? '' : ' is-gone'}`}
                >
                    {t('auth.getStarted')}
                </button>
            </section>

            {stage !== 'welcome' && (
                <main
                    className="login-auth relative z-30 flex-1 flex flex-col lg:flex-row items-center justify-center px-6 lg:px-8 pb-12"
                    style={{ visibility: stage === 'auth' ? 'visible' : 'hidden' }}
                >
                    <Mascot
                        ref={mascot.ref}
                        mood={mascot.mood}
                        peek={mascot.peek}
                        look={mascot.look}
                        say={mascot.say || errorText}
                        sayTone={!mascot.say && errorText ? 'error' : 'normal'}
                        label={t('auth.mascotName')}
                        onPoke={() => mascot.speak(t('auth.mascotTickle'), SAY_MS.tickle)}
                    />

                    {/*
                      正方形卡片，所有間距都用 flex-1 平均分配：登入 3 段、註冊 4 段一樣寬
                      確認密碼欄：上方間距 flexGrow 0↔1、欄位本身高度 0↔auto，兩者同步動畫
                    */}
                    <form
                        ref={cardRef}
                        onSubmit={(e) => {
                            mascot.setMood('think')
                            form.submit(e).catch(() => undefined)
                        }}
                        noValidate
                        className={`login-card${errorText ? ' has-error' : ''} w-full max-w-[var(--sz-360)] paper !rounded-[var(--r-43d5)] p-5 flex flex-col transition-colors aspect-square relative z-20`}
                    >
                        <GlassSegmented
                            className="shrink-0 h-[var(--sz-52)]"
                            pad="--seg-pad-lg"
                            value={form.tab}
                            onChange={form.setTab}
                            options={[
                                { value: 'login', label: t('auth.login') },
                                { value: 'register', label: t('auth.register') },
                            ]}
                        />

                        <div className="flex-1" />
                        <div className="shrink-0 w-full">
                            <FloatingInput
                                id="email"
                                type="email"
                                value={form.email}
                                onChange={(e) => {
                                    form.setEmail(e.target.value)
                                    mascot.onEmailMove(e)
                                }}
                                onFocus={mascot.onEmailFocus}
                                onBlur={mascot.onFieldBlur}
                                onSelect={mascot.onEmailMove}
                                onKeyUp={mascot.onEmailMove}
                                onClick={mascot.onEmailMove}
                                required
                                label={t('auth.account')}
                                error={form.fieldErrors.email}
                                hideErrorText
                            />
                        </div>

                        <div className="flex-1" />
                        <div className="shrink-0 w-full">
                            <FloatingInput
                                id="password"
                                type="password"
                                value={form.password}
                                onChange={(e) => form.setPassword(e.target.value)}
                                onFocus={() => mascot.onPasswordFocus('password')}
                                onBlur={mascot.onFieldBlur}
                                onRevealChange={mascot.onReveal('password')}
                                required
                                label={t('auth.password')}
                                error={form.fieldErrors.password}
                                hideErrorText
                            />
                        </div>

                        {/* 註冊時多一段等寬間距 */}
                        <motion.div
                            initial={false}
                            animate={{ flexGrow: isRegister ? 1 : 0 }}
                            transition={EXPAND}
                            style={{ flexShrink: 0, flexBasis: 0, minHeight: 0 }}
                        />

                        {/*
                          確認密碼：pt-3 留給浮動標籤（標籤有一半在輸入框上緣外，overflow-hidden 會切到）；
                          marginTop -12 抵銷 pt-3，讓這段間距跟其他間距一樣寬
                        */}
                        <motion.div
                            initial={false}
                            animate={{ height: isRegister ? 'auto' : 0, opacity: isRegister ? 1 : 0, marginTop: isRegister ? -12 : 0 }}
                            transition={EXPAND}
                            className="w-full shrink-0 overflow-hidden"
                            style={{ pointerEvents: isRegister ? 'auto' : 'none' }}
                            aria-hidden={!isRegister}
                        >
                            <div className="pt-3">
                                <FloatingInput
                                    id="confirm-password"
                                    type="password"
                                    value={form.confirmPassword}
                                    onChange={(e) => form.setConfirmPassword(e.target.value)}
                                    onFocus={() => mascot.onPasswordFocus('confirm-password')}
                                    onBlur={mascot.onFieldBlur}
                                    onRevealChange={mascot.onReveal('confirm-password')}
                                    required={isRegister}
                                    label={t('auth.confirmPassword')}
                                    tabIndex={isRegister ? 0 : -1}
                                    error={form.fieldErrors.confirmPassword}
                                    hideErrorText
                                />
                            </div>
                        </motion.div>

                        <div className="flex-1" />

                        {/* 送出；登入失敗過一次，右邊多一顆「?」（聯絡管理員重設密碼） */}
                        <div className="w-full flex gap-2 items-stretch shrink-0">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn btn-lg btn-primary flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                            >
                                {isLoading ? t('common.loading') : isRegister ? t('auth.register') : t('auth.login')}
                            </button>

                            <AnimatePresence>
                                {!isRegister && form.loginFailedOnce && (
                                    <Tooltip label={t('auth.forgotPassword')}>
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowContactAdmin(true)}
                                            initial={{ opacity: 0, scale: 0.95, width: 0 }}
                                            animate={{ opacity: 1, scale: 1, width: 42 }}
                                            exit={{ opacity: 0, scale: 0.95, width: 0 }}
                                            transition={{ duration: 0.25, ease: EASE_DECEL }}
                                            aria-label={t('auth.forgotPassword')}
                                            className="shrink-0 btn-icon !w-[var(--sz-42)] !h-[var(--sz-42)] [--R:21px] text-accent flex items-center justify-center overflow-hidden"
                                        >
                                            <HelpCircle className="w-5 h-5 shrink-0" />
                                        </motion.button>
                                    </Tooltip>
                                )}
                            </AnimatePresence>
                        </div>
                    </form>
                </main>
            )}

            <ContactAdminDialog open={showContactAdmin} onClose={() => setShowContactAdmin(false)} />
        </div>
    )
}
