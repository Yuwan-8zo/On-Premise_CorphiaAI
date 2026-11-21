/**
 * 小 AI 導覽（新手導覽 v2）
 * ----------------------------------------------
 * 小 AI 是整個系統的嚮導：導覽由它帶。每一步它站在說明卡上面，眼睛看著要介紹的東西；
 * 卡片＝它說的話。開場、結尾開心地跳，講到資料安全時嚇一跳。
 *
 *   - 說明卡一律在畫面正中間不動（使用者要求），只有照亮的框在動；小 AI 的眼睛跟著框轉
 *   - 整頁變暗，要介紹的東西挖一個洞照亮（box-shadow 9999px）；框的圓角跟著目標：
 *     膠囊（一般／專案、新對話）就是膠囊，圓角＝目標圓角＋外擴的距離（同心）
 *   - 手機：側欄收在抽屜裡。介紹側欄裡的東西（inSidebar）時，導覽直接把側欄拉出來；
 *     換到側欄以外的步驟（或導覽結束）再收回去——只收導覽自己拉出來的，使用者原本就開著的不動
 *     拉不出來（例如側欄被別的狀態擋住）才退回框左上角「開啟側邊欄」按鈕（fallback），卡片多一行提示
 *   - 右上 ×／Esc／點背景＝略過；← → 換步驟
 *   - 結束（看完、略過都一樣）：卡片和變暗淡掉，小 AI 從卡片上飛到右下角，變成常駐的那一隻
 *     （MascotDock；導覽開著時它躲起來，導覽一關它就出現在小 AI 降落的位置）——小 AI 橫跨整個系統
 *
 * 誰會看到：每個帳號第一次進聊天頁（新註冊的帳號第一次登入）；設定 →「使用說明」→「重新觀看導覽」可以再看
 * 標記見 onboardingFlag.ts（每個帳號分開記）
 *
 * 對應的 data-tour 標記：
 *   mode-toggle      一般／專案 切換（側欄）
 *   new-chat         新對話／新資料夾（側欄）
 *   model            右上選模型
 *   chat-input       底部輸入區
 *   settings-button  左下使用者（設定）
 */

import { ChevronLeft, ChevronRight, X } from '@/components/snow/icons'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import Mascot, { type MascotLook, type MascotMood } from '@/components/mascot/Mascot'
import Tooltip from '@/components/ui/Tooltip'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

import { markOnboardingDone } from './onboardingFlag'
import './onboardingTour.css'

interface TourStep {
    /** i18n：onboarding.steps.<id>.title／desc */
    id: string
    /** 對應 data-tour；沒有＝卡片在正中間 */
    target?: string
    /** 沒有目標時小 AI 的表情（有目標時一律看著目標） */
    mood?: MascotMood
    /** 目標在側欄裡：手機側欄收著時，導覽自動把側欄拉出來，離開這一步再收回 */
    inSidebar?: boolean
    /** 目標還是看不到時改框這個，並在卡片加「先打開側欄」的提示 */
    fallback?: string
}

const STEPS: TourStep[] = [
    { id: 'welcome', mood: 'happy' },
    { id: 'modeToggle', target: 'mode-toggle', inSidebar: true, fallback: 'sidebar-toggle' },
    { id: 'newChat', target: 'new-chat', inSidebar: true, fallback: 'sidebar-toggle' },
    { id: 'model', target: 'model' },
    { id: 'chatInput', target: 'chat-input' },
    { id: 'settings', target: 'settings-button', inSidebar: true, fallback: 'sidebar-toggle' },
    { id: 'security', mood: 'alert' },
    { id: 'done', mood: 'happy' },
]

/** 版面數字（px）：框比目標多一圈、離螢幕邊、卡片寬 */
const PAD = 8
const EDGE = 16
const CARD_W = 380
/** 小 AI 站在卡片上緣正中間：大小、腳踩進卡片多少（設計稿 220 → 縮放 MASCOT / 220） */
const MASCOT = 88
const MASCOT_SINK = 12
const MASCOT_RISE = MASCOT - MASCOT_SINK

interface Rect {
    top: number
    left: number
    width: number
    height: number
    /** 目標的圓角（px） */
    radius: number
}

/** 目標的圓角：自己沒有圓角（例如外面包一層的容器）就看裡面第一層、第二層的元素；膠囊（9999）以半高為準 */
function radiusOf(el: Element, height: number): number {
    let node: Element | null = el
    for (let depth = 0; node && depth < 3; depth += 1) {
        const r = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
        if (r > 0) return Math.min(r, height / 2)
        node = node.firstElementChild
    }
    return 0
}

