/**
 * 小 AI 導覽（新手導覽 v2）
 * ----------------------------------------------
 * 小 AI 是整個系統的嚮導：導覽由它帶。每一步它站在說明卡上面，眼睛看著要介紹的東西；
 * 卡片＝它說的話。開場、結尾開心地跳，講到資料安全時嚇一跳。
 *
 *   - 整頁變暗，要介紹的東西挖一個洞照亮（box-shadow 9999px）；卡片的小箭頭指著它
 *   - 下一步時洞、卡片、小 AI 一起滑過去（left／top 過場）
 *   - 沒有目標的步驟（開場、資料安全、結尾）：卡片在畫面正中間
 *   - 手機：目標不在畫面上（例如收在抽屜裡的側欄）就改成正中間講
 *   - 右上 ×／Esc／點背景＝略過；← → 換步驟
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

import { markOnboardingDone } from './onboardingFlag'
import './onboardingTour.css'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TourStep {
    /** i18n：onboarding.steps.<id>.title／desc */
    id: string
    /** 對應 data-tour；沒有＝卡片在正中間 */
    target?: string
    placement?: Placement
    /** 沒有目標時小 AI 的表情（有目標時一律看著目標） */
    mood?: MascotMood
}

const STEPS: TourStep[] = [
    { id: 'welcome', mood: 'happy' },
    { id: 'modeToggle', target: 'mode-toggle', placement: 'right' },
    { id: 'newChat', target: 'new-chat', placement: 'right' },
    { id: 'model', target: 'model', placement: 'bottom' },
    { id: 'chatInput', target: 'chat-input', placement: 'top' },
    { id: 'settings', target: 'settings-button', placement: 'right' },
    { id: 'security', mood: 'alert' },
    { id: 'done', mood: 'happy' },
]

/** 版面數字（px）：洞比目標多一圈、卡片離目標、離螢幕邊、卡片寬、小 AI 站在卡片上方露出多少 */
const PAD = 8
const GAP = 18
const EDGE = 16
const CARD_W = 340
const CARD_W_CENTER = 380
/** 小 AI 站在卡片上面：大小、離卡片左右邊多遠、腳踩進卡片多少（設計稿 220 → 縮放 MASCOT / 220） */
const MASCOT = 88
const MASCOT_INSET = 18
const MASCOT_SINK = 12
const MASCOT_RISE = MASCOT - MASCOT_SINK
/** 手機寬度以下：側欄收在抽屜裡 */
const MOBILE = 640

interface Rect {
    top: number
    left: number
    width: number
    height: number
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
    const [cardSize, setCardSize] = useState({ w: CARD_W, h: 200 })
    const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
    const cardRef = useRef<HTMLDivElement>(null)
    const nextRef = useRef<HTMLButtonElement>(null)

    const current = STEPS[step]
    const isFirst = step === 0
    const isLast = step === STEPS.length - 1

