import { Link, useNavigate } from 'react-router-dom'
import { CorphiaBrandLogo } from '@/components/icons/CorphiaIcons'
import { Home, ArrowLeft } from '@/components/snow/icons'
import WaveBackground from '@/components/ui/WaveBackground'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
    const { t } = useTranslation()
    const navigate = useNavigate()

    return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-bg-base relative overflow-hidden transition-colors">
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><WaveBackground /></div>
            {/* 頂部 Logo */}
            <div className="absolute top-8 left-8 flex items-center gap-1.5 select-none">
                <CorphiaBrandLogo className="w-auto h-8 text-text-primary" />
            </div>

            <div className="flex flex-col items-center justify-center z-10 w-full px-6 mt-[-5dvh]">
                
                {/* 中央 404 視覺核心 */}
                <div className="flex items-center justify-center gap-3 md:gap-5 mb-8 select-none">
                    {/* 第一個 4 */}
                    <div className="text-[length:var(--fs-120)] md:text-[length:var(--fs-160)] font-light text-accent leading-none tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                        4
                    </div>

                    {/* 中央拱門插畫 (0) */}
                    <div className="w-[var(--sz-90)] h-[var(--sz-140)] md:w-[var(--sz-120)] md:h-[var(--sz-180)] rounded-t-[var(--r-900)] bg-gradient-to-b from-transparent to-transparent relative overflow-hidden flex-shrink-0 shadow-inner border-b border-[var(--paper-line)]">
                        
                        {/* 內部光暈/漸層填色 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                        
                        {/* 遠方山丘/地平線 */}
                        <svg className="absolute bottom-0 w-full h-[65%] text-text-muted" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0,40 Q25,20 50,45 T100,20 L100,100 L0,100 Z" fill="currentColor" opacity="0.7"/>
                            <path d="M0,65 Q35,40 65,65 T100,50 L100,100 L0,100 Z" fill="currentColor" opacity="0.4"/>
                        </svg>

                        {/* 蜿蜒小路 */}
                        <svg className="absolute bottom-0 w-full h-[75%]" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M35,100 C25,70 55,60 50,45 C47,35 55,25 50,15 L53,15 C58,25 50,35 55,45 C60,60 38,70 45,100 Z" style={{ fill: 'rgb(var(--bg-main))' }} opacity="0.9"/>
                        </svg>

                        {/* 路標 */}
                        <div className="absolute right-[22%] bottom-[38%] flex flex-col items-center">
                            <div className="w-[var(--sz-1d5)] h-5 bg-accent rounded-full" />
                            <div className="absolute top-1 -right-[var(--sp-6)] w-4 h-[var(--sz-3)] bg-accent rounded-sm transform rotate-[-4deg]" />
                            <div className="absolute top-[var(--sp-10)] -left-[var(--sp-4)] w-3 h-[var(--sz-3)] bg-accent rounded-sm transform rotate-[6deg]" />
                        </div>

                        {/* 星芒 (Sparkle) */}
                        <svg className="absolute top-[22%] right-[32%] w-2.5 h-2.5 text-accent/70 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L14 9L21 11L14 13L12 20L10 13L3 11L10 9L12 2Z" />
                        </svg>
                    </div>

                    {/* 第二個 4 */}
                    <div className="text-[length:var(--fs-120)] md:text-[length:var(--fs-160)] font-light text-accent leading-none tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                        4
                    </div>
                </div>

                {/* 標題與內文 */}
                <h1 className="text-xl md:text-[length:var(--fs-22)] font-bold text-text-primary mb-4 tracking-wide">
                    {t('ui.notFound.title')}
                </h1>
                <p className="text-[length:var(--fs-13)] md:text-[length:var(--fs-14)] text-text-muted text-center max-w-[var(--sz-420)] mb-10 leading-relaxed font-medium">
                    {t('ui.notFound.body1')}<br className="hidden md:block"/>
                    {t('ui.notFound.body2')}
                </p>

                {/* 按鈕群組 */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                    {/* 回到首頁 */}
                    <Link
                        to="/"
                        className="btn btn-primary w-full sm:w-auto"
                    >
                        <Home className="w-[var(--sz-18)] h-[var(--sz-18)]" />
                        <span>{t('ui.notFound.home')}</span>
                    </Link>

                    {/* 返回上一頁 */}
                    <button
                        onClick={() => navigate(-1)}
                        className="btn btn-secondary w-full sm:w-auto"
                    >
                        <ArrowLeft className="w-[var(--sz-18)] h-[var(--sz-18)]" />
                        <span>{t('ui.notFound.back')}</span>
                    </button>
                </div>

            </div>
        </div>
    )
}
