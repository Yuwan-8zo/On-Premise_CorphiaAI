/**
 * OnboardingTour — 引導式 spotlight tooltip 巡禮
 * ----------------------------------------------
 * v2 改成「spotlight + tooltip」設計：
 *   - 用 box-shadow 0 0 0 9999px 把整個視窗罩黑，再開一個與目標元素同大小的洞
 *   - 洞旁邊浮出 tooltip 卡，箭頭指向目標
 *   - 切下一步時，洞與 tooltip 平滑滑到下一個 data-tour 元素位置
 *
 * UX：
 *   - 右上角 × / ESC / 點背景 → 略過（旗標寫入）
 *   - 上一步 / 下一步 / 完成
 *   - dots 顯示進度，可點 dot 跳轉
 *   - Welcome / Done 是 centered 卡（沒有 spotlight 目標）
 *
 * 旗標：localStorage['corphia.onboarding.v1.done'] === '1'
 *   - skip / finish 都寫旗標
 *   - 設定 → 「重新觀看引導」會清旗標再開
 *
 * 對應的 data-tour 標記（在 ChatPage 子元件裡）：
 *   - mode-toggle      一般 / 專案 切換膠囊
 *   - new-chat         新對話 / 新資料夾按鈕
 *   - chat-input       底部訊息輸入區
 *   - settings-button  左下使用者頭像（前往設定）
 */