export interface OnboardingTourProps {
    isOpen: boolean
    onClose: () => void
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
    const { t } = useTranslation()
    const userId = useAuthStore((s) => s.user?.id)
    const [step, setStep] = useState(0)
    const [target, setTarget] = useState<Rect | null>(null)
    /** 這一步框的是「開啟側邊欄」（目標收在手機側欄裡） */
    const [viaFallback, setViaFallback] = useState(false)
    const setSidebarOpen = useUIStore((st) => st.setSidebarOpen)
    /** 側欄是導覽拉出來的（離開側欄的步驟、導覽結束時要收回） */
    const openedSidebar = useRef(false)
    const [cardSize, setCardSize] = useState({ w: CARD_W, h: 200 })
    const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
    const cardRef = useRef<HTMLDivElement>(null)
    const mascotRef = useRef<HTMLDivElement>(null)
    const [leaving, setLeaving] = useState(false)
    const nextRef = useRef<HTMLButtonElement>(null)

    const current = STEPS[step]
    const isFirst = step === 0
    const isLast = step === STEPS.length - 1

    /** 收回導覽自己拉出來的側欄 */
    const restoreSidebar = () => {
        if (!openedSidebar.current) return
        openedSidebar.current = false
        setSidebarOpen(false)
    }
    const finish = () => {
        setLeaving(false)
        restoreSidebar()
        onClose()
    }
    /** 結束：小 AI 飛到右下角常駐的位置，飛到了才關掉導覽 */
    const close = () => {
        if (leaving) return
        markOnboardingDone(userId)
        const from = mascotRef.current
        const dock = document.querySelector<HTMLElement>('.mascot-dock .mascot')
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        if (!from || !dock || reduce || typeof from.animate !== 'function') {
            finish()
            return
        }
        setLeaving(true)
        // 降落點：常駐小 AI 的中心、真正的大小（不是歪頭後的外框）、歪頭的角度，飛到了跟它完全疊在一起
        const a = from.getBoundingClientRect()
        const b = dock.getBoundingClientRect()
        const m = new DOMMatrix(getComputedStyle(dock).transform)
        const tilt = (Math.atan2(m.b, m.a) * 180) / Math.PI
        const cs = getComputedStyle(from)
        const fly = from.animate(
            [
                { transform: 'none' },
                {
                    transform: `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${dock.offsetWidth / from.offsetWidth}) rotate(${tilt}deg)`,
                },
            ],
            { duration: Number.parseFloat(cs.getPropertyValue('--tour-fly')) * 1000 || 700, easing: cs.getPropertyValue('--tour-fly-ease').trim() || 'ease', fill: 'forwards' },
        )
        fly.finished.then(finish, finish)
    }

    useEffect(() => {
        if (isOpen) setStep(0)
    }, [isOpen])

