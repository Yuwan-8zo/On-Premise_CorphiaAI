/**
 * 側邊欄元件
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
    ChatBubbleLeftRightIcon,
    DocumentTextIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

interface SidebarProps {
    className?: string
}

export default function Sidebar({ className = '' }: SidebarProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const { user, clearAuth } = useAuthStore()
    const { sidebarOpen } = useUIStore()

    const handleLogout = () => {
        clearAuth()
        window.location.href = '/login'
    }

    const navItems = [
        {
            name: t('nav.chat'),
            path: '/',
            icon: ChatBubbleLeftRightIcon
        },
        {
            name: t('nav.documents'),
            path: '/documents',
            icon: DocumentTextIcon
        },
        {
            name: t('nav.settings'),
            path: '/settings',
            icon: Cog6ToothIcon
        },
    ]

    return (
        <aside
            className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'
                } bg-slate-800 dark:bg-slate-950 transition-all duration-300 flex flex-col fixed md:relative z-20 h-full overflow-hidden ${className}`}
        >
            {/* 標題區域 */}
            <div className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                    C
                </div>
                <span className="text-white font-bold text-lg">Corphia AI</span>
            </div>

            {/* 導覽選單 */}
            <nav className="flex-1 px-2 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive
                                    ? 'bg-primary-600/20 text-primary-400'
                                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </button>
                    )
                })}
            </nav>

            {/* 使用者資訊 */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-white font-medium border border-slate-600">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate text-sm">{user?.name}</p>
                        <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title={t('auth.logout')}
                    >
                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
