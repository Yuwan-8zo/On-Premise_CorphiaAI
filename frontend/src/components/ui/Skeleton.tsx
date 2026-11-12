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
import type { CSSProperties, ReactNode } from 'react'
import WaveBackground from '@/components/ui/WaveBackground'
import i18n from '@/i18n'

export function Skel({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <span aria-hidden className={`skel ${className}`} style={style} />
}

/**
 * 文字骨架：children 放和真資料同格式的佔位文字（例如「0.0」「00.0%」「8 cores」），文字透明、只看到灰條。
 * 高度一定等於真資料那一行，資料載入後版面不會長高或跳動；放在數字、短文字的位置用這個，不要用固定高度的 Skel。
 */
export function SkelText({ children }: { children: ReactNode }) {
    return <span aria-hidden className="skel-text">{children}</span>
}

export function SkelRows({ count = 5, className = '' }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label={i18n.t('common.loading')} className={className}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                    <Skel className="h-9 w-9 !rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <Skel className="h-[var(--sz-14)]" style={{ width: `${62 - (i % 3) * 12}%` }} />
                        <Skel className="h-[var(--sz-11)]" style={{ width: `${34 - (i % 2) * 8}%` }} />
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
                <div key={i} role="status" aria-label={i18n.t('common.loading')} className={`rounded-[var(--r-16)] bg-[var(--chip)] p-4 flex flex-col gap-3 ${className}`}>
                    <Skel className="h-[var(--sz-16)] w-1/2" />
                    <Skel className="h-[var(--sz-12)] w-1/3" />
                    <Skel className="h-[var(--sz-12)] w-2/3 mt-1" />
                </div>
            ))}
        </>
    )
}

