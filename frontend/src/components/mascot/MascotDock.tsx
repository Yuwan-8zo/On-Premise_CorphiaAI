/**
 * 常駐小 AI（登入後每一頁的右下角）
 *   小 AI 是整個系統的嚮導：平常從畫面右邊探出半個頭、眼睛看著畫面，不擋內容；
 *   系統有通知（toastStore）時滑出來，用對話卡片說出內容，表情跟著通知種類：
 *     success 開心跳、error 皺眉、info 一般說話
 *   點它：滑出來打招呼；再點一下會被戳。導覽進行中先躲起來（導覽有自己的小 AI，見 mascotDock.css）
 *   字多停久一點（SAY_MIN_MS ＋ 每個字 SAY_PER_CHAR_MS，最多 SAY_MAX_MS），讓人讀得完
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Mascot, { type MascotMood } from './Mascot'
import { useToastStore, type ToastType } from '@/store/toastStore'
import { fitTextWidth } from '@/lib/fitTextWidth'
import './mascotDock.css'

const SAY_MIN_MS = 2600
const SAY_PER_CHAR_MS = 90
const SAY_MAX_MS = 7000
/** 說完後多久縮回去探頭 */
const TUCK_DELAY_MS = 400

const MOOD: Record<ToastType, MascotMood> = { success: 'happy', error: 'sad', info: 'idle' }

interface Speech {
    id: string
    text: string
    tone: ToastType | 'hello'
    /** 通知上的按鈕（例如「復原」） */
    action?: { label: string; onClick: () => void }
    /** 有按鈕的通知自己決定顯示多久（要讓使用者來得及按） */
    ms?: number
}

const sayFor = (text: string) => Math.min(SAY_MAX_MS, SAY_MIN_MS + text.length * SAY_PER_CHAR_MS)

export default function MascotDock() {
    const { t } = useTranslation()
    const toasts = useToastStore((s) => s.toasts)
    const [speech, setSpeech] = useState<Speech | null>(null)
    const [out, setOut] = useState(false)
    const seen = useRef<string | null>(null)
    const hideTimer = useRef(0)
    const tuckTimer = useRef(0)
    const noteRef = useRef<HTMLDivElement>(null)

    // 字換行後卡片縮到剛好包住字（兩行長度由 CSS text-wrap: balance 排平均），右邊不留空白
    useLayoutEffect(() => {
        fitTextWidth(noteRef.current)
    }, [speech?.text])

    const speak = (next: Speech) => {
        clearTimeout(hideTimer.current)
        clearTimeout(tuckTimer.current)
        setSpeech(next)
        setOut(true)
        hideTimer.current = window.setTimeout(() => {
            setSpeech(null)
            tuckTimer.current = window.setTimeout(() => setOut(false), TUCK_DELAY_MS)
        }, next.ms ?? sayFor(next.text))
    }

    // 新通知 → 小 AI 說
    useEffect(() => {
        const latest = toasts.find((x) => !x.leaving)
        if (!latest || latest.id === seen.current) return
        seen.current = latest.id
        speak({ id: latest.id, text: latest.message, tone: latest.type, action: latest.action, ms: latest.durationMs })
    }, [toasts])

    useEffect(() => () => {
        clearTimeout(hideTimer.current)
        clearTimeout(tuckTimer.current)
    }, [])

    const mood: MascotMood = speech && speech.tone !== 'hello' ? MOOD[speech.tone] : 'idle'

    return (
        <aside className={`mascot-dock${out ? ' is-out' : ''}`} aria-label={t('auth.mascotName')}>
            <div
                ref={noteRef}
                className={`mascot-dock-note paper paper-solid${speech ? ' is-on' : ''}${speech?.tone === 'error' ? ' is-error' : ''}`}
                role="status"
                aria-live="polite"
            >
                {speech?.text}
                {speech?.action && (
                    <button
                        type="button"
                        className="mascot-dock-action"
                        onClick={() => {
                            speech.action?.onClick()
                            clearTimeout(hideTimer.current)
                            setSpeech(null)
                            tuckTimer.current = window.setTimeout(() => setOut(false), TUCK_DELAY_MS)
                        }}
                    >
                        {speech.action.label}
                    </button>
                )}
            </div>
            <Mascot
                mood={mood}
                label={t('auth.mascotName')}
                onPoke={() => {
                    // 探頭時點它：滑出來打招呼（出來之後再點就是被戳）
                    if (!out) speak({ id: `hello-${Date.now()}`, text: t('auth.mascotDockHello'), tone: 'hello' })
                }}
            />
        </aside>
    )
}
