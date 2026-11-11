/**
 * 骨架畫面（讀取中）：照元件外形放灰色預留方塊，取代轉圈圈。
 *   <Skel>         單一灰塊；預設膠囊（文字行），傳 className 改大小／圓角
 *   <SkelRows>     清單列：圓形圖示＋兩行文字＋右側標籤
 *   <SkelCards>    卡片格：標題、說明、內容區
 *   <SkelMessages> 對話：左右交錯的氣泡
 *   <SkelTableRows> 表格列（放在 <tbody> 裡）
 *   <SkelPage>     整頁：左側欄＋主內容
 * 顏色用 --chip（深淺模式各自的淡墨色），呼吸動畫在 snow.css 的 .skel；「減少動態效果」時靜止。
 */
import type { CSSProperties } from 'react'
import WaveBackground from '@/components/ui/WaveBackground'

export function Skel({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <span aria-hidden className={`skel ${className}`} style={style} />
}

export function SkelRows({ count = 5, className = '' }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label="載入中" className={className}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <Skel className="h-9 w-9 !rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <Skel className="h-[14px]" style={{ width: `${62 - (i % 3) * 12}%` }} />
                        <Skel className="h-[11px]" style={{ width: `${34 - (i % 2) * 8}%` }} />
                    </div>
                    <Skel className="h-6 w-14 shrink-0" />
                </div>
            ))}
        </div>
    )
}

export function SkelCards({ count = 3, className = '' }: { count?: number; className?: string }) {
    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} role="status" aria-label="載入中" className={`rounded-[16px] bg-[var(--chip)] p-4 flex flex-col gap-3 ${className}`}>
                    <Skel className="h-[16px] w-1/2" />
                    <Skel className="h-[12px] w-1/3" />
                    <Skel className="h-[12px] w-2/3 mt-1" />
                </div>
            ))}
        </>
    )
}

export function SkelMessages({ count = 3, className = '' }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label="載入中" className={`flex flex-col gap-4 ${className}`}>
            {Array.from({ length: count }, (_, i) =>
                i % 2 === 0 ? (
                    <div key={i} className="flex justify-end">
                        <Skel className="h-[44px] !rounded-[22px]" style={{ width: `${38 - (i % 3) * 6}%` }} />
                    </div>
                ) : (
                    <div key={i} className="flex flex-col gap-2">
                        <Skel className="h-[14px] w-[80%]" />
                        <Skel className="h-[14px] w-[72%]" />
                        <Skel className="h-[14px] w-[46%]" />
                    </div>
                ),
            )}
        </div>
    )
}