    // Esc 略過、← → 換步驟
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowRight') setStep((s) => Math.min(STEPS.length - 1, s + 1))
            else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // 手機：介紹側欄裡的東西時把側欄拉出來，換到別的步驟再收回
    // （用 layout effect、寫在量位置之前：同一次更新裡先決定要不要拉側欄，量位置時才知道正在拉、不會先閃「開啟側邊欄」）
    useLayoutEffect(() => {
        if (!isOpen) return
        if (current.inSidebar) {
            const r = document.querySelector(`[data-tour="${current.target}"]`)?.getBoundingClientRect()
            const visible = !!r && r.width > 0 && r.right > 0 && r.left < window.innerWidth
            if (!visible && !useUIStore.getState().sidebarOpen) {
                openedSidebar.current = true
                setSidebarOpen(true)
            }
        } else {
            restoreSidebar()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, step])

    // 換步驟時焦點放在「下一步」，鍵盤可以一路按 Enter
    useEffect(() => {
        if (isOpen) nextRef.current?.focus({ preventScroll: true })
    }, [isOpen, step])

    // 量目標位置（側欄收合動畫、視窗大小改變時跟著重量）
    useLayoutEffect(() => {
        if (!isOpen) return
        const measure = () => {
            setViewport({ w: window.innerWidth, h: window.innerHeight })
            const onScreen = (el: HTMLElement | null) => {
                const r = el?.getBoundingClientRect()
                return r && r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight ? r : null
            }
            const find = (name?: string) => (name ? document.querySelector<HTMLElement>(`[data-tour="${name}"]`) : null)
            let el = find(current.target)
            let r = onScreen(el)
            // 側欄是導覽剛拉出來的：還在滑（左邊還在螢幕外）就先不照亮，滑到定位才框，不退回「開啟側邊欄」
            const sliding = !!current.inSidebar && openedSidebar.current
            if (sliding && r && r.left < 0) r = null
            // 看不到（手機側欄收著）→ 改框「開啟側邊欄」按鈕；再看不到就只講話
            const useFallback = !r && !!current.fallback && !sliding
            if (useFallback) { el = find(current.fallback); r = onScreen(el) }
            setViaFallback(useFallback && !!r)
            setTarget(r && el ? { top: r.top, left: r.left, width: r.width, height: r.height, radius: radiusOf(el, r.height) } : null)
            if (cardRef.current) setCardSize({ w: cardRef.current.offsetWidth, h: cardRef.current.offsetHeight })
        }
        measure()
        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        const id = window.setInterval(measure, 250)
        return () => {
            window.removeEventListener('resize', measure)
            window.removeEventListener('scroll', measure, true)
            window.clearInterval(id)
        }
    }, [isOpen, step, current.target])

    if (!isOpen) return null

    // ── 卡片：一律在畫面正中間（上面留小 AI 的位置）──
    const { w: vw, h: vh } = viewport
    const width = Math.min(CARD_W, vw - EDGE * 2)
    const h = cardSize.h
    const left = (vw - width) / 2
    const top = Math.max(EDGE + MASCOT_RISE, (vh - h + MASCOT_RISE) / 2)

    // ── 小 AI：有框就看著框，沒有就照步驟的表情 ──
    const mascotX = left + width / 2
    const mascotY = top - MASCOT_RISE / 2
    let mood: MascotMood = current.mood ?? 'idle'
    let look: MascotLook | undefined
    if (target) {
        const dx = target.left + target.width / 2 - mascotX
        const dy = target.top + target.height / 2 - mascotY
        const d = Math.hypot(dx, dy) || 1
        mood = 'look'
        look = { x: dx / d, y: dy / d, lean: Math.max(-6, Math.min(6, dx / 60)) }
    }

    const cardStyle: CSSProperties = { left, top, width }

    return (
        <div
            className={`tour fixed inset-0 z-[var(--z-dialog-top)] select-none${leaving ? ' is-leaving' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-desc"
            onClick={(e) => {
                if (cardRef.current?.contains(e.target as Node)) return
                // 手機：框的是「開啟側邊欄」→ 點框裡面＝幫你打開側欄，導覽繼續（側欄裡的目標出現後框會自動移過去）
                // 不能讓這一下落到底下的按鈕：整頁蓋著導覽層，點不到；以前會被當成「略過」直接結束導覽
                if (viaFallback && target) {
                    const x = e.clientX, y = e.clientY
                    if (x >= target.left - PAD && x <= target.left + target.width + PAD && y >= target.top - PAD && y <= target.top + target.height + PAD) {
                        setSidebarOpen(true)
                        return
                    }
                }
                // 點卡片以外（變暗的背景）＝略過
                close()
            }}
        >
            {/* 變暗＋照亮目標 */}
            {target ? (
                <div
                    aria-hidden
                    className="tour-hole"
                    style={{
                        top: target.top - PAD,
                        left: target.left - PAD,
                        width: target.width + PAD * 2,
                        height: target.height + PAD * 2,
                        // 同心圓角：膠囊的目標，框也是膠囊
                        borderRadius: target.radius > 0 ? target.radius + PAD : undefined,
                    }}
                />
            ) : (
                <div aria-hidden className="tour-dim" />
            )}

            {/* 說明卡（小 AI 站在上面） */}
            <div ref={cardRef} style={cardStyle} className="tour-card paper paper-solid !rounded-[var(--r-25)]">
                <div
                    ref={mascotRef}
                    className="tour-mascot"
                    style={{ '--tour-m-size': `${MASCOT}px`, '--tour-ms': MASCOT / 220, '--tour-rise': `${MASCOT_RISE}px` } as CSSProperties}
                >
                    <Mascot mood={mood} look={look} label={t('auth.mascotName')} />
                </div>

                <Tooltip label={t('common.skip', '略過')} className="!absolute top-2.5 right-2.5 z-10">
                    <button type="button" onClick={close} className="tour-skip" aria-label={t('common.skip', '略過')}>
                        <X className="h-3.5 w-3.5" />
                    </button>
                </Tooltip>

                <div className="px-5 pt-5 pb-4">
                    <h2 id="tour-title" className="text-[length:var(--fs-17)] leading-[var(--lh-22)] font-semibold text-text-primary pr-6">
                        {t(`onboarding.steps.${current.id}.title`)}
                    </h2>
                    <p id="tour-desc" className="mt-[var(--sp-6)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary">
                        {t(`onboarding.steps.${current.id}.desc`)}
                    </p>
                    {viaFallback && (
                        <p className="mt-[var(--sp-6)] text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-muted">
                            {t('onboarding.openSidebarHint')}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between border-t border-[var(--paper-line)] px-4 py-2.5">
                    <div className="flex items-center gap-1" aria-label={t('onboarding.progress', { n: step + 1, total: STEPS.length })}>
                        {STEPS.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStep(i)}
                                aria-label={t('onboarding.goTo', { n: i + 1 })}
                                aria-current={i === step ? 'step' : undefined}
                                className={`tour-dot${i === step ? ' is-on' : ''}`}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {!isFirst && (
                            <button type="button" onClick={() => setStep((s) => s - 1)} className="tour-prev">
                                <ChevronLeft className="h-3 w-3" />
                                {t('common.prev', '上一步')}
                            </button>
                        )}
                        <button
                            ref={nextRef}
                            type="button"
                            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
                            className="flex items-center gap-0.5 btn btn-primary !h-8 !px-3.5 !text-[length:var(--fs-13)]"
                        >
                            {isLast ? t('onboarding.start') : t('common.next', '下一步')}
                            {!isLast && <ChevronRight className="h-3 w-3" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