import {
    Check,
    ChevronLeft,
    ChevronRight,
    FileText,
    MessageSquare,
    Settings as SettingsIcon,
    Sparkles,
    X,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const ONBOARDING_FLAG_KEY = 'corphia.onboarding.v1.done'

export function isOnboardingDone(): boolean {
    try {
        return localStorage.getItem(ONBOARDING_FLAG_KEY) === '1'
    } catch {
        return true
    }
}

export function markOnboardingDone() {
    try {
        localStorage.setItem(ONBOARDING_FLAG_KEY, '1')
    } catch {
        /* noop */
    }
}

export function resetOnboarding() {
    try {
        localStorage.removeItem(ONBOARDING_FLAG_KEY)
    } catch {
        /* noop */
    }
}

interface TourStep {
    /** 對應 data-tour 屬性；undefined = 中央卡片（沒有 spotlight） */
    target?: string
    /** Tooltip 顯示位置；對 spotlight step 才有意義 */
    placement?: 'top' | 'bottom' | 'left' | 'right'
    icon: ComponentType<{ className?: string }>
    titleKey: string
    titleFallback: string
    descKey: string
    descFallback: string
}

const STEPS: TourStep[] = [
    {
        icon: Sparkles,
        titleKey: 'onboarding.welcome.title',
        titleFallback: '歡迎使用 Corphia AI',
        descKey: 'onboarding.welcome.desc',
        descFallback: '私有部署的企業知識引擎。所有對話、文件與向量索引都留在本機。我會帶你看主畫面 4 個主要功能。',
    },
    {
        target: 'mode-toggle',
        placement: 'right',
        icon: MessageSquare,
        titleKey: 'onboarding.tour.modeToggle.title',
        titleFallback: '一般 vs 專案',
        descKey: 'onboarding.tour.modeToggle.desc',
        descFallback: '在這裡切換對話模式：一般是純聊天；專案會把資料夾內的文件當作 RAG 上下文。',
    },
    {
        target: 'new-chat',
        placement: 'right',
        icon: Sparkles,
        titleKey: 'onboarding.tour.newChat.title',
        titleFallback: '開新對話',
        descKey: 'onboarding.tour.newChat.desc',
        descFallback: '一般模式按這裡新增對話；專案模式則會建立新資料夾。',
    },
    {
        target: 'chat-input',
        placement: 'top',
        icon: FileText,
        titleKey: 'onboarding.tour.chatInput.title',
        titleFallback: '輸入訊息',
        descKey: 'onboarding.tour.chatInput.desc',
        descFallback: '輸入問題或拖放檔案進來，AI 會逐字串流回應；左側「提示詞範本」按鈕可選範本，右側「麥克風」可錄音。',
    },
    {
        target: 'settings-button',
        placement: 'right',
        icon: SettingsIcon,
        titleKey: 'onboarding.tour.settings.title',
        titleFallback: '設定 / 管理後台',
        descKey: 'onboarding.tour.settings.desc',
        descFallback: '點頭像進設定：主題、語言、強調色都在這裡。管理員還能進入管理後台。',
    },
    {
        icon: Check,
        titleKey: 'onboarding.done.title',
        titleFallback: '準備好了',
        descKey: 'onboarding.done.desc',
        descFallback: '可以開始第一場對話。如果想再看一次，到「設定 → 使用說明」中點「重新觀看引導」。',
    },
]

export interface OnboardingTourProps {
    isOpen: boolean
    onClose: () => void
}

interface TargetRect {
    top: number
    left: number
    width: number
    height: number
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
    const { t } = useTranslation()
    const [step, setStep] = useState(0)
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
    const tooltipRef = useRef<HTMLDivElement>(null)

    // 是否 mobile —— spotlight 在 mobile 上無意義（sidebar 元素預設折疊在 drawer 裡，
    // 點亮位置會落在 viewport 外）。所以 mobile 退回 centered modal 模式。
    const [isMobile, setIsMobile] = useState<boolean>(() =>
        typeof window !== 'undefined' && window.innerWidth < 640,
    )
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 640)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const current = STEPS[step]
    const isFirst = step === 0
    const isLast = step === STEPS.length - 1
    const Icon = current.icon

    // ESC / arrow keys
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
            else if (e.key === 'ArrowRight') setStep((s) => Math.min(STEPS.length - 1, s + 1))
            else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    useEffect(() => {
        if (isOpen) setStep(0)
    }, [isOpen])

    // 量目標元素位置 + 監聽 resize/scroll 重算
    useLayoutEffect(() => {
        if (!isOpen) return

        function measure() {
            // mobile 不做 spotlight —— 一律 centered modal
            if (isMobile || !current.target) {
                setTargetRect(null)
                return
            }
            const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`)
            if (!el) {
                setTargetRect(null)
                return
            }
            const r = el.getBoundingClientRect()
            setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }

        measure()
        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        const id = window.setInterval(measure, 250) // 兜底：side bar 折疊動畫過程中位置會變
        return () => {
            window.removeEventListener('resize', measure)
            window.removeEventListener('scroll', measure, true)
            window.clearInterval(id)
        }
    }, [isOpen, step, current.target, isMobile])

    if (!isOpen) return null

    function handleClose() {
        markOnboardingDone()
        onClose()
    }

    function handleNext() {
        if (isLast) handleClose()
        else setStep((s) => s + 1)
    }

    function handlePrev() {
        if (!isFirst) setStep((s) => s - 1)
    }

    // 計算 tooltip 位置 ——————————————————————————————————————
    // spotlight step: 視 placement 排在目標旁；centered step: 螢幕中央
    const PADDING = 8 // spotlight 比目標多漏一圈，視覺上有呼吸感
    const TOOLTIP_GAP = 16 // tooltip 與目標距離
    const TOOLTIP_W = 340

    let tooltipStyle: React.CSSProperties = {}
    let arrowSide: 'top' | 'bottom' | 'left' | 'right' | null = null
    // arrow 在 tooltip 內的偏移（垂直 left/right placement 時是 top；水平 top/bottom 是 left）
    let arrowOffset: number | null = null

    if (targetRect) {
        const placement = current.placement ?? 'bottom'
        const cx = targetRect.left + targetRect.width / 2
        const cy = targetRect.top + targetRect.height / 2
        const vw = window.innerWidth
        const vh = window.innerHeight

        // Tooltip 量測（首次 render 拿不到 ref → 用保守估值；下個 frame 會 re-render 補正）
        const tooltipH = tooltipRef.current?.offsetHeight ?? 200
        const tooltipW = tooltipRef.current?.offsetWidth ?? TOOLTIP_W

        // Tooltip 在視窗內的位置（top-left）。用 absolute 而非 transform，方便 arrow 對齊
        if (placement === 'right') {
            const left = targetRect.left + targetRect.width + PADDING + TOOLTIP_GAP
            const top = Math.max(16, Math.min(cy - tooltipH / 2, vh - 16 - tooltipH))
            tooltipStyle = { left, top, width: TOOLTIP_W }
            arrowSide = 'left'
            // arrow 對齊目標中央（在 tooltip 內的 y），clamp 不超出 tooltip 邊
            arrowOffset = Math.max(14, Math.min(cy - top, tooltipH - 14))
        } else if (placement === 'left') {
            const right = vw - (targetRect.left - PADDING - TOOLTIP_GAP)
            const left = vw - right - tooltipW
            const top = Math.max(16, Math.min(cy - tooltipH / 2, vh - 16 - tooltipH))
            tooltipStyle = { left, top, width: TOOLTIP_W }
            arrowSide = 'right'
            arrowOffset = Math.max(14, Math.min(cy - top, tooltipH - 14))
        } else if (placement === 'top') {
            const top = targetRect.top - PADDING - TOOLTIP_GAP - tooltipH
            const left = Math.max(16, Math.min(cx - tooltipW / 2, vw - 16 - tooltipW))
            tooltipStyle = { left, top: Math.max(16, top), width: TOOLTIP_W }
            arrowSide = 'bottom'
            arrowOffset = Math.max(14, Math.min(cx - left, tooltipW - 14))
        } else {
            const top = targetRect.top + targetRect.height + PADDING + TOOLTIP_GAP
            const left = Math.max(16, Math.min(cx - tooltipW / 2, vw - 16 - tooltipW))
            tooltipStyle = { left, top, width: TOOLTIP_W }
            arrowSide = 'top'
            arrowOffset = Math.max(14, Math.min(cx - left, tooltipW - 14))
        }
    } else {
        // centered card（welcome / done）
        tooltipStyle = {
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: TOOLTIP_W + 60,
        }
    }

    return (
        <div
            className="fixed inset-0 z-[200] select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            onClick={(e) => {
                // 點 backdrop（不是 tooltip 本身）→ 略過
                if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
                    handleClose()
                }
            }}
        >
            {/* Spotlight 層：用 box-shadow 罩黑全螢幕，目標位置開洞 */}
            {targetRect ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute rounded-cv-md transition-all duration-300 ease-out"
                    style={{
                        top: targetRect.top - PADDING,
                        left: targetRect.left - PADDING,
                        width: targetRect.width + PADDING * 2,
                        height: targetRect.height + PADDING * 2,
                        boxShadow:
                            '0 0 0 9999px rgba(0,0,0,0.62), 0 0 0 2px rgb(var(--accent) / 0.6), 0 0 24px 4px rgb(var(--accent) / 0.35)',
                    }}
                />
            ) : (
                <div aria-hidden className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
            )}

            {/* Tooltip 卡片 */}
            <div
                ref={tooltipRef}
                onClick={(e) => e.stopPropagation()}
                style={tooltipStyle}
                className="absolute rounded-cv-md border border-border-subtle bg-bg-base shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out"
            >
                {/* 箭頭 —— offset 動態跟著目標走，被 clamp 過的 tooltip 也能正確指回去 */}
                {arrowSide && arrowOffset !== null && (
                    <span
                        aria-hidden
                        className={`absolute h-3 w-3 rotate-45 border bg-bg-base border-border-subtle ${
                            arrowSide === 'top'
                                ? '-top-[7px] border-r-0 border-b-0'
                                : arrowSide === 'bottom'
                                    ? '-bottom-[7px] border-l-0 border-t-0'
                                    : arrowSide === 'left'
                                        ? '-left-[7px] border-t-0 border-r-0'
                                        : '-right-[7px] border-b-0 border-l-0'
                        }`}
                        style={
                            arrowSide === 'top' || arrowSide === 'bottom'
                                ? { left: arrowOffset, transform: 'translateX(-50%) rotate(45deg)' }
                                : { top: arrowOffset, transform: 'translateY(-50%) rotate(45deg)' }
                        }
                    />
                )}

                {/* × 略過 */}
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:bg-white/[0.06] dark:hover:bg-white/[0.06] hover:text-text-primary transition"
                    aria-label={t('common.skip', '略過')}
                    title={t('common.skip', '略過')}
                >
                    <X className="h-3.5 w-3.5" />
                </button>

                {/* 內容 */}
                <div className="px-5 pt-5 pb-4">
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                            <Icon className="h-4 w-4" />
                        </span>
                        <h2
                            id="onboarding-title"
                            className="text-[16px] font-semibold text-text-primary tracking-tight"
                        >
                            {t(current.titleKey, current.titleFallback)}
                        </h2>
                    </div>
                    <p className="text-[13px] leading-relaxed text-text-secondary">
                        {t(current.descKey, current.descFallback)}
                    </p>
                </div>

                {/* footer：dots + nav */}
                <div className="flex items-center justify-between border-t border-border-subtle bg-bg-surface/40 px-4 py-2.5">
                    <div className="flex items-center gap-1">
                        {STEPS.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setStep(i)}
                                aria-label={`Step ${i + 1}`}
                                className={`h-1 rounded-full transition-all ${
                                    i === step
                                        ? 'w-4 bg-accent'
                                        : 'w-1 bg-text-muted/40 hover:bg-text-muted/60'
                                }`}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {!isFirst && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[12px] text-text-secondary hover:bg-bg-base hover:text-text-primary transition"
                            >
                                <ChevronLeft className="h-3 w-3" />
                                {t('common.prev', '上一步')}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleNext}
                            className="flex items-center gap-0.5 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-text-on-accent shadow-sm shadow-accent/30 hover:opacity-90 transition"
                        >
                            {isLast
                                ? t('onboarding.start', '開始使用')
                                : t('common.next', '下一步')}
                            {!isLast && <ChevronRight className="h-3 w-3" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