export function SkelMessages({ count = 3, className = '' }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label={i18n.t('common.loading')} className={`flex flex-col gap-4 ${className}`}>
            {Array.from({ length: count }, (_, i) =>
                i % 2 === 0 ? (
                    <div key={i} className="flex justify-end">
                        <Skel className="h-[var(--sz-44)] !rounded-[var(--r-22)]" style={{ width: `${38 - (i % 3) * 6}%` }} />
                    </div>
                ) : (
                    <div key={i} className="flex flex-col gap-2">
                        <Skel className="h-[var(--sz-14)] w-[80%]" />
                        <Skel className="h-[var(--sz-14)] w-[72%]" />
                        <Skel className="h-[var(--sz-14)] w-[46%]" />
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
                            <Skel className="h-[var(--sz-12)]" style={{ width: `${c === 0 ? 70 : 55 - ((r + c) % 3) * 12}%` }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    )
}

/** 文字灰條：用 em 當單位，放在跟真實文字同字級的容器裡，長度＝字數、高度＝字身，會跟著字級縮放 */
function SkelChars({ chars }: { chars: number }) {
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
            <aside className="paper hidden md:block relative shrink-0 w-[var(--sz-260)] h-[calc(100%-2*var(--sp-16))] my-4 ml-4 !rounded-[var(--r-35)]">
                <Skel className="absolute left-[var(--sp-22)] top-[var(--sp-21)] h-[var(--sz-28)] w-[var(--sz-28)] !rounded-full" />
                <Skel className="absolute left-[var(--sp-216)] top-[var(--sp-25)] h-[var(--sz-21)] w-[var(--sz-21)] !rounded-[var(--r-6)]" />
                <Skel className="absolute left-[var(--sp-14)] top-[var(--sp-74)] h-[var(--sz-44)] w-[var(--sz-232)]" />
                <Skel className="absolute left-[var(--sp-14)] top-[var(--sp-132)] h-[var(--sz-44)] w-[var(--sz-232)]" />
                <span className="absolute left-[var(--sp-14)] top-[var(--sp-201)] text-[length:var(--fs-13)] leading-[var(--lh-18)]"><SkelChars chars={4} /></span>
                <Skel className="absolute left-[var(--sp-20)] bottom-[var(--sp-16)] h-[var(--sz-32)] w-[var(--sz-32)] !rounded-full" />
                <span className="absolute left-[var(--sp-64)] bottom-[var(--sp-22)] text-[length:var(--fs-15)] leading-[var(--lh-20)]"><SkelChars chars={4} /></span>
            </aside>
            <div className="relative flex-1 min-w-0">
                <Skel className="absolute left-[var(--sp-21)] top-[var(--sp-21)] h-[var(--sz-40)] w-[var(--sz-136)] !rounded-[var(--r-12)]" />
                <div className="glass-chip absolute right-[var(--sp-68)] top-[var(--sp-21)] flex h-[var(--sz-40)] w-[var(--sz-245)] items-center !rounded-[var(--r-20)] px-[var(--sp-16)]">
                    <span className="text-[length:var(--fs-15)]"><SkelChars chars={12} /></span>
                </div>
                <div className="glass-chip absolute right-[var(--sp-21)] top-[var(--sp-21)] h-[var(--sz-40)] w-[var(--sz-40)] !rounded-full" />
                <div className="absolute left-1/2 top-[calc(97px+10vh)] w-full max-w-3xl -translate-x-1/2 px-4 md:px-0">
                    <h2 className="text-center text-[length:var(--fs-18)] sm:text-[length:var(--fs-24)] md:text-[length:var(--fs-34)] font-bold leading-[1.25]"><SkelChars chars={14} /></h2>
                    <div className="mx-auto mt-[var(--sp-28)] grid w-full max-w-[var(--sz-600)] grid-cols-1 sm:grid-cols-2 gap-[var(--sp-10)]">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="paper relative h-[var(--sz-118)] !rounded-[var(--r-25)]">
                                <Skel className="absolute left-[var(--sp-14)] top-[var(--sp-14)] h-[var(--sz-36)] w-[var(--sz-36)] !rounded-[var(--r-10)]" />
                                <span className="absolute left-[var(--sp-14)] top-[var(--sp-60)] text-[length:var(--fs-15)] leading-[var(--lh-22)]"><SkelChars chars={4} /></span>
                                <span className="absolute left-[var(--sp-14)] top-[var(--sp-86)] text-[length:var(--fs-13)] leading-[var(--lh-18)]"><SkelChars chars={i % 2 ? 15 : 14} /></span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute bottom-[var(--sp-28)] left-1/2 w-full max-w-3xl -translate-x-1/2 px-3 sm:px-4 md:px-0">
                    <div className="glass-field relative h-[var(--sz-50)] !rounded-[var(--r-25)]">
                        <Skel className="absolute left-[var(--sp-6)] top-[var(--sp-6)] h-[var(--sz-38)] w-[var(--sz-38)] !rounded-full" />
                        <span className="absolute left-[var(--sp-49)] top-[var(--sp-14)] text-[length:var(--fs-15)] leading-[var(--lh-22)]"><SkelChars chars={5} /></span>
                        <Skel className="absolute right-[var(--sp-50)] top-[var(--sp-6)] h-[var(--sz-38)] w-[var(--sz-38)] !rounded-full" />
                        <Skel className="absolute right-[var(--sp-6)] top-[var(--sp-6)] h-[var(--sz-38)] w-[var(--sz-38)] !rounded-full" />
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
                <div className="glass-chip h-[var(--sz-32)] w-[var(--sz-80)] !rounded-full" />
                <div className="flex-1 flex items-center justify-center w-full pl-[4vw]">
                    <div className="mx-auto max-w-[var(--sz-460)] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                        <h2 className="text-[length:var(--fs-44)] xl:text-[length:var(--fs-52)] font-bold leading-tight"><SkelChars chars={4} /></h2>
                        <div className="mt-5 -mb-6 flex h-[var(--sz-96)] items-center"><Skel className="h-[var(--sz-64)] w-[var(--sz-237)] !rounded-[var(--r-16)]" /></div>
                        <p className="mt-2 mb-10 text-[length:var(--fs-17)] leading-[var(--lh-22)]"><SkelChars chars={12} /></p>
                        <div className="space-y-7">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="glass-chip h-[var(--sz-52)] w-[var(--sz-52)] shrink-0 !rounded-full" />
                                    <div className="flex flex-col">
                                        <span className="text-[length:var(--fs-17)] leading-[var(--lh-22)] mb-0.5"><SkelChars chars={6} /></span>
                                        <span className="text-[length:var(--fs-15)] leading-[var(--lh-20)]"><SkelChars chars={10} /></span>
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
                    <div className="w-full max-w-[var(--sz-360)] paper !rounded-[var(--r-46)] p-5 flex flex-col aspect-square">
                        <Skel className="h-[var(--sz-52)] w-full shrink-0" />
                        <div className="glass-field mt-[var(--sp-43)] flex h-[var(--sz-47)] items-center !rounded-full px-[var(--sp-22)]"><span className="text-[length:var(--fs-15)]"><SkelChars chars={2} /></span></div>
                        <div className="glass-field mt-[var(--sp-42)] flex h-[var(--sz-47)] items-center !rounded-full px-[var(--sp-22)]"><span className="text-[length:var(--fs-15)]"><SkelChars chars={2} /></span></div>
                        <div className="flex-1" />
                        <Skel className="h-[var(--sz-52)] w-full shrink-0" />
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
        <div className="px-[var(--sp-26)] pt-5 pb-2 text-[length:var(--fs-17)] leading-[var(--lh-22)]"><SkelChars chars={chars} /></div>
    )
    return (
        <div className="relative mx-auto flex h-full max-w-[var(--sz-1500)] flex-col px-3 py-3 md:px-4 md:py-3">
            <header className="mb-2 md:mb-3 flex shrink-0 items-center gap-2 pb-2 md:justify-between">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="glass-chip h-[var(--sz-34)] w-[var(--sz-34)] shrink-0 !rounded-full" />
                    <h1 className="text-[length:var(--fs-16)] md:text-[length:var(--fs-22)] font-semibold"><SkelChars chars={4} /></h1>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="hidden sm:flex glass-chip !rounded-full px-3 py-1.5 text-xs"><SkelChars chars={6} /></div>
                    <div className="glass-chip !rounded-full px-2.5 md:px-3 py-1 md:py-1.5 text-[length:var(--fs-11)] md:text-xs"><SkelChars chars={4} /></div>
                </div>
            </header>
            <main className="flex flex-col flex-1 min-h-0 gap-3 lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
                {/* 窄畫面：側欄換成頂部分頁列（40 高膠囊） */}
                <Skel className="lg:hidden h-[var(--sz-40)] w-full shrink-0" />
                <aside className="hidden lg:flex h-full flex-col overflow-hidden paper paper-lg lg:p-2">
                    <div className="mb-2 rounded-[var(--r-18)] bg-[var(--chip)] p-2.5">
                        <p className="text-[length:var(--fs-12)] leading-[var(--lh-18)]"><SkelChars chars={4} /></p>
                        <p className="mt-0.5 mb-2 text-[length:var(--fs-12)] leading-[var(--lh-18)]"><SkelChars chars={3} /></p>
                        <Skel className="h-1.5 w-full" />
                    </div>
                    <div className="flex flex-col gap-1 py-2">
                        {[2, 3, 2, 2, 2].map((c, i) => (
                            <div key={i} className="flex h-[var(--sz-34)] items-center gap-2 px-3 text-[length:var(--fs-13)]">
                                <Skel className="h-3.5 w-3.5 !rounded-[var(--r-4)] shrink-0" />
                                <SkelChars chars={c} />
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-3">
                        <div className="rounded-[var(--r-18)] bg-[var(--chip)] p-2">
                            <div className="flex items-center gap-1.5">
                                <Skel className="h-6 w-6 !rounded-full shrink-0" />
                                <div className="flex flex-col text-[length:var(--fs-12)] leading-[var(--lh-16)]"><SkelChars chars={3} /><span className="mt-1"><SkelChars chars={3} /></span></div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[length:var(--fs-12)]"><SkelChars chars={4} /><Skel className="h-[var(--sz-24)] w-[var(--sz-42)]" /></div>
                        </div>
                    </div>
                </aside>
                <div className="flex-1 min-h-0 min-w-0 lg:h-full">
                    <div className="grid gap-2 lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="paper p-2.5">
                                    <div className="flex items-center gap-2">
                                        <Skel className="h-7 w-7 shrink-0 !rounded-[var(--r-13)]" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[length:var(--fs-12)] leading-[var(--lh-18)]"><SkelChars chars={5} /></p>
                                            <p className="text-[length:var(--fs-18)] leading-tight"><SkelChars chars={1.4} /></p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                        <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                            <div className="paper min-h-[var(--sz-180)] lg:col-span-7 lg:min-h-0">{panelTitle(7)}</div>
                            <div className="paper min-h-[var(--sz-180)] lg:col-span-5 lg:min-h-0">{panelTitle(4)}</div>
                        </section>
                        <section className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-12">
                            <div className="paper min-h-[var(--sz-160)] lg:col-span-5 lg:min-h-0">{panelTitle(8)}</div>
                            <div className="paper min-h-[var(--sz-160)] lg:col-span-4 lg:min-h-0">{panelTitle(7)}</div>
                            <div className="paper min-h-[var(--sz-160)] lg:col-span-3 lg:min-h-0">{panelTitle(4)}</div>
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
        : path.startsWith('/share') ? <SkelMessages count={5} className="mx-auto max-w-3xl px-4 pt-[var(--sp-96)]" />
        : path === '/' || path.startsWith('/chat') ? <SkelChat />
        : null /* 其他網址（例如 404）：只留底色與波浪，不要冒出別頁的骨架 */
    return (
        <div role="status" aria-label={i18n.t('common.loading')} className="relative h-[100dvh] w-full bg-bg-base">
            {/* 波浪背景跟真實頁面一樣，載入完成時背景不會閃 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><WaveBackground /></div>
            <div className="relative h-full">{view}</div>
        </div>
    )
}