export function SkelTableRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <>
            {Array.from({ length: rows }, (_, r) => (
                <tr key={r} aria-hidden>
                    {Array.from({ length: cols }, (_, c) => (
                        <td key={c} className="px-4 py-3">
                            <Skel className="h-[12px]" style={{ width: `${c === 0 ? 70 : 55 - ((r + c) % 3) * 12}%` }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    )
}

/** 文字灰條：用 em 當單位，放在跟真實文字同字級的容器裡，長度＝字數、高度＝字身，會跟著字級縮放 */
function SkelText({ chars }: { chars: number }) {
    return <span aria-hidden className="skel align-middle h-[0.78em]" style={{ display: 'inline-block', width: `${chars}em` }} />
}

/*
 * 聊天頁骨架：外層沿用 ChatPage／ChatSidebar／ChatHeader／ChatInputArea 的寫法與量測值（1440×900 量出）
 *   側欄 260 寬、圓角 35、上下左 16；頂列內距 21；模型膠囊 245×40（圓角 20）＋選單鈕 40；
 *   標題 34 號字；建議卡 295×118、圓角 25、間距 10；輸入欄 672×50、圓角 25、離底 28
 */
function SkelChat() {
    return (
        <div className="flex absolute inset-0 w-full h-full overflow-hidden">
            <aside className="paper hidden md:block relative shrink-0 w-[260px] h-[calc(100vh-32px)] my-4 ml-4 !rounded-[35px]">
                <Skel className="absolute left-[22px] top-[21px] h-[28px] w-[28px] !rounded-full" />
                <Skel className="absolute left-[216px] top-[25px] h-[21px] w-[21px] !rounded-[6px]" />
                <Skel className="absolute left-[14px] top-[74px] h-[44px] w-[232px]" />
                <Skel className="absolute left-[14px] top-[132px] h-[44px] w-[232px]" />
                <span className="absolute left-[14px] top-[201px] text-[13px] leading-[18px]"><SkelText chars={4} /></span>
                <Skel className="absolute left-[20px] bottom-[16px] h-[32px] w-[32px] !rounded-full" />
                <span className="absolute left-[64px] bottom-[22px] text-[15px] leading-[20px]"><SkelText chars={4} /></span>
            </aside>
            <div className="relative flex-1 min-w-0">
                <Skel className="absolute left-[21px] top-[21px] h-[40px] w-[136px] !rounded-[12px]" />
                <div className="glass-chip absolute right-[68px] top-[21px] flex h-[40px] w-[245px] items-center !rounded-[20px] px-[16px]">
                    <span className="text-[15px]"><SkelText chars={12} /></span>
                </div>
                <div className="glass-chip absolute right-[21px] top-[21px] h-[40px] w-[40px] !rounded-full" />
                <div className="absolute left-1/2 top-[calc(97px+10vh)] w-full max-w-3xl -translate-x-1/2 px-4 md:px-0">
                    <h2 className="text-center text-[18px] sm:text-[24px] md:text-[34px] font-bold leading-[1.25]"><SkelText chars={14} /></h2>
                    <div className="mx-auto mt-[28px] grid w-full max-w-[600px] grid-cols-1 sm:grid-cols-2 gap-[10px]">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="paper relative h-[118px] !rounded-[25px]">
                                <Skel className="absolute left-[14px] top-[14px] h-[36px] w-[36px] !rounded-[10px]" />
                                <span className="absolute left-[14px] top-[60px] text-[15px] leading-[22px]"><SkelText chars={4} /></span>
                                <span className="absolute left-[14px] top-[86px] text-[13px] leading-[18px]"><SkelText chars={i % 2 ? 15 : 14} /></span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute bottom-[28px] left-1/2 w-full max-w-3xl -translate-x-1/2 px-3 sm:px-4 md:px-0">
                    <div className="glass-field relative h-[50px] !rounded-[25px]">
                        <Skel className="absolute left-[6px] top-[6px] h-[38px] w-[38px] !rounded-full" />
                        <span className="absolute left-[49px] top-[14px] text-[15px] leading-[22px]"><SkelText chars={5} /></span>
                        <Skel className="absolute right-[50px] top-[6px] h-[38px] w-[38px] !rounded-full" />
                        <Skel className="absolute right-[6px] top-[6px] h-[38px] w-[38px] !rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/*
 * 登入頁骨架：外層沿用 LoginPage 的寫法（左右各半、歡迎區 460 寬、右側登入卡 360 正方、圓角 46、內距 20）
 *   狀態膠囊 80×32、右上兩顆 32 圓鈕；標題 44／52 號字、字標 96 高、副標 17、三列 52 圓＋17／15 號字
 *   卡片內：分段 52、欄位 47（間距 43／42）、登入鈕 52 貼底
 */
function SkelLogin() {
    return (
        <div className="min-h-[100dvh] flex relative overflow-hidden">
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative">
                <div className="glass-chip h-[32px] w-[80px] !rounded-full" />
                <div className="flex-1 flex items-center justify-center w-full pl-[4vw]">
                    <div className="mx-auto max-w-[460px] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                        <h2 className="text-[44px] xl:text-[52px] font-bold leading-tight"><SkelText chars={4} /></h2>
                        <div className="mt-5 -mb-6 flex h-[96px] items-center"><Skel className="h-[64px] w-[237px] !rounded-[16px]" /></div>
                        <p className="mt-2 mb-10 text-[17px] leading-[22px]"><SkelText chars={12} /></p>
                        <div className="space-y-7">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="glass-chip h-[52px] w-[52px] shrink-0 !rounded-full" />
                                    <div className="flex flex-col">
                                        <span className="text-[17px] leading-[22px] mb-0.5"><SkelText chars={6} /></span>
                                        <span className="text-[15px] leading-[20px]"><SkelText chars={10} /></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full lg:w-1/2 flex flex-col relative">
                <div className="flex justify-end items-center gap-2 px-6 pb-6 pt-14 lg:pt-6 w-full">
                    <div className="glass-chip h-9 w-9 !rounded-full" />
                    <div className="glass-chip h-9 w-9 !rounded-full" />
                </div>
                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    <div className="w-full max-w-[360px] paper !rounded-[46px] p-5 flex flex-col aspect-square">
                        <Skel className="h-[52px] w-full shrink-0" />
                        <div className="glass-field mt-[43px] flex h-[47px] items-center !rounded-full px-[22px]"><span className="text-[15px]"><SkelText chars={2} /></span></div>
                        <div className="glass-field mt-[42px] flex h-[47px] items-center !rounded-full px-[22px]"><span className="text-[15px]"><SkelText chars={2} /></span></div>
                        <div className="flex-1" />
                        <Skel className="h-[52px] w-full shrink-0" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/*
 * 管理後台骨架（總覽頁）：外層沿用 AdminPage／OverviewSection 的寫法
 *   頂列：返回鈕 34、標題 16／22 號字、右側兩顆狀態膠囊（12 號字）
 *   左欄 180：目前模型方塊（圓角 18）、五個導覽項（13 號字）、底部區域網路小卡
 *   右側：六張數字卡（圖示 28、12／18 號字）→ 7／5 兩張圖表卡 → 5／4／3 三張卡，卡片標題 17 號字、左內距 26
 */
function SkelAdmin() {
    const panelTitle = (chars: number) => (
        <div className="px-[26px] pt-5 pb-2 text-[17px] leading-[22px]"><SkelText chars={chars} /></div>
    )
    return (
        <div className="relative mx-auto flex h-full max-w-[1500px] flex-col px-3 py-3 md:px-4 md:py-3">
            <header className="mb-2 md:mb-3 flex shrink-0 items-center gap-2 pb-2 md:justify-between">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="glass-chip h-[34px] w-[34px] shrink-0 !rounded-full" />
                    <h1 className="text-[16px] md:text-[22px] font-semibold"><SkelText chars={4} /></h1>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="hidden sm:flex glass-chip !rounded-full px-3 py-1.5 text-xs"><SkelText chars={6} /></div>
                    <div className="glass-chip !rounded-full px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs"><SkelText chars={4} /></div>
                </div>
            </header>
            <main className="flex flex-col flex-1 min-h-0 gap-3 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
                {/* 窄畫面：側欄換成頂部分頁列（40 高膠囊） */}
                <Skel className="lg:hidden h-[40px] w-full shrink-0" />
                <aside className="hidden lg:flex h-full flex-col overflow-hidden paper paper-lg lg:p-2">
                    <div className="mb-2 rounded-[18px] bg-[var(--chip)] p-2.5">
                        <p className="text-[12px] leading-[18px]"><SkelText chars={4} /></p>
                        <p className="mt-0.5 mb-2 text-[12px] leading-[18px]"><SkelText chars={3} /></p>
                        <Skel className="h-1.5 w-full" />
                    </div>
                    <div className="flex flex-col gap-1 py-2">
                        {[2, 3, 2, 2, 2].map((c, i) => (
                            <div key={i} className="flex h-[34px] items-center gap-2 px-3 text-[13px]">
                                <Skel className="h-3.5 w-3.5 !rounded-[4px] shrink-0" />
                                <SkelText chars={c} />
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-3">
                        <div className="rounded-[18px] bg-[var(--chip)] p-2">
                            <div className="flex items-center gap-1.5">
                                <Skel className="h-6 w-6 !rounded-full shrink-0" />
                                <div className="flex flex-col text-[12px] leading-[16px]"><SkelText chars={3} /><span className="mt-1"><SkelText chars={3} /></span></div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[12px]"><SkelText chars={4} /><Skel className="h-[24px] w-[42px]" /></div>
                        </div>
                    </div>
                </aside>
                <div className="flex-1 min-h-0 min-w-0 lg:h-full">
                    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="paper p-2.5">
                                    <div className="flex items-center gap-2">
                                        <Skel className="h-7 w-7 shrink-0 !rounded-[13px]" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] leading-[18px]"><SkelText chars={5} /></p>
                                            <p className="text-[18px] leading-tight"><SkelText chars={1.4} /></p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                        <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                            <div className="paper min-h-[180px] lg:col-span-7 lg:min-h-0">{panelTitle(7)}</div>
                            <div className="paper min-h-[180px] lg:col-span-5 lg:min-h-0">{panelTitle(4)}</div>
                        </section>
                        <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                            <div className="paper min-h-[160px] lg:col-span-5 lg:min-h-0">{panelTitle(8)}</div>
                            <div className="paper min-h-[160px] lg:col-span-4 lg:min-h-0">{panelTitle(7)}</div>
                            <div className="paper min-h-[160px] lg:col-span-3 lg:min-h-0">{panelTitle(4)}</div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    )
}

/** 整頁骨架：依目前網址顯示那一頁的外形（在哪一頁重整就顯示哪一頁） */
export function SkelPage() {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/'
    const view = path.startsWith('/login') ? <SkelLogin />
        : path.startsWith('/admin') ? <SkelAdmin />
        : path.startsWith('/share') ? <SkelMessages count={5} className="mx-auto max-w-3xl px-4 pt-[96px]" />
        : path === '/' || path.startsWith('/chat') ? <SkelChat />
        : null /* 其他網址（例如 404）：只留底色與波浪，不要冒出別頁的骨架 */
    return (
        <div role="status" aria-label="載入中" className="relative h-[100dvh] w-full bg-bg-base">
            {/* 波浪背景跟真實頁面一樣，載入完成時背景不會閃 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><WaveBackground /></div>
            <div className="relative h-full">{view}</div>
        </div>
    )
}
