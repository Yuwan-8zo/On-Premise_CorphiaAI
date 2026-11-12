/**
 * 設定視窗
 *   左：標題、分頁導覽、管理後台入口（管理員／工程師才有）；右：目前分頁的內容
 *   手機版一次只顯示一邊（先選分頁，再進內容，左上角返回）
 *   各分頁內容在同一個資料夾：ProfileSection、AppearanceSection、LanguageSection、GuideSection、AboutSection
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Book, ChevronLeft, ChevronRight, Globe, Info, Palette, ShieldCheck, User, X } from '@/components/snow/icons'
import GlassNav from '@/components/ui/GlassNav'
import { usePageDirection } from '@/lib/usePageDirection'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import AboutSection from './AboutSection'
import AppearanceSection from './AppearanceSection'
import GuideSection from './GuideSection'
import LanguageSection from './LanguageSection'
import ProfileSection from './ProfileSection'

type SettingSection = 'profile' | 'appearance' | 'language' | 'guide' | 'about'

const PAGES: Record<SettingSection, () => React.ReactElement> = {
    profile: ProfileSection,
    appearance: AppearanceSection,
    language: LanguageSection,
    guide: GuideSection,
    about: AboutSection,
}
/** 選單順序（換頁方向照這個順序） */
const SECTION_ORDER: SettingSection[] = ['profile', 'appearance', 'language', 'guide', 'about']

/** 使用說明、關於自己有 .set-page；其他分頁由外層包 */
const PAGE_CLASS: Record<SettingSection, string> = {
    profile: 'set-page',
    appearance: 'set-page',
    language: 'set-page',
    guide: 'h-full flex-1 min-h-0 flex flex-col',
    about: 'h-full flex-1 min-h-0 flex flex-col',
}

/** 開關動畫長度（毫秒） */
const ANIM_MS = 300

