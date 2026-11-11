/**
 * 登入／註冊頁
 *   桌機：左半邊歡迎與特色（LoginHero）、右半邊表單；手機：上方標題＋字標、下方表單
 *   表單是正方形卡片：分段切換（登入／註冊）＋信箱、密碼（註冊時多「確認密碼」）＋送出
 *   後端連線狀態用全站共用的系統狀態（外層 BackendGate 已確認後端啟動才會進到這頁）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle } from '@/components/snow/icons'
import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'
import GlassSegmented from '@/components/ui/GlassSegmented'
import Tooltip from '@/components/ui/Tooltip'
import WaveBackground from '@/components/ui/WaveBackground'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useAuthStore } from '@/store/authStore'
import { useSystemStore } from '@/store/systemStore'
import { useUIStore } from '@/store/uiStore'
import BackendStatusPill, { type BackendStatus } from '../components/BackendStatusPill'
import ContactAdminDialog from '../components/ContactAdminDialog'
import FloatingInput from '../components/FloatingInput'
import LoginHero from '../components/LoginHero'
import LoginToolbar from '../components/LoginToolbar'
import { useAuthForm } from '../hooks/useAuthForm'

/** 確認密碼欄展開／收合，與上方間距同一條曲線同步 */
const EXPAND = { duration: 0.32, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }

export default function Login() {
    const { t } = useTranslation()
    const { isLoading } = useAuthStore()
    const isDark = useUIStore((s) => s.theme === 'dark')
    const online = useSystemStore((s) => s.online)
    const backendStatus: BackendStatus = online === null ? 'checking' : online ? 'online' : 'offline'
    const form = useAuthForm()
    const [showContactAdmin, setShowContactAdmin] = useState(false)
    const isRegister = form.tab === 'register'

    return (
        <div
            // 多個高度單位當備援：部分內嵌瀏覽器的 dvh 算錯時版面不會上下偏移
            className="min-h-screen min-h-[100svh] min-h-[100dvh] flex bg-bg-base transition-colors duration-300 relative overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none"
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

            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative z-10">
                <BackendStatusPill status={backendStatus} />
                <LoginHero />
            </div>

            <div className="w-full lg:w-1/2 flex flex-col relative z-30">
                <div className="relative z-40 flex justify-between items-center px-6 pb-6 pt-14 lg:pt-6 w-full">
                    <div className="lg:hidden">
                        <BackendStatusPill status={backendStatus} compact />
                    </div>
                    <LoginToolbar />
                </div>

                {/* 手機版標題 */}
                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6 px-4">
                    <h2 className="text-xl font-bold text-text-primary mb-3 transition-colors">{t('auth.welcomeTitle')}</h2>
                    <CorphiaWordmark className="h-14 sm:h-16 w-auto max-w-[80%] object-contain mb-3 select-none pointer-events-none" />
                    <p className="text-text-secondary text-sm">{t('auth.engineDesc')}</p>
                </div>

                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    {/*
                      正方形卡片，所有間距都用 flex-1 平均分配：登入 3 段、註冊 4 段一樣寬
                      確認密碼欄：上方間距 flexGrow 0↔1、欄位本身高度 0↔auto，兩者同步動畫
                    */}
                    <form
                        onSubmit={form.submit}
                        noValidate
                        className="w-full max-w-[var(--sz-360)] paper !rounded-[var(--r-43d5)] p-5 flex flex-col transition-colors aspect-square relative z-20"
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
                                onChange={(e) => form.setEmail(e.target.value)}
                                required
                                label={t('auth.account')}
                                error={form.fieldErrors.email}
                            />
                        </div>

                        <div className="flex-1" />
                        <div className="shrink-0 w-full">
                            <FloatingInput
                                id="password"
                                type="password"
                                value={form.password}
                                onChange={(e) => form.setPassword(e.target.value)}
                                required
                                label={t('auth.password')}
                                error={form.fieldErrors.password}
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
                                    required={isRegister}
                                    label={t('auth.confirmPassword')}
                                    tabIndex={isRegister ? 0 : -1}
                                    error={form.fieldErrors.confirmPassword}
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
                                            initial={{ opacity: 0, scale: 0.5, width: 0 }}
                                            animate={{ opacity: 1, scale: 1, width: 42 }}
                                            exit={{ opacity: 0, scale: 0.5, width: 0 }}
                                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
                </div>
            </div>

            <ContactAdminDialog open={showContactAdmin} onClose={() => setShowContactAdmin(false)} />
        </div>
    )
}
