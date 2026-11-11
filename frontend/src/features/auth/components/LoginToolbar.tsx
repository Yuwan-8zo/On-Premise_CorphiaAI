/**
 * 登入頁右上角：主題切換、語言選單（兩顆玻璃圓鈕，大小同後台「回上一頁」36）
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Moon, Sun } from '@/components/snow/icons'
import LensMenu from '@/components/ui/LensMenu'
import { LANGUAGES } from '@/i18n/languages'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useUIStore } from '@/store/uiStore'

/** 主題圖示：兩個疊在一起，依目前主題旋轉＋縮放交錯淡入淡出 */
function ThemeGlyph({ show, rotate, children }: { show: boolean; rotate: number; children: React.ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{
                transitionTimingFunction: 'var(--ease-out)',
                opacity: show ? 1 : 0,
                transform: show ? 'rotate(0deg) scale(1)' : `rotate(${rotate}deg) scale(0.5)`,
            }}
        >
            {children}
        </span>
    )
}

export default function LoginToolbar() {
    const { t } = useTranslation()
    const { theme, toggleTheme, language, setLanguage } = useUIStore()
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false)
    const langMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setIsLangMenuOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="flex items-center gap-2 ml-auto">
            {/* 深色時顯示太陽（點一下切到淺色），淺色時顯示月亮 */}
            <button onClick={toggleTheme} className="btn-icon !w-9 !h-9 text-text-secondary" aria-label={t('settings.theme')}>
                <ThemeGlyph show={theme === 'dark'} rotate={-90}><Sun className="w-5 h-5" /></ThemeGlyph>
                <ThemeGlyph show={theme === 'light'} rotate={90}><Moon className="w-5 h-5" /></ThemeGlyph>
            </button>

            <div className="relative" ref={langMenuRef}>
                <button
                    onClick={() => setIsLangMenuOpen((v) => !v)}
                    aria-label={t('settings.language')}
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
                            className="absolute right-0 mt-2 w-32 paper !rounded-[var(--r-20)] overflow-hidden z-50 p-1.5"
                        >
                            <LensMenu className="flex flex-col">
                                {LANGUAGES.map((lang, i) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => {
                                            setLanguage(lang.code)
                                            setIsLangMenuOpen(false)
                                        }}
                                        className={`menu-item !text-[length:var(--fs-14)] ${i > 0 ? 'mt-1' : ''} ${language === lang.code ? 'is-selected' : '!text-text-secondary'}`}
                                    >
                                        {lang.label}
                                    </button>
                                ))}
                            </LensMenu>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
