import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CorphiaTextLogo } from '../components/icons/CorphiaIcons'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
    const { t } = useTranslation()
    const navigate = useNavigate()

    return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#FAFAF8] dark:bg-corphia-obsidian relative overflow-hidden transition-colors">
            {/* 頂部 Logo */}
            <div className="absolute top-8 left-8 flex items-center gap-1.5 select-none">
                <CorphiaTextLogo className="w-7 h-7 text-corphia-ink dark:text-white" />
                <span className="font-bold text-[22px] tracking-tight text-corphia-ink dark:text-white" style={{ fontFamily: 'sans-serif' }}>
                    orphia
                </span>
            </div>

            <div className="flex flex-col items-center justify-center z-10 w-full px-6 mt-[-5dvh]">
                
                {/* 中央 404 視覺核心 */}
                <div className="flex items-center justify-center gap-3 md:gap-5 mb-8 select-none">
                    {/* 第一個 4 */}
                    <div className="text-[120px] md:text-[160px] font-light text-[#94785A] leading-none tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                        4
                    </div>

                    {/* 中央拱門插畫 (0) */}
                    <div className="w-[90px] h-[140px] md:w-[120px] md:h-[180px] rounded-t-[900px] bg-gradient-to-b from-[#F2EFEA] to-[#E8E4DF] dark:from-[#2A2420] dark:to-[#1A1613] relative overflow-hidden flex-shrink-0 shadow-[inset_0_2px_15px_rgba(0,0,0,0.03)] border-b border-[#E8E4DF] dark:border-[#2A2420]">
                        
                        {/* 內部光暈/漸層填色 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent dark:from-black/20 pointer-events-none" />
                        
                        {/* 遠方山丘/地平線 */}
                        <svg className="absolute bottom-0 w-full h-[65%] text-[#DCD6CE] dark:text-[#3A322A]" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0,40 Q25,20 50,45 T100,20 L100,100 L0,100 Z" fill="currentColor" opacity="0.7"/>
                            <path d="M0,65 Q35,40 65,65 T100,50 L100,100 L0,100 Z" fill="currentColor" opacity="0.4"/>
                        </svg>

                        {/* 蜿蜒小路 */}
                        <svg className="absolute bottom-0 w-full h-[75%]" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M35,100 C25,70 55,60 50,45 C47,35 55,25 50,15 L53,15 C58,25 50,35 55,45 C60,60 38,70 45,100 Z" fill="#F9F8F6" className="dark:fill-[#201B18]" opacity="0.9"/>
                        </svg>

                        {/* 路標 */}
                        <div className="absolute right-[22%] bottom-[38%] flex flex-col items-center">
                            <div className="w-[1.5px] h-5 bg-[#94785A] rounded-full" />
                            <div className="absolute top-1 -right-[6px] w-4 h-[3px] bg-[#94785A] rounded-sm transform rotate-[-4deg]" />
                            <div className="absolute top-[10px] -left-[4px] w-3 h-[3px] bg-[#94785A] rounded-sm transform rotate-[6deg]" />
                        </div>

                        {/* 星芒 (Sparkle) */}
                        <svg className="absolute top-[22%] right-[32%] w-2.5 h-2.5 text-[#94785A]/70 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L14 9L21 11L14 13L12 20L10 13L3 11L10 9L12 2Z" />
                        </svg>
                    </div>

                    {/* 第二個 4 */}
                    <div className="text-[120px] md:text-[160px] font-light text-[#94785A] leading-none tracking-tighter" style={{ fontFamily: 'Georgia, serif' }}>
                        4
                    </div>
                </div>

                {/* 標題與內文 */}
                <h1 className="text-xl md:text-[22px] font-bold text-corphia-ink dark:text-white mb-4 tracking-wide">
                    找不到你要的頁面
                </h1>
                <p className="text-[13px] md:text-[14px] text-[#8C867D] dark:text-gray-400 text-center max-w-[420px] mb-10 leading-relaxed font-medium">
                    抱歉，這個頁面可能已被移除、重新命名或暫時無法使用。<br className="hidden md:block"/>
                    你可以回到首頁，或使用搜尋功能繼續探索 Corphia AI。
                </p>

                {/* 按鈕群組 */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                    {/* 回到首頁 */}
                    <Link
                        to="/"
                        className="w-full sm:w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-[#94785A] hover:bg-[#836A4F] text-white text-[14px] font-medium transition-all active:scale-[0.98] shadow-[0_2px_8px_rgba(148,120,90,0.2)]"
                    >
                        <Home className="w-[18px] h-[18px]" />
                        <span>回到首頁</span>
                    </Link>

                    {/* 返回上一頁 */}
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-[150px] flex items-center justify-center gap-2 py-2.5 rounded-[10px] bg-transparent border border-[#E5E0D8] dark:border-[#3A322A] hover:bg-[#F2EFEA] dark:hover:bg-[#201B18] text-[#8C867D] dark:text-gray-300 text-[14px] font-medium transition-all active:scale-[0.98]"
                    >
                        <ArrowLeft className="w-[18px] h-[18px]" />
                        <span>返回上一頁</span>
                    </button>
                </div>

            </div>
        </div>
    )
}
