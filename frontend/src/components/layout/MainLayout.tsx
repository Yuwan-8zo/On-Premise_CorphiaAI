/**
 * 主版面配置 (Main Layout)
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Bars3Icon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'

import { useUIStore } from '../../store/uiStore'
import Sidebar from './Sidebar'

export default function MainLayout() {
    const { sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore()

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* 側邊欄 */}
            <Sidebar />

            {/* 遮罩 (移動端) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 md:hidden transition-opacity"
                    onClick={toggleSidebar}
                />
            )}

            {/* 主內容區 */}
            <main className="flex-1 flex flex-col h-full min-w-0 relative bg-slate-50 dark:bg-slate-900">
                {/* 頂部 Header */}
                <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleSidebar}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <Bars3Icon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {theme === 'dark' ? (
                                <SunIcon className="w-5 h-5" />
                            ) : (
                                <MoonIcon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </header>

                {/* 頁面內容 */}
                <div className="flex-1 overflow-hidden relative">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
