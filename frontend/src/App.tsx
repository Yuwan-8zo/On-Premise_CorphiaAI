/**
 * App 根組件 - 路由設定
 */

import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { bootstrapAuth } from './lib/bootstrapAuth'
import { ACCENT_COLORS, THEME_COLORS } from './design-system'

import { lazy, Suspense } from 'react'

// Lazy loaded Pages
const Login = lazy(() => import('@/features/auth/pages/LoginPage'))
const Chat = lazy(() => import('@/features/chat/pages/ChatPage'))
const Admin = lazy(() => import('@/features/admin/pages/AdminPage'))
const Share = lazy(() => import('@/features/share/pages/SharePage'))
const NotFound = lazy(() => import('@/features/navigation/pages/NotFoundPage'))

// 僅在開發環境載入 Component Sandbox
const ComponentsTest = lazy(() => import('@/features/devtools/pages/ComponentsTestPage'))

import { ConfirmModal } from './components/ui/ConfirmModal'
import SettingsModal from './components/settings/SettingsModal'
import { ToastContainer } from './components/ui/Toast'
import DesktopUpdateNotice from './components/desktop/DesktopUpdateNotice'

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute'

// Desktop sidecar boot gate — 在桌面 app 啟動時等待後端 ready 才放行
import BackendGate from './components/boot/BackendGate'
import { SkelPage } from '@/components/ui/SkelPages'

// Global UI Components
const FallbackLoader = () => <SkelPage />

