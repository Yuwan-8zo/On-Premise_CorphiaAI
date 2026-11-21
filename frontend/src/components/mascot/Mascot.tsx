/**
 * 小 AI（Corphia 的嚮導）：Liquid Glass 玻璃果凍
 *
 *   外觀規則（使用者定的）：沒有嘴巴、全部圓潤；表情只靠眼睛、眉毛、手、身體。
 *   身體顏色跟著後面的背景色走（backdropTint.ts）：換深淺色、換主題色、移到別的地方都會重算。
 *
 *   mood
 *     idle  待命：眼睛跟著游標、偶爾眨眼，點一下會被戳得壓扁
 *     look  看指定的方向（look 參數，例如打信箱時跟著字走）
 *     cover 不看（打密碼）：coverStyle＝'eyes' 閉上眼睛（預設）、'hands' 兩顆圓圓小手遮眼；
 *           peek＝偷看：右眼睜開（遮手的版本是右手滑開）
 *     think 思考：眼睛往上左右飄、身體晃
 *     happy 開心：笑瞇眼（^ ^）跳兩下
 *     sad   皺眉：圓頭短眉毛內側抬高、眼睛稍扁往下看、搖頭
 *     alert 嚇一跳：眼睛睜大、往上縮一下
 *
 *   尺寸、時間都寫在 mascot.css 的設定裡；要知道某個表情動畫多久，用 ref 的 moodDuration() 從樣式讀。
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import { backdropColor, tintFor } from './backdropTint'
import './mascot.css'

/** 換主題後背景波浪顏色有轉場，等它轉完再量背景色（毫秒） */
const RETINT_DELAY = 450

export type MascotMood = 'idle' | 'look' | 'cover' | 'think' | 'happy' | 'sad' | 'alert'

/** 看的方向：x、y 介於 -1～1（相對眼睛能移動的最大距離），lean＝身體傾斜角度 */
export interface MascotLook {
    x: number
    y: number
    lean?: number
}

export interface MascotHandle {
    el: HTMLButtonElement | null
    /** 重新量背景色、換身體顏色（移到別的位置之後呼叫） */
    retint: () => void
    /** 目前身體上正在跑的表情動畫總長（毫秒，從樣式讀；沒有動畫回傳 0） */
    moodDuration: () => number
}

interface MascotProps {
    mood?: MascotMood
    peek?: boolean
    look?: MascotLook
    /** 不看（cover）的方式：閉眼（預設）或雙手遮眼 */
    coverStyle?: 'eyes' | 'hands'
    /** 對話泡泡的文字；null 或空字串＝收起來 */
    say?: string | null
    /** 給螢幕閱讀器的名稱 */
    label: string
    /** 被戳了一下（待命時點它） */
    onPoke?: () => void
    className?: string
}

/** 眨眼間隔（毫秒）：最短 BLINK_MIN，再隨機加 0～BLINK_JITTER */
const BLINK_MIN = 2200
const BLINK_JITTER = 2800
/** 游標離小 AI 多遠時眼睛轉到底（px） */
const FOLLOW_REACH = 260
/** 游標在左右時身體最多傾斜幾度、每多少 px 傾斜 1 度 */
const LEAN_MAX = 4
const LEAN_PER_PX = 80

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 把 CSS 的時間字串（"0.62s, 1.4s"）換成毫秒陣列 */
const toMs = (v: string) => v.split(',').map((s) => (s.trim().endsWith('ms') ? Number.parseFloat(s) : Number.parseFloat(s) * 1000) || 0)

