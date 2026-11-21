/**
 * 登入頁的小 AI：表情、看哪裡、對話泡泡（從 LoginPage 拆出來）
 *   打信箱眼睛跟著字走（D1）、打密碼閉眼（按顯示密碼偷看）、送出時思考、成功開心跳、失敗皺眉
 *   錯誤原因不在這裡講：LoginPage 把欄位錯誤直接當泡泡文字（一直顯示到改好）
 */
import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { MascotHandle, MascotLook, MascotMood } from '@/components/mascot/Mascot'

/** 對話泡泡停多久（毫秒） */
export const SAY_MS = { hello: 1800, noPeek: 1500, peek: 1100, tickle: 1100, result: 1800 }
/** 皺眉多久後回到待命 */
const SAD_MS = 1500
/** 寬畫面（lg）小 AI 在卡片左邊；窄畫面在上面 */
const SIDE_BY_SIDE = '(min-width: 1024px)'

/** 打信箱時：游標在字裡的位置（0～1）→ 小 AI 看哪裡（D1：眼睛跟著字走，看向卡片） */
function lookAtCaret(input: HTMLInputElement, measure: CanvasRenderingContext2D | null): MascotLook {
    const cs = getComputedStyle(input)
    let caret = input.value.length
    try {
        // type="email" 拿不到游標位置（會丟錯或回傳 null）→ 當作在最後面
        caret = input.selectionStart ?? caret
    } catch {
        /* 沿用最後面 */
    }
    let w = caret * Number.parseFloat(cs.fontSize) * 0.55
    if (measure) {
        measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        w = measure.measureText(input.value.slice(0, caret)).width
    }
    const inner = input.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight)
    const p = Math.min(1, w / Math.max(1, inner))
    const side = window.matchMedia?.(SIDE_BY_SIDE).matches ?? true
    // 左右排：卡片在右邊，眼睛往右下看、越打越往右；上下排：卡片在下面，眼睛往下、從左看到右
    return side ? { x: 0.25 + p * 0.75, y: 0.35 + p * 0.25, lean: 2 + p * 3 } : { x: -0.7 + p * 1.4, y: 0.95, lean: 0 }
}

/** 等兩幀（新的表情樣式套上去）再讀動畫長度 */
const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function useLoginMascot() {
    const { t } = useTranslation()
    const ref = useRef<MascotHandle>(null)
    const [mood, setMood] = useState<MascotMood>('idle')
    const [look, setLook] = useState<MascotLook>({ x: 0, y: 0 })
    const [say, setSay] = useState<string | null>(null)
    const [revealed, setRevealed] = useState<Record<string, boolean>>({})
    const [pwField, setPwField] = useState<string | null>(null)
    const sayTimer = useRef(0)
    const sadTimer = useRef(0)
    const measure = useRef<CanvasRenderingContext2D | null>(null)

    useEffect(() => () => {
        clearTimeout(sayTimer.current)
        clearTimeout(sadTimer.current)
    }, [])

    const speak = (text: string, ms: number) => {
        setSay(text)
        clearTimeout(sayTimer.current)
        sayTimer.current = window.setTimeout(() => setSay(null), ms)
    }
    const hush = () => {
        clearTimeout(sayTimer.current)
        setSay(null)
    }

    /** 送出結果：失敗皺眉（錯誤原因由欄位錯誤顯示）；成功開心跳，跳完才 resolve（登入才換頁） */
    const react = async (ok: boolean, registering: boolean) => {
        clearTimeout(sadTimer.current)
        if (!ok) {
            setMood('sad')
            hush()
            sadTimer.current = window.setTimeout(() => setMood('idle'), SAD_MS)
            return
        }
        setMood('happy')
        speak(t(registering ? 'auth.mascotRegistered' : 'auth.mascotWelcome'), SAY_MS.result)
        // 開心跳完（時間從樣式讀）
        await nextPaint()
        await wait(ref.current?.moodDuration() ?? 0)
        if (registering) setMood('idle')
    }

    // ── 輸入框 → 表情 ──
    const onEmailFocus = (e: SyntheticEvent<HTMLInputElement>) => {
        measure.current ??= document.createElement('canvas').getContext('2d')
        setMood('look')
        setLook(lookAtCaret(e.currentTarget, measure.current))
    }
    const onEmailMove = (e: SyntheticEvent<HTMLInputElement>) => {
        if (mood === 'look') setLook(lookAtCaret(e.currentTarget, measure.current))
    }
    const onPasswordFocus = (id: string) => {
        setPwField(id)
        setMood('cover')
        if (!revealed[id]) speak(t('auth.mascotNoPeek'), SAY_MS.noPeek)
    }
    const onFieldBlur = () => {
        setPwField(null)
        setMood((m) => (m === 'look' || m === 'cover' ? 'idle' : m))
    }
    const onReveal = (id: string) => (visible: boolean) => {
        setRevealed((r) => ({ ...r, [id]: visible }))
        if (visible) speak(t('auth.mascotPeek'), SAY_MS.peek)
    }

    return {
        ref,
        mood,
        setMood,
        look,
        say,
        speak,
        react,
        /** 正在打的密碼欄有沒有按「顯示密碼」 */
        peek: !!(pwField && revealed[pwField]),
        onEmailFocus,
        onEmailMove,
        onPasswordFocus,
        onFieldBlur,
        onReveal,
    }
}
