/**
 * 登入頁右上角：主題切換、語言選單（兩顆玻璃圓鈕，大小同後台「回上一頁」36）
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Moon, Sun } from '@/components/snow/icons'
import LensMenu from '@/components/ui/LensMenu'
import { useMenuTrigger } from '@/lib/menuDrag'
import { LANGUAGES } from '@/i18n/languages'
import { motion, AnimatePresence } from '@/lib/gsapMotion'
import { useUIStore } from '@/store/uiStore'
import { popIn } from '@/lib/motionPresets'
import { useDismiss } from '@/lib/useDismiss'

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

    // 點外面、按 Esc 關閉語言選單
    useDismiss(isLangMenuOpen, () => setIsLangMenuOpen(false), [langMenuRef])

    // 按住語言鈕直接拖進選單、放大鏡選取（lib/menuDrag）
    const trigger = useMenuTrigger()
    const langTrigger = trigger(isLangMenuOpen, () => setIsLangMenuOpen(true), () => setIsLangMenuOpen(false))

    return (
        <div className="flex items-center gap-2 ml-auto">
            {/* 深色時顯示太陽（點一下切到淺色），淺色時顯示月亮 */}
            <button onClick={toggleTheme} className="btn-icon !w-9 !h-9 text-text-secondary" aria-label={t('settings.theme')}>
                <ThemeGlyph show={theme === 'dark'} rotate={-90}><Sun className="w-5 h-5" /></ThemeGlyph>
                <ThemeGlyph show={theme === 'light'} rotate={90}><Moon className="w-5 h-5" /></ThemeGlyph>
            </button>

            <div className="relative" ref={langMenuRef}>
                <button
                    {...langTrigger}
                    aria-label={t('settings.language')}
                    aria-haspopup="menu"
                    aria-expanded={isLangMenuOpen}
                    className={`${langTrigger.className} btn-icon !w-9 !h-9 ${isLangMenuOpen ? 'is-current' : 'text-text-secondary'}`}
                >
                    <Globe className="w-5 h-5" />
                </button>

                <AnimatePresence>
                    {isLangMenuOpen && (
                        <motion.div
                            {...popIn}
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