const Mascot = forwardRef<MascotHandle, MascotProps>(function Mascot(
    { mood = 'idle', peek = false, look, coverStyle = 'eyes', say, label, onPoke, className = '' },
    ref,
) {
    const rootRef = useRef<HTMLButtonElement>(null)
    const bobRef = useRef<HTMLDivElement>(null)

    // 身體顏色跟著背景：一出現、換深淺色／主題色（html 的 class、style 變了）、視窗大小變了都重量一次
    // （顏色直接寫樣式變數；「淺色背景」要放進 class，用 state，不然重畫時會被 React 蓋掉）
    const [onLight, setOnLight] = useState(false)
    const retint = () => {
        const el = rootRef.current
        if (!el) return
        const { tint, light } = tintFor(backdropColor(el))
        el.style.setProperty('--m-tint', tint)
        setOnLight(light)
    }
    useEffect(() => {
        let timer = 0
        const later = () => {
            clearTimeout(timer)
            timer = window.setTimeout(retint, RETINT_DELAY)
        }
        const raf = requestAnimationFrame(retint)
        later()
        const mo = new MutationObserver(later)
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-accent'] })
        window.addEventListener('resize', later)
        return () => {
            cancelAnimationFrame(raf)
            clearTimeout(timer)
            mo.disconnect()
            window.removeEventListener('resize', later)
        }
    }, [])
    const [blink, setBlink] = useState(false)
    const [poking, setPoking] = useState(false)
    // 泡泡收起時文字先留著，淡出時才不會一下子變空
    const [bubble, setBubble] = useState('')
    useEffect(() => {
        if (say) setBubble(say)
    }, [say])

    useImperativeHandle(ref, () => ({
        el: rootRef.current,
        retint,
        moodDuration: () => {
            const bob = bobRef.current
            if (!bob) return 0
            const cs = getComputedStyle(bob)
            if (!cs.animationName || cs.animationName === 'none') return 0
            const dur = toMs(cs.animationDuration)
            const delay = toMs(cs.animationDelay)
            const count = cs.animationIterationCount.split(',').map((c) => (c.trim() === 'infinite' ? 1 : Number.parseFloat(c) || 1))
            return Math.max(0, ...dur.map((d, i) => (delay[i] ?? 0) + d * (count[i] ?? 1)))
        },
    }), [])

    // 待命：眼睛跟著游標（直接寫樣式變數，不重畫元件）
    useEffect(() => {
        const el = rootRef.current
        if (!el || mood !== 'idle') return
        const set = (x: number, y: number, lean: number) => {
            el.style.setProperty('--ex', x.toFixed(3))
            el.style.setProperty('--ey', y.toFixed(3))
            el.style.setProperty('--lean', `${lean}deg`)
        }
        set(0, 0, 0)
        const onMove = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            const dx = e.clientX - (r.left + r.width / 2)
            const dy = e.clientY - (r.top + r.height * 0.4)
            const d = Math.hypot(dx, dy) || 1
            const k = Math.min(1, d / FOLLOW_REACH)
            set((dx / d) * k, (dy / d) * k, clamp(dx / LEAN_PER_PX, -LEAN_MAX, LEAN_MAX))
        }
        window.addEventListener('pointermove', onMove)
        return () => window.removeEventListener('pointermove', onMove)
    }, [mood])

    // 指定方向（look、sad 往下看等）
    useEffect(() => {
        const el = rootRef.current
        if (!el || mood === 'idle') return
        let l: MascotLook = { x: 0, y: 0 }
        if (mood === 'look' && look) l = look
        else if (mood === 'sad') l = { x: 0, y: 0.7 }
        else if (mood === 'cover') l = { x: 0, y: 0, lean: 2 }
        el.style.setProperty('--ex', l.x.toFixed(3))
        el.style.setProperty('--ey', l.y.toFixed(3))
        el.style.setProperty('--lean', `${l.lean ?? 0}deg`)
    }, [mood, look])

    // 眨眼：待命或看東西時隨機眨
    useEffect(() => {
        if (mood !== 'idle' && mood !== 'look') return
        let off = 0
        let timer = 0
        const loop = () => {
            timer = window.setTimeout(() => {
                setBlink(true)
                off = window.setTimeout(() => setBlink(false), 130)
                loop()
            }, BLINK_MIN + Math.random() * BLINK_JITTER)
        }
        loop()
        return () => {
            clearTimeout(timer)
            clearTimeout(off)
            setBlink(false)
        }
    }, [mood])

    const poke = () => {
        if (mood !== 'idle' && mood !== 'look') return
        setPoking(false)
        // 下一幀再加回去，連點也會重播
        requestAnimationFrame(() => setPoking(true))
        onPoke?.()
    }

    const classes = [
        'mascot',
        mood !== 'idle' && mood !== 'look' ? mood : '',
        mood === 'cover' && peek ? 'peek' : '',
        coverStyle === 'hands' ? 'cover-hands' : '',
        onLight ? 'on-light' : '',
        blink ? 'blink' : '',
        poking ? 'poke' : '',
        className,
    ].filter(Boolean).join(' ')

    return (
        // 可以戳它：真的按鈕，滑鼠點、鍵盤 Tab 到它按 Enter／空白鍵都行
        <button
            type="button"
            ref={rootRef}
            className={classes}
            aria-label={label}
            onClick={poke}
            onAnimationEnd={(e) => {
                if (e.animationName === 'mascot-poke') setPoking(false)
            }}
            style={{ '--ex': 0, '--ey': 0, '--lean': '0deg' } as CSSProperties}
        >
            <div className="m-shadow" />
            <div className="m-body-wrap">
                <div ref={bobRef} className="m-bob">
                    <div className="m-body"><div className="m-shine" /></div>
                    <div className="m-eyes">
                        <svg className="m-brow l" viewBox="0 0 28 10" aria-hidden><path d="M3 3 Q14 9 25 3" /></svg>
                        <svg className="m-brow r" viewBox="0 0 28 10" aria-hidden><path d="M3 3 Q14 9 25 3" /></svg>
                        <span className="m-eye l"><svg className="m-arc" viewBox="0 0 24 16" aria-hidden><path d="M3.5 12.5 Q12 1 20.5 12.5" /></svg></span>
                        <span className="m-eye r"><svg className="m-arc" viewBox="0 0 24 16" aria-hidden><path d="M3.5 12.5 Q12 1 20.5 12.5" /></svg></span>
                    </div>
                    <span className="m-hand l" />
                    <span className="m-hand r" />
                </div>
            </div>
            <div className={`m-say${say ? ' on' : ''}`} aria-live="polite">{bubble}</div>
        </button>
    )
})

export default Mascot