export default function SettingsModal() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const user = useAuthStore((s) => s.user)
    const { isSettingsOpen, setSettingsOpen } = useUIStore()
    const [activeSection, setActiveSection] = useState<SettingSection>('profile')
    const [mobileView, setMobileView] = useState<'menu' | 'content'>('menu')
    // 換頁方向：分頁照選單順序；手機上返回選單＝往回（進入內容一律往後，見 motion.css .settings-content）
    const sectionDir = usePageDirection(SECTION_ORDER.indexOf(activeSection))
    const mobileDir = usePageDirection(mobileView === 'menu' ? 0 : 1)

    /*
     * 開關動畫：延遲卸載
     *   開：先以「關閉」樣子掛上，兩個畫格後切成開啟 → 觸發轉場
     *   關：先套關閉樣子，等動畫結束才真的卸載
     */
    const [isVisible, setIsVisible] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    useEffect(() => {
        if (isSettingsOpen) {
            setIsVisible(true)
            setIsClosing(true)
            const id = requestAnimationFrame(() => requestAnimationFrame(() => setIsClosing(false)))
            return () => cancelAnimationFrame(id)
        }
        setIsClosing(true)
        const id = window.setTimeout(() => {
            setIsVisible(false)
            setIsClosing(false)
        }, ANIM_MS)
        return () => window.clearTimeout(id)
    }, [isSettingsOpen])

    const menuItems = [
        { id: 'profile' as const, icon: <User className="w-5 h-5" />, label: t('settings.profile') },
        { id: 'appearance' as const, icon: <Palette className="w-5 h-5" />, label: t('settings.theme') },
        { id: 'language' as const, icon: <Globe className="w-5 h-5" />, label: t('settings.language') },
        { id: 'guide' as const, icon: <Book className="w-5 h-5" />, label: t('settings.guide') },
        { id: 'about' as const, icon: <Info className="w-5 h-5" />, label: t('settings.about') },
    ]
    const ActivePage = PAGES[activeSection]

    if (!isVisible) return null

    return (
        <>
            <div
                className={`fixed inset-0 z-50 bg-black/20 dark:bg-black/45 backdrop-blur-md transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={() => setSettingsOpen(false)}
            />
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12 pointer-events-none transition-[opacity,transform,filter] duration-normal ease-apple ${isClosing ? 'opacity-0 scale-[0.95] [filter:blur(8px)]' : 'opacity-100 scale-100 [filter:none]'}`}
            >
                    {/* Modal Content —— 玻璃感（半透明 + backdrop-blur + 白邊 + 浮起陰影） */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('settings.title', '設定')}
                        className="relative w-full max-w-[var(--sz-800)] h-full max-h-[90dvh] md:max-h-[var(--sz-750)] paper !rounded-[var(--r-68)] flex flex-col md:flex-row overflow-hidden select-none pointer-events-auto"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSettingsOpen(false)}
                            aria-label={t('common.close')}
                            className="btn-icon !w-[var(--sz-36)] !h-[var(--sz-36)] absolute top-[var(--sp-36)] right-[var(--sp-36)] text-text-secondary z-20"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* 側邊導航 —— 內層淡淡的暈染對比，跟 modal 主體有層次但仍維持玻璃透明感 */}
                        <div key={`menu-${mobileView}`} data-dir={mobileDir} className={`settings-menu page-in md:w-64 flex-1 min-h-0 md:flex-none flex-shrink-0 flex-col ${mobileView === 'content' ? 'hidden md:flex' : 'flex'}`}>
                            {/* 四個角都跟外框 68 同心：關閉鈕右緣對齊內容卡（離右 36），離上也是 36；標題字左緣對齊導覽圖示（52），字上緣離頂也是 52；管理後台膠囊離左、離下都是 36，底邊對齊右側內容最後一張卡（內容下內距也是 36） */}
                            <div className="pl-[var(--sp-51)] pr-4 pt-[var(--sp-48)] pb-2">
                                <h2 className="text-xl leading-[var(--lh-24)] font-bold text-text-primary">
                                    {t('settings.title')}
                                </h2>
                            </div>
              {/* 導覽項跟下方「管理後台」膠囊左右對齊：左 36、右 14 */}
              <nav className="flex-1 px-[var(--sp-36)] md:pr-4 py-4 overflow-y-auto scrollbar-none">
                                <GlassNav
                                    aria-label={t('settings.title')}
                                    value={activeSection}
                                    onChange={(id) => {
                                        setActiveSection(id)
                                        setMobileView('content')
                                    }}
                                    items={menuItems}
                                />
                            </nav>

                            {/* 底部：管理後台入口（僅 admin / engineer 可見），清單列樣式 */}
                            {(user?.role === 'admin' || user?.role === 'engineer') && (
                                <div className="px-[var(--sp-36)] md:pr-4 pt-2 pb-[var(--sp-36)]">
                                    <div className="set-group !rounded-full">
                                        <button
                                            type="button"
                                            onClick={() => { setSettingsOpen(false); navigate('/admin') }}
                                            className="set-row set-row-btn has-icon !rounded-full !gap-2 !pl-[var(--sp-14)] !pr-[var(--sp-14)] whitespace-nowrap"
                                        >
                                            <span className="flex w-[var(--sz-30)] flex-none items-center justify-center"><ShieldCheck className="w-5 h-5" /></span>
                                            <span className="set-label">{t('settings.adminLabel')}</span>
                                            <ChevronRight className="set-chevron" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 主內容區域 */}
                        {/* 捲動區上下淡出（同聊天頁 .chat-scroll）：捲動時內容不會被外框硬切 */}
                        <div onScroll={(e) => { const el = e.currentTarget; el.classList.toggle('is-scrolled', el.scrollTop > 4) }} className={`chat-scroll settings-scroll flex-1 overflow-y-auto scrollbar-none min-h-0 bg-transparent relative ${mobileView === 'menu' ? 'hidden md:block' : 'block'}`}>
                            <div className="p-6 md:pl-10 md:pr-[var(--sp-36)] md:pt-14 md:pb-[var(--sp-36)] min-h-full">
                                {/* 手機版返回上一層（iOS：箭頭＋上一頁的標題） */}
                                <button
                                    className="md:hidden mb-4 -ml-1 flex items-center min-h-[var(--tap-sm)] pr-[var(--sp-12)] text-accent text-[length:var(--fs-15)] font-medium"
                                    onClick={() => setMobileView('menu')}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    {t('settings.title')}
                                </button>
                                <div
                                    key={`${activeSection}-${mobileView}`}
                                    data-dir={sectionDir}
                                    className={`${PAGE_CLASS[activeSection]} settings-content page-in`}
                                >
                                    <ActivePage />
                                </div>
                            </div>
                        </div>
                    </div>
            </div>

        </>
    )
}