    const close = () => {
        markOnboardingDone(userId)
        onClose()
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

    // 換步驟時焦點放在「下一步」，鍵盤可以一路按 Enter
    useEffect(() => {
        if (isOpen) nextRef.current?.focus({ preventScroll: true })
    }, [isOpen, step])

    // 量目標位置（側欄收合動畫、視窗大小改變時跟著重量）
    useLayoutEffect(() => {
        if (!isOpen) return
        const measure = () => {
            setViewport({ w: window.innerWidth, h: window.innerHeight })
            const el = current.target ? document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`) : null
            const r = el?.getBoundingClientRect()
            // 手機上不在畫面裡（收在抽屜）的目標：不照亮，改成正中間講
            const visible = r && r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight
            setTarget(visible ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
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

    // ── 卡片位置（一律用數字的 left／top，換步驟時才能平滑滑過去）──
    const { w: vw, h: vh } = viewport
    const mobile = vw < MOBILE
    const width = Math.min(target ? CARD_W : CARD_W_CENTER, vw - EDGE * 2)
    const h = cardSize.h
    // 卡片上面要留小 AI 的位置
    const minTop = EDGE + MASCOT_RISE
    const clampLeft = (x: number) => Math.max(EDGE, Math.min(x, vw - EDGE - width))
    const clampTop = (y: number) => Math.max(minTop, Math.min(y, vh - EDGE - h))
    let left = (vw - width) / 2
    let top = clampTop((vh - h) / 2 + MASCOT_RISE / 2)
    let arrow: { side: Placement; offset: number } | null = null
    // 小 AI 站在卡片哪一邊：靠近目標的那邊
    let mascotSide: 'start' | 'end' = 'start'
    if (target) {
        const cx = target.left + target.width / 2
        const cy = target.top + target.height / 2
        const placement = mobile && (current.placement === 'right' || current.placement === 'left') ? 'bottom' : (current.placement ?? 'bottom')
        if (placement === 'right') {
            left = clampLeft(target.left + target.width + PAD + GAP)
            top = clampTop(cy - h / 2)
            arrow = { side: 'left', offset: Math.max(18, Math.min(cy - top, h - 18)) }
        } else if (placement === 'left') {
            left = clampLeft(target.left - PAD - GAP - width)
            top = clampTop(cy - h / 2)
            arrow = { side: 'right', offset: Math.max(18, Math.min(cy - top, h - 18)) }
            mascotSide = 'end'
        } else if (placement === 'top') {
            left = clampLeft(cx - width / 2)
            top = clampTop(target.top - PAD - GAP - h)
            arrow = { side: 'bottom', offset: Math.max(18, Math.min(cx - left, width - 18)) }
            mascotSide = cx > left + width / 2 ? 'end' : 'start'
        } else {
            left = clampLeft(cx - width / 2)
            top = clampTop(target.top + target.height + PAD + GAP + MASCOT_RISE)
            arrow = { side: 'top', offset: Math.max(18, Math.min(cx - left, width - 18)) }
            mascotSide = cx > left + width / 2 ? 'end' : 'start'
        }
        // 箭頭在上面時小 AI 不能站在箭頭上：站另一邊
        if (arrow.side === 'top') mascotSide = arrow.offset < width / 2 ? 'end' : 'start'
    }

    // ── 小 AI：有目標就看著目標，沒有就照步驟的表情 ──
    const mascotX = mascotSide === 'start' ? left + MASCOT_INSET + MASCOT / 2 : left + width - MASCOT_INSET - MASCOT / 2
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
            className="tour fixed inset-0 z-[200] select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-desc"
            onClick={(e) => {
                // 點卡片以外（變暗的背景）＝略過
                if (cardRef.current && !cardRef.current.contains(e.target as Node)) close()
            }}
        >
            {/* 變暗＋照亮目標 */}
            {target ? (
                <div
                    aria-hidden
                    className="tour-hole"
                    style={{ top: target.top - PAD, left: target.left - PAD, width: target.width + PAD * 2, height: target.height + PAD * 2 }}
                />
            ) : (
                <div aria-hidden className="tour-dim" />
            )}

            {/* 說明卡（小 AI 站在上面） */}
            <div ref={cardRef} style={cardStyle} className="tour-card paper paper-solid !rounded-[var(--r-25)]">
                <div
                    className={`tour-mascot is-${mascotSide}`}
                    style={{ '--tour-m-size': `${MASCOT}px`, '--tour-ms': MASCOT / 220, '--tour-inset': `${MASCOT_INSET}px`, '--tour-rise': `${MASCOT_RISE}px` } as CSSProperties}
                >
                    <Mascot mood={mood} look={look} label={t('auth.mascotName')} />
                </div>

                {arrow && (
                    <span
                        aria-hidden
                        className={`tour-arrow is-${arrow.side}`}
                        style={arrow.side === 'top' || arrow.side === 'bottom' ? { left: arrow.offset } : { top: arrow.offset }}
                    />
                )}

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
