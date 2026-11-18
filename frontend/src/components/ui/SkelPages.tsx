/**
 * 整頁骨架（重新整理、等後端啟動、分頁程式下載中）
 *
 *   1. 記過這一頁的版面（lib/layoutSnapshot：上次離開時量的）→ 照真畫面一塊一塊畫，位置大小完全一樣
 *   2. 沒記過（第一次開、換了視窗大小）→ 下面手刻的版本。
 *      外框一律沿用真頁面的同一組 class（ChatPage／ChatHeader／ChatInputArea、LoginPage、AdminPage／OverviewSection），
 *      字用 SkelChars 放在同字級的容器裡 → 手機、Duo、桌機各斷點都跟著真頁面走。改真頁面版面時這裡要一起改。
 */
import type { CSSProperties } from 'react'
import WaveBackground from '@/components/ui/WaveBackground'
import { Skel, SkelMessages } from '@/components/ui/Skeleton'
import { useFitToHost } from '@/lib/useFitToHost'
import i18n from '@/i18n'
import { loadLayoutSnapshot, type SnapItem } from '@/lib/layoutSnapshot'

/** 文字灰條：用 em 當單位，放在跟真實文字同字級的容器裡，長度＝字數、高度＝字身，會跟著字級縮放 */
function SkelChars({ chars }: { chars: number }) {
    // 外層 span：放在 flex 裡時會變成一個區塊，高度＝這個字級的行高（跟真文字一樣），灰條才不會把那一列壓矮
    return (
        <span aria-hidden>
            <span className="skel align-[-0.12em] h-[0.78em]" style={{ display: 'inline-block', width: `${chars}em` }} />
        </span>
    )
}