export default function App() {
    const { isAuthenticated, isBootstrapped } = useAuthStore()
    const { theme, setTheme, accentColor, themePreference } = useUIStore()
    const location = useLocation()
    const isPublicRoute =
        location.pathname === '/login' ||
        location.pathname.startsWith('/share/')
    const canUseAuthenticatedRedirect = isBootstrapped && isAuthenticated

    // ── 啟動時的 Token 復原流程 ──────────────────────────────────
    // 頁面重新整理後 accessToken 已從記憶體消失，
    // 這裡用 refreshToken 向後端換一張新的 accessToken
    useEffect(() => {
        if (!isBootstrapped) {
            bootstrapAuth()
        }
    }, [isBootstrapped])

    // 監聽系統主題變化（當使用者在 iPhone 設定切換深色/淺色模式時）
    // 只有當使用者偏好是「跟隨系統」時，才把 App 主題自動同步
    // 若使用者已明確選擇 light/dark，則尊重該選擇，不被系統覆蓋
    // 注意：iOS Safari 底部工具列永遠跟隨系統主題，這是 Apple 的系統限制
    useEffect(() => {
        if (themePreference !== 'system') return
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        // 進入 system 模式時，先把目前的系統值寫一次
        setTheme(mediaQuery.matches ? 'dark' : 'light')
        const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? 'dark' : 'light')
        }
        mediaQuery.addEventListener('change', handleSystemThemeChange)
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }, [setTheme, themePreference])

    // 主題與重點色同步：更新 html/body 背景色 + meta theme-color + data-accent
    // 確保 Safari 頂部狀態列與底部 Home bar 顏色與 App 主題一致
    // 所有頁面（login / chat / docs / admin）現在統一用 bg-bg-base + 弧線 SVG，
    // 所以 theme-color 一律給 baseBg，不再分 chat/其他。
    useEffect(() => {
        const isDark = theme === 'dark'
        const baseBg = isDark ? THEME_COLORS.darkBg : THEME_COLORS.lightBg
        const topBarBg = baseBg
        const csOnly = isDark ? 'only dark' : 'only light'
        const html = document.documentElement

        // 強調色：Apple 系統色，淺色與深色外觀各一組；強調色上的文字一律白色（Apple 做法）
        const preset = ACCENT_COLORS[accentColor] || ACCENT_COLORS.blue
        html.style.setProperty('--color-ios-accent-light', preset.rgb)
        html.style.setProperty('--color-ios-accent-dark', preset.rgbDark)
        html.style.setProperty('--text-on-accent', '#FFFFFF')

        // 深色：黑色漸層（不帶品牌色）。畫面最上方 24 → 三層波浪 17／10／3，一層比一層黑（上淺下深，跟淺色模式同方向）
        const darkBase = '24 24 26'
        const darkWaves = ['17 17 19', '10 10 11', '3 3 4']
        darkWaves.forEach((c, i) => {
            if (isDark) html.style.setProperty(`--wave-d${i + 1}`, c)
            else html.style.removeProperty(`--wave-d${i + 1}`)
        })
        for (const k of ['--bg-base', '--bg-canvas', '--bg-main']) {
            if (isDark) html.style.setProperty(k, darkBase)
            else html.style.removeProperty(k)
        }
        // 卡片／側欄／對話框（玻璃，九成二不透明）與不透明浮層（選單）：中性深灰，比背景亮一階；光邊由卡片色自動算（snow.css）
        if (isDark) {
            html.style.setProperty('--glass-card', 'rgba(38, 38, 41, 0.92)')
            html.style.setProperty('--bg-surface', '32 32 35')
            html.style.setProperty('--bg-elevated', '46 46 49')
        } else {
            for (const k of ['--glass-card', '--bg-surface', '--bg-elevated']) html.style.removeProperty(k)
        }

        // 分隔線：Apple opaqueSeparator（深色 #38383A、淺色 #C6C6C8），不跟強調色走
        html.style.setProperty('--border-subtle', isDark ? '56 56 58' : '198 198 200')
        html.style.setProperty('--border-strong', isDark ? '72 72 74' : '174 174 178')
        
        // 保留 data-accent 給一些可能的舊邏輯（如果有的話）
        html.setAttribute('data-accent', accentColor)

        // dark class 切換
        if (isDark) {
            html.classList.add('dark')
        } else {
            html.classList.remove('dark')
        }

        // html/body 背景色即時更新（不依賴 CSS transition）
        // 深色用整片漸層（主題色深色調 → 更深），淺色用單一 baseBg
        if (isDark) {
            // 單色底（跟重整前 index.html 寫的同一色），上淺下深的層次交給頁面的波浪背景：重整、換頁淡入時底色都不跳
            html.style.background = `rgb(${darkBase})`
            document.body.style.background = 'transparent'
        } else {
            html.style.background = baseBg
            document.body.style.background = baseBg
        }
        // Safari 需要 background-attachment: fixed 漸層才會固定不隨滾動拉長
        html.style.backgroundAttachment = 'fixed'

        // color-scheme 更新（控制鍵盤、scrollbar 等原生 UI）
        html.style.colorScheme = csOnly

        // meta[theme-color] 更新（控制 Safari toolbar 顏色）
        // 先把所有 theme-color 移掉再新增單一動態值，強制 Safari 重新偵測
        // 用 topBarBg 而非 bg —— chat 頁面要對齊 sidebar 的 surface 色，不是 base
        const existingThemeColors = document.querySelectorAll('meta[name="theme-color"]')
        existingThemeColors.forEach((m) => m.remove())
        const metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        metaThemeColor.setAttribute('content', isDark ? `rgb(${darkBase})` : topBarBg)
        document.head.appendChild(metaThemeColor)

        // meta[color-scheme] 更新
        const existingColorScheme = document.querySelector('meta[name="color-scheme"]')
        if (existingColorScheme) existingColorScheme.remove()
        const metaColorScheme = document.createElement('meta')
        metaColorScheme.setAttribute('name', 'color-scheme')
        metaColorScheme.setAttribute('content', csOnly)
        document.head.appendChild(metaColorScheme)

    }, [theme, accentColor, location.pathname])

    // ── 修正 iOS Safari 的 100dvh 偶發卡住（App 切到背景再切回來最常發生）──
    // html 的高度用 100dvh（base.css），理論上會跟著目前看得到的視窗高度即時變動，
    // 但部分 iOS 版本切到背景再切回來（或分割畫面、Duo 這類會變動安全區的裝置）時，
    // dvh 會卡在切走前的舊值，底部因此多出一塊沒填滿的空白，要等整頁重新載入才會修正。
    // 用 JS 讀當下真正的 window.innerHeight 蓋成 inline style（優先權比 CSS 的 dvh 高），
    // 在「切回來」這個時機點（visibilitychange／pageshow／resize）重新量一次就能修正，不用整頁重載。
    useEffect(() => {
        const fixViewportHeight = () => {
            document.documentElement.style.height = `${window.innerHeight}px`
        }
        fixViewportHeight()
        const onVisible = () => { if (document.visibilityState === 'visible') fixViewportHeight() }
        window.addEventListener('resize', fixViewportHeight)
        window.addEventListener('orientationchange', fixViewportHeight)
        window.addEventListener('pageshow', fixViewportHeight)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('resize', fixViewportHeight)
            window.removeEventListener('orientationchange', fixViewportHeight)
            window.removeEventListener('pageshow', fixViewportHeight)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [])

    // ── 等待 bootstrapAuth 完成才渲染路由，避免閃爍 ──────────────
    if (!isBootstrapped && !isPublicRoute) {
        return <FallbackLoader />
    }

    return (
        <BackendGate>
            {/* 頁面切換動畫：每當 location.pathname 改變時，新頁面會從下方淡入 */}
            <div
                // 只有換「頁區」（聊天／文件／後台／登入…）才重播換頁過場；同一區內換網址不重掛整頁
                key={location.pathname.split('/')[1] === 'chat' ? '' : location.pathname.split('/')[1]}
                className="page-transition h-full overflow-hidden"
            >
                <Suspense fallback={<FallbackLoader />}>
                    <Routes location={location}>
                        {/* 公開路由 */}
                        <Route
                            path="/login"
                            element={canUseAuthenticatedRedirect ? <Navigate to="/" replace /> : <Login />}
                        />
                        <Route
                            path="/register"
                            // 註冊已併入登入頁的「註冊」分頁；舊網址直接帶到登入頁
                            element={<Navigate to="/login" replace />}
                        />
                        <Route
                            path="/share/:conversationId"
                            element={<Share />}
                        />
                        
                        {/* 元件測試沙盒 (僅開發環境可見) */}
                        {import.meta.env.DEV && (
                            <Route
                                path="/test-components"
                                element={<ComponentsTest />}
                            />
                        )}

                        {/* 受保護路由 */}
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/chat"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/chat/:conversationId"
                            element={
                                <ProtectedRoute>
                                    <Chat />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <Admin />
                                </ProtectedRoute>
                            }
                        />

                        {/* 404 */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </div>
            
            {/* 全域元件 */}
            <ConfirmModal />
            <SettingsModal />
            <ToastContainer />
            <DesktopUpdateNotice />
        </BackendGate>
    )
}

