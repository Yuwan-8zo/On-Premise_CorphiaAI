/**
 * 主佈局元件
 * 
 * 包含側邊欄和主要內容區域
 */

import { Outlet } from 'react-router-dom'
import { Menu, LogOut, Settings, MessageSquare, Files, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export default function Layout() {
    const { t } = useTranslation()
    const location = useLocation()
    const { sidebarOpen, toggleSidebar } = useUIStore()
    const { clearAuth, user } = useAuthStore()

    const navItems = [
        { icon: MessageSquare, label: t('nav.chat'), href: '/chat' },
        { icon: Files, label: t('nav.documents'), href: '/documents' },
        // { icon: Settings, label: t('nav.settings'), href: '/settings' },
    ]

    // 管理員連結
    if (user?.role === 'admin' || user?.role === 'engineer') {
        navItems.push({ icon: User, label: t('nav.admin'), href: '/admin' })
    }

    // 工程師連結
    if (user?.role === 'engineer') {
        navItems.push({ icon: Settings, label: t('nav.engineer'), href: '/engineer' })
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* 側邊欄 */}
            <aside
                className={cn(
                    "flex flex-col border-r bg-white dark:bg-slate-950 dark:border-slate-800 transition-all duration-300",
                    !sidebarOpen ? "w-16" : "w-64"
                )}
            >
                {/* Logo 區域 */}
                <div className="flex h-16 items-center border-b px-4 dark:border-slate-800">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSidebar}
                        className="mr-2"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    {sidebarOpen && (
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                            {t('app.name')}
                        </span>
                    )}
                </div>

                {/* 導航選單 */}
                <nav className="flex-1 space-y-1 p-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                                    !sidebarOpen && "justify-center px-2"
                                )}
                                title={sidebarOpen ? undefined : item.label}
                            >
                                <item.icon className="h-5 w-5 flex-shrink-0" />
                            {sidebarOpen && <span>{item.label}</span>}
                            </Link>
                        )
                    })}
                </nav>

                {/* 底部使用者區域 */}
                <div className="border-t p-4 dark:border-slate-800">
                    <div className={cn("flex items-center gap-3", !sidebarOpen && "flex-col")}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
                            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>

                        {sidebarOpen && (
                            <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {user?.name || 'User'}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {user?.email}
                                </p>
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={clearAuth}
                            title={t('auth.logout')}
                            className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                        >
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </aside>

            {/* 主要內容 */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Outlet />
            </main>
        </div>
    )
}