/** 聊天頁 */
function SkelChat() {
    return (
        <div className="flex absolute inset-0 w-full h-full overflow-hidden">
            {/* 桌機側欄（手機收在抽屜裡，不畫） */}
            <aside className="paper hidden md:flex flex-col relative shrink-0 w-[var(--sz-260)] h-[calc(100%-2*var(--sp-16))] my-4 ml-4 !rounded-[var(--r-35)]">
                <div className="flex items-center justify-between p-4 pb-1 h-[var(--sz-60)] pr-[var(--sp-16)] shrink-0">
                    <Skel className="ml-[var(--sp-8)] h-[var(--sz-28)] w-[var(--sz-28)] !rounded-full" />
                    <Skel className="h-[var(--sz-20)] w-[var(--sz-20)] mr-3 !rounded-[var(--r-6)]" />
                </div>
                <div className="w-full px-[var(--sp-14)] py-4 flex flex-col gap-4">
                    <Skel className="h-[var(--sz-44)] w-full" />
                    <Skel className="h-[var(--sz-44)] w-full" />
                </div>
                <div className="px-4 mt-2 flex flex-col gap-3 text-[length:var(--fs-13)] leading-[var(--lh-18)]">
                    <span><SkelChars chars={4} /></span>
                    <span><SkelChars chars={7} /></span>
                </div>
                <div className="mt-auto px-[var(--sp-14)] pb-[var(--sp-14)]">
                    <div className="flex items-center gap-3 h-[var(--sz-44)] pl-[var(--sp-6)]">
                    <Skel className="h-[var(--sz-32)] w-[var(--sz-32)] !rounded-full shrink-0" />
                    <span className="text-[length:var(--fs-15)]"><SkelChars chars={4} /></span>
                    </div>
                </div>
            </aside>
            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                <header className="shrink-0 w-full p-3 md:pt-[var(--sp-21)] md:pb-4 md:px-[var(--sp-21)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <span className="p-2 -ml-1 md:hidden shrink-0"><Skel className="w-5 h-5 !rounded-[var(--r-6)]" /></span>
                        <span className="hidden sm:flex h-[var(--sz-40)] items-center"><Skel className="h-[var(--sz-30)] w-[var(--sz-100)] !rounded-[var(--r-10)]" /></span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 shrink">
                        <div className="btn-group btn-group-36 flex items-center h-[var(--sz-36)] px-3.5 text-[length:var(--fs-12)] md:text-[length:var(--fs-14)]"><SkelChars chars={9} /></div>
                        <div className="btn-group btn-group-36 h-[var(--dock-btn)] w-[var(--dock-btn)] !rounded-full" />
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-hidden pt-6 pb-4">
                    <div className="w-full h-full max-w-3xl mx-auto px-4 md:px-0 flex flex-col">
                        <div aria-hidden className="min-h-0 basis-[8vh] md:basis-[10vh]" />
                        <h2 className="text-[length:var(--fs-18)] sm:text-[length:var(--fs-24)] md:text-[length:var(--fs-34)] font-bold text-center leading-[1.3] md:leading-tight"><SkelChars chars={13} /></h2>
                        <div className="mb-[var(--fluid-block)]" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-[min(600px,100%)] mx-auto">
                            {[4, 4, 5, 5].map((c, i) => (
                                <div key={i} className="paper !rounded-[var(--r-25)] p-[var(--fluid-pad)] w-full flex flex-col gap-[var(--fluid-gap)]">
                                    <span className="snow-row-icon !rounded-[var(--r-10)]" />
                                    <span className="min-w-0">
                                        <span className="block font-semibold text-[length:var(--fs-15)]"><SkelChars chars={c} /></span>
                                        <span className="block text-[length:var(--fs-13)] leading-snug mt-1"><SkelChars chars={i % 2 ? 15 : 14} /></span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* 輸入欄：高＝按鈕高＋上下內距，和真的一樣 */}
                <div className="shrink-0 pt-2 pb-4 md:pb-8 w-full">
                    <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-0 w-full">
                        <div className="glass-field flex items-center gap-1 sm:gap-1.5 p-[var(--field-pad)]">
                            <Skel className="h-[var(--field-btn)] w-[var(--field-btn)] !rounded-full shrink-0" />
                            <span className="flex-1 px-1.5 sm:px-2 text-[length:var(--fs-15)]"><SkelChars chars={4} /></span>
                            <Skel className="h-[var(--field-btn)] w-[var(--field-btn)] !rounded-full shrink-0" />
                            <Skel className="h-[var(--field-btn)] w-[var(--field-btn)] !rounded-full shrink-0" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

/** 登入頁：桌機左右各半（左歡迎、右正方卡片）；手機上方狀態＋標題＋字標、下方卡片 */
function SkelLogin() {
    return (
        <div className="min-h-[100dvh] flex relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="hidden lg:flex lg:w-1/2 flex-col p-8 relative">
                <div className="glass-chip flex items-center gap-2 rounded-full px-3.5 py-2 w-fit text-[length:var(--fs-13)] leading-[var(--lh-18)]"><span className="w-2 h-2" /><SkelChars chars={3} /></div>
                <div className="flex-1 flex items-center justify-center w-full pl-[4vw]">
                    <div className="mx-auto max-w-[var(--sz-460)] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                        <h2 className="text-[length:var(--fs-44)] xl:text-[length:var(--fs-52)] font-bold leading-tight"><SkelChars chars={4} /></h2>
                        <div className="mt-5 -mb-6 flex h-[var(--sz-96)] items-center"><Skel className="h-[var(--sz-64)] w-[var(--sz-200)] !rounded-[var(--r-16)]" /></div>
                        <p className="mt-2 mb-10 text-[length:var(--fs-17)] leading-[var(--lh-22)]"><SkelChars chars={11} /></p>
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
                <div className="flex justify-between items-center px-6 pb-6 pt-14 lg:pt-6 w-full">
                    <div className="lg:hidden glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-[length:var(--fs-12)] leading-[var(--lh-16)]"><span className="w-2 h-2" /><SkelChars chars={3} /></div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="glass-chip h-9 w-9 !rounded-full" />
                        <div className="glass-chip h-9 w-9 !rounded-full" />
                    </div>
                </div>
                {/* 手機版標題 */}
                <div className="lg:hidden flex flex-col items-center justify-center pt-2 pb-6 px-4">
                    <h2 className="text-xl font-bold mb-3"><SkelChars chars={4} /></h2>
                    <Skel className="h-14 sm:h-16 w-[var(--sz-160)] mb-3 !rounded-[var(--r-14)]" />
                    <p className="text-sm"><SkelChars chars={13} /></p>
                </div>
                <div className="flex-1 flex items-start lg:items-center justify-center px-6 lg:px-8 pb-12">
                    <div className="w-full max-w-[var(--sz-360)] paper !rounded-[var(--r-43d5)] p-5 flex flex-col aspect-square">
                        <Skel className="h-[var(--sz-52)] w-full shrink-0" />
                        <div className="flex-1" />
                        <div className="glass-field !rounded-full flex items-center px-5 py-3.5 text-[length:var(--fs-15)]"><SkelChars chars={2} /></div>
                        <div className="flex-1" />
                        <div className="glass-field !rounded-full flex items-center px-5 py-3.5 text-[length:var(--fs-15)]"><SkelChars chars={2} /></div>
                        <div className="flex-1" />
                        <Skel className="h-[var(--btn-h-lg)] w-full shrink-0" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/** 後台（總覽頁）：和 AdminPage 一樣的整頁縮放（useFitToHost），桌機左側欄、手機上方分段切換 */
function SkelAdmin() {
    const fitRef = useFitToHost<HTMLDivElement>({ checks: '[data-fit-check="page"]' })
    const header = (chars: number) => (
        <div className="pl-[var(--sp-21)] pr-[var(--sp-16)] pt-[var(--sp-16)] pb-[var(--space)]">
            <h2 className="text-[length:var(--fs-17)] leading-[var(--lh-22)] font-semibold"><SkelChars chars={chars} /></h2>
        </div>
    )
    const box = 'rounded-[var(--admin-in)] bg-[var(--chip)]'
    const card = 'paper !rounded-[var(--admin-r)] flex flex-col'
    return (
        <div className="edge-shell admin-shell absolute inset-0 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div ref={fitRef} className="admin-fit relative mx-auto flex h-full max-w-[var(--sz-1500)] flex-col p-[var(--space)] lg:[--fit-on:1]">
                <header className="admin-head mb-[var(--space)] flex shrink-0 items-center gap-2 md:justify-between">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="glass-chip !w-[var(--admin-back)] !h-[var(--admin-back)] shrink-0 !rounded-full" />
                        <h1 className="text-[length:var(--fs-16)] md:text-[length:var(--fs-22)] font-semibold"><SkelChars chars={4} /></h1>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="hidden sm:flex items-center gap-2 rounded-full glass-chip px-3 py-1.5 text-xs font-semibold"><span className="h-1.5 w-1.5" /><SkelChars chars={5} /></div>
                        <div className="rounded-full glass-chip px-2.5 md:px-3 py-1 md:py-1.5 text-[length:var(--fs-11)] md:text-xs font-medium"><SkelChars chars={4} /></div>
                    </div>
                </header>
                <main className="flex flex-col flex-1 min-h-0 gap-[var(--space)] lg:grid lg:grid-cols-[180px_minmax(0,1fr)]">
                    <aside data-fit-check="page" className="flex h-auto lg:h-full flex-col overflow-hidden paper paper-lg lg:!rounded-[var(--admin-r)] lg:p-[var(--space)]">
                        <div className={`hidden lg:block mb-[var(--space)] p-[var(--space)] ${box}`}>
                            <div className="mb-2">
                                <p className="text-[length:var(--fs-12)]"><SkelChars chars={4} /></p>
                                <p className="mt-0.5 text-[length:var(--fs-12)] font-semibold"><SkelChars chars={9} /></p>
                            </div>
                            <Skel className="h-1.5 w-full" />
                        </div>
                        <Skel className="lg:hidden w-full h-[var(--sz-40)]" />
                        <div className="hidden lg:flex lg:flex-col gap-[var(--nav-gap-sm)] py-2 shrink-0">
                            {[2, 3, 2, 2, 2].map((c, i) => (
                                <div key={i} className="nav-item nav-item-sm">
                                    <span className="nav-item-icon"><Skel className="h-3.5 w-3.5 !rounded-full" /></span>
                                    <SkelChars chars={c} />
                                </div>
                            ))}
                        </div>
                        <div className="hidden lg:block mt-auto pt-[var(--space)]">
                            <div className={`p-[var(--sp-9d5)] ${box}`}>
                                <div className="flex items-start gap-1.5 text-[length:var(--fs-12)] leading-none">
                                    <Skel className="h-6 w-6 !rounded-full shrink-0" />
                                    <div className="flex-1 flex flex-col gap-1"><SkelChars chars={3} /><span className="text-[length:var(--fs-10)]"><SkelChars chars={3} /></span></div>
                                </div>
                                <div className="mt-1.5 pt-1.5 flex items-center justify-between text-[length:var(--fs-10)]"><SkelChars chars={4} /><Skel className="w-[calc(var(--sw-w)*var(--sw-sm))] h-[calc(var(--sw-h)*var(--sw-sm))]" /></div>
                                <div className="mt-1.5 pt-1.5 flex items-end justify-between text-[length:var(--fs-10)]"><span className="flex flex-col gap-1"><SkelChars chars={4} /><SkelChars chars={7} /></span><Skel className="h-[var(--sz-28)] w-[var(--sz-28)] !rounded-full" /></div>
                            </div>
                        </div>
                    </aside>
                    <div className="flex flex-col flex-1 min-h-0 min-w-0 lg:h-full overflow-hidden">
                        <div className="grid gap-[var(--space)] lg:h-full lg:grid-rows-[auto_minmax(min-content,1fr)_minmax(min-content,1fr)]">
                            <section className="grid grid-cols-2 gap-[var(--space)] sm:grid-cols-3 lg:grid-cols-6">
                                {[5, 4, 4, 4, 5, 4].map((c, i) => (
                                    <div key={i} className="paper !rounded-[var(--admin-r)] pl-[var(--sp-20)] pr-[var(--sp-16)] py-[var(--space)]">
                                        <div className="flex flex-wrap items-center gap-x-[var(--space)] gap-y-[var(--sp-6)]">
                                            <Skel className="h-7 w-7 shrink-0 !rounded-[var(--r-13)]" />
                                            <div className="flex-1 basis-[max-content]">
                                                <p className="text-[length:var(--fs-12)] font-medium"><SkelChars chars={c} /></p>
                                                <p className="text-[length:var(--fs-18)] font-semibold leading-tight"><SkelChars chars={1.4} /></p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                            <section className="grid min-h-0 grid-cols-1 gap-[var(--space)] lg:grid-cols-12">
                                <div className={`${card} min-h-[var(--sz-180)] lg:col-span-7`}>
                                    {header(7)}
                                    <div className="flex-1 min-h-0 px-[var(--space)] pb-[var(--space)]"><Skel className="h-full w-full !rounded-[var(--r-16)]" /></div>
                                </div>
                                <div className={`${card} min-h-[var(--sz-180)] lg:col-span-5`}>
                                    {header(4)}
                                    <div className="flex-1 min-h-0 px-[var(--space)] pb-[var(--space)]"><Skel className="h-full w-full !rounded-[var(--r-16)]" /></div>
                                </div>
                            </section>
                            <section className="grid min-h-0 grid-cols-1 gap-[var(--space)] lg:grid-cols-12">
                                <div className={`${card} min-h-[var(--sz-160)] lg:col-span-5`}>
                                    {header(7)}
                                    <div className="flex-1 grid grid-cols-2 gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div key={i} className={`flex items-center gap-3 px-[var(--sp-14)] py-3 ${box}`}>
                                                <Skel className="h-9 w-9 shrink-0 !rounded-[var(--r-8)]" />
                                                <span className="text-[length:var(--fs-12)]"><SkelChars chars={4} /></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className={`${card} min-h-[var(--sz-200)] lg:col-span-4`}>
                                    {header(6)}
                                    <div className="flex-1 flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                                        <div className={`flex items-center gap-[var(--sp-10)] p-[var(--sp-10)] ${box}`}>
                                            <Skel className="h-[var(--sz-32)] w-[var(--sz-32)] shrink-0 !rounded-[var(--r-11)]" />
                                            <span className="flex flex-col">
                                                <span className="text-[length:var(--fs-12)] leading-[var(--lh-16)]"><SkelChars chars={3} /></span>
                                                <span className="text-[length:var(--fs-15)] leading-[var(--lh-20)]"><SkelChars chars={11} /></span>
                                            </span>
                                        </div>
                                        <div className="grid flex-1 grid-cols-2 gap-[var(--space)]">
                                            <div className={box} />
                                            <div className={box} />
                                        </div>
                                    </div>
                                </div>
                                <div className={`${card} min-h-[var(--sz-160)] lg:col-span-3`}>
                                    {header(4)}
                                    <div className="flex-1 flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                                        <div className={`flex-1 ${box}`} />
                                        <div className={`flex-1 ${box}`} />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

/** 照上次離開時量到的版面畫：面板用一樣的玻璃樣子，按鈕／圖示／每行字畫成灰塊 */
function SkelSnapshot({ items }: { items: SnapItem[] }) {
    return (
        <div className="absolute inset-0 overflow-hidden">
            {items.map((it, i) => {
                const style: CSSProperties = { position: 'absolute', left: it.x, top: it.y, width: it.w, height: it.h, borderRadius: it.r ?? 0 }
                if (it.k === 's') return it.p ? <div key={i} className="paper" style={style} /> : <div key={i} style={{ ...style, background: it.bg }} />
                return <span key={i} className="skel" style={style} />
            })}
        </div>
    )
}

/** 整頁骨架：依目前網址顯示那一頁的外形（在哪一頁重整就顯示哪一頁） */
export function SkelPage() {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/'
    const snap = loadLayoutSnapshot(path)
    const view = snap ? <SkelSnapshot items={snap} />
        : path.startsWith('/login') ? <SkelLogin />
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
