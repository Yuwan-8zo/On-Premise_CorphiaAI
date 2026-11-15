import React, {
    Children,
    Fragment,
    createContext,
    createElement,
    forwardRef,
    isValidElement,
    useContext,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { gsap } from '@/lib/gsap'
import { MOTION } from '@/design-system'
import { prefersReducedMotion, stripForReducedMotion } from '@/lib/reducedMotion'

/*
 * 高級感切換（全站自動套用）：
 *   進場：淡入的元件同時由模糊 8px 對焦到清楚
 *   離場：AnimatePresence 留住被拿掉的元件，0.2 秒淡出＋失焦 6px（規範：淡出／小過場 0.2 秒、減速曲線）
 */
const ENTER_BLUR = 8
const EXIT_BLUR = 6
const EXIT_SECONDS = 0.2

const PresenceContext = createContext<{ exiting: boolean; skipInitial: boolean }>({ exiting: false, skipInitial: false })

type GsapVars = Record<string, unknown>

type MotionLikeProps = {
    initial?: false | string | GsapVars
    animate?: string | GsapVars
    exit?: GsapVars
    transition?: {
        delay?: number
        duration?: number
        ease?: string | number[]
        type?: string
        stiffness?: number
        damping?: number
    }
    layout?: boolean
    whileHover?: GsapVars
    whileTap?: GsapVars
    variants?: Record<string, GsapVars>
}

type AnyMotionProps = MotionLikeProps & {
    [key: string]: unknown
    children?: React.ReactNode
    className?: string
    style?: React.CSSProperties & GsapVars
}

const motionStyleKeys = new Set([
    'x',
    'y',
    'scale',
    'scaleX',
    'scaleY',
    'rotate',
    'rotation',
    'transformOrigin',
])

function stableKey(value: unknown) {
    if (!value || typeof value !== 'object') return String(value ?? '')
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}

/**
 * 內容一樣就回傳同一個物件：元件每次重繪都會傳新的 { opacity: 1 }，
 * 用這個讓「內容沒變」時不重播動畫，「內容變了」才重播。
 */
function useStable<T>(value: T): T {
    const ref = useRef<{ key: string; value: T } | null>(null)
    const key = stableKey(value)
    if (!ref.current || ref.current.key !== key) ref.current = { key, value }
    return ref.current.value
}

function splitStyle(style?: AnyMotionProps['style']) {
    const domStyle: React.CSSProperties = {}
    const motionStyle: GsapVars = {}

    Object.entries(style || {}).forEach(([key, value]) => {
        if (motionStyleKeys.has(key)) {
            motionStyle[key] = value
        } else {
            ;(domStyle as Record<string, unknown>)[key] = value
        }
    })

    return { domStyle, motionStyle }
}

function transitionVars(transition?: MotionLikeProps['transition']) {
    if (!transition) return { duration: MOTION.durationSeconds.normal, ease: MOTION.gsapEase.default }
    const spring = transition.type === 'spring'
    return {
        delay: transition.delay,
        duration: transition.duration ?? (spring ? MOTION.durationSeconds.spring : MOTION.durationSeconds.normal),
        // 規範只有減速與彈性兩條曲線：spring 走彈性，其餘（陣列、easeIn、easeInOut、自訂字串）一律減速 quint.out
        ease: spring ? MOTION.gsapEase.spring : MOTION.gsapEase.default,
    }
}

function resolveMotionValue(value: MotionLikeProps['initial'] | MotionLikeProps['animate'], variants?: Record<string, GsapVars>) {
    if (typeof value === 'string') return variants?.[value]
    if (value && typeof value === 'object') return value
    return undefined
}

function createMotionElement(tag: keyof React.JSX.IntrinsicElements) {
    return forwardRef<HTMLElement, AnyMotionProps>(function GsapMotionElement(props, forwardedRef) {
        const {
            initial,
            animate,
            exit,
            transition,
            layout: _layout,
            whileHover,
            whileTap,
            variants,
            style,
            onMouseEnter,
            onMouseLeave,
            onMouseDown,
            onMouseUp,
            onMouseCancel: _onMouseCancel,
            ...domProps
        } = props
        const innerRef = useRef<HTMLElement | null>(null)
        const hasMounted = useRef(false)
        const motionInitial = useStable(initial as MotionLikeProps['initial'])
        const motionAnimate = useStable(animate as MotionLikeProps['animate'])
        const motionExit = useStable(exit as GsapVars | undefined)
        const motionTransition = useStable(transition as MotionLikeProps['transition'])
        const motionVariants = useStable(variants as MotionLikeProps['variants'])
        const stableStyle = useStable(style as AnyMotionProps['style'])
        const { domStyle, motionStyle } = useMemo(() => splitStyle(stableStyle), [stableStyle])

        const presence = useContext(PresenceContext)
        const { exiting, skipInitial } = presence

        useImperativeHandle(forwardedRef, () => innerRef.current as HTMLElement)

        // 進場與 animate 改變
        useLayoutEffect(() => {
            const element = innerRef.current
            if (!element || exiting) return

            let focusIn = false
            if (!hasMounted.current) {
                const skip = skipInitial || motionInitial === false
                const initialVars = skip ? undefined : stripForReducedMotion(resolveMotionValue(motionInitial, motionVariants))
                if (Object.keys(motionStyle).length > 0) gsap.set(element, motionStyle)
                if (initialVars) {
                    // 高級感：淡入的元件同時「由模糊對焦到清楚」（Apple 的進場方式）；減少動態效果時不加
                    focusIn = initialVars.opacity === 0 && initialVars.filter === undefined && !prefersReducedMotion()
                    gsap.set(element, focusIn ? { ...initialVars, filter: `blur(${ENTER_BLUR}px)` } : initialVars)
                }
                hasMounted.current = true
            }

            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if (animateVars) {
                gsap.to(element, {
                    ...animateVars,
                    ...(focusIn ? { filter: 'blur(0px)', clearProps: 'filter' } : {}),
                    ...transitionVars(motionTransition),
                    overwrite: 'auto',
                })
            }
        }, [motionAnimate, motionInitial, motionStyle, motionTransition, motionVariants, exiting, skipInitial])

        // 離場：被 AnimatePresence 留住的元件，照 exit（沒寫就倒放進場）淡出＋失焦，期間不能點
        const wasExiting = useRef(false)
        useLayoutEffect(() => {
            const element = innerRef.current
            if (!element) return
            if (!exiting) {
                // 離場途中又被加回來（例如快速開關選單）：直接回到顯示狀態
                if (wasExiting.current) {
                    wasExiting.current = false
                    const back = resolveMotionValue(motionAnimate, motionVariants) ?? { opacity: 1 }
                    gsap.to(element, { ...back, filter: 'blur(0px)', clearProps: 'filter,pointerEvents', duration: MOTION.durationSeconds.fast, ease: MOTION.gsapEase.default, overwrite: 'auto' })
                }
                return
            }
            wasExiting.current = true
            const exitVars = stripForReducedMotion(motionExit ?? resolveMotionValue(motionInitial, motionVariants) ?? { opacity: 0 }) as GsapVars
            const blur = exitVars.opacity === 0 && exitVars.filter === undefined && !prefersReducedMotion()
            gsap.to(element, {
                duration: EXIT_SECONDS,
                ...exitVars, // exit 裡寫了 duration 就用它的（例如選單收起 0.15 秒）
                ...(blur ? { filter: `blur(${EXIT_BLUR}px)` } : {}),
                pointerEvents: 'none',
                ease: MOTION.gsapEase.default,
                overwrite: 'auto',
            })
        }, [exiting, motionExit, motionAnimate, motionInitial, motionVariants])

        // 元件真的移除後，停掉它身上還沒跑完的動畫（開發模式的模擬卸載時元件還在畫面上，不能停）
        useEffect(() => {
            const element = innerRef.current
            return () => {
                if (element && !element.isConnected) gsap.killTweensOf(element)
            }
        }, [])

        // 滑過／按下：離場中不理會（不然滑鼠移開會把正在淡出的元件拉回不透明）
        const tweenTo = (vars: GsapVars | undefined, duration: number) => {
            if (!vars || !innerRef.current || exiting) return
            gsap.to(innerRef.current, { ...vars, duration, ease: MOTION.gsapEase.out, overwrite: 'auto' })
        }
        const animateVars = () => resolveMotionValue(motionAnimate, motionVariants)

        const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
            tweenTo(whileHover as GsapVars | undefined, MOTION.durationSeconds.hover)
            ;(onMouseEnter as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
            if (whileHover || whileTap) tweenTo(animateVars(), MOTION.durationSeconds.hover)
            ;(onMouseLeave as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
            tweenTo(whileTap as GsapVars | undefined, MOTION.durationSeconds.press)
            ;(onMouseDown as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseUp = (event: React.MouseEvent<HTMLElement>) => {
            if (whileTap || whileHover) tweenTo(animateVars(), MOTION.durationSeconds.fast)
            ;(onMouseUp as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        return createElement(tag, {
            ...domProps,
            ref: innerRef,
            style: domStyle,
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            onMouseDown: handleMouseDown,
            onMouseUp: handleMouseUp,
        })
    })
}

// 這個檔案同時匯出 motion.* 元件表和 AnimatePresence；改動時整頁重新整理即可
// eslint-disable-next-line react-refresh/only-export-components
export const motion = {
    aside: createMotionElement('aside'),
    button: createMotionElement('button'),
    div: createMotionElement('div'),
    label: createMotionElement('label'),
    p: createMotionElement('p'),
    section: createMotionElement('section'),
} as Record<'aside' | 'button' | 'div' | 'label' | 'p' | 'section', React.ComponentType<AnyMotionProps>>

/**
 * AnimatePresence：被拿掉的子元件先留著播完離場動畫（EXIT_SECONDS）再真的移除。
 *   mode="wait"：舊的離場完才放新的進來（例如側欄「一般／專案」清單互換）
 *   initial={false}：第一次就在的子元件不播進場（之後移除再出現的，照常播）
 *
 * 只追蹤「真的畫在畫面上」的子元件：mode="wait" 等待中、還沒畫出來的新子元件如果又被拿掉，
 * 直接丟掉，不會被當成離場元件閃出來（快速來回切換時畫面才會停在正確的那一個）。
 */
export function AnimatePresence({
    children,
    mode,
    initial = true,
}: {
    children?: React.ReactNode
    mode?: 'wait' | 'sync' | 'popLayout'
    initial?: boolean
    [key: string]: unknown
}) {
    const [, rerender] = useState(0)
    const renderedRef = useRef<React.ReactElement[]>([])
    const exitingRef = useRef(new Map<React.Key, React.ReactElement>())
    const timersRef = useRef(new Map<React.Key, number>())
    const skipKeysRef = useRef<Set<React.Key> | null>(null)

    const present = Children.toArray(children).filter(isValidElement) as React.ReactElement[]
    const presentKeys = new Set(present.map((c) => c.key as React.Key))
    if (skipKeysRef.current === null) skipKeysRef.current = initial ? new Set() : new Set(presentKeys)
    const exiting = exitingRef.current

    // 上次畫出來、這次不見了 → 開始離場；離場中又回來 → 取消離場
    for (const c of renderedRef.current) {
        const k = c.key as React.Key
        if (!presentKeys.has(k) && !exiting.has(k)) exiting.set(k, c)
    }
    for (const k of presentKeys) exiting.delete(k)

    // 離場中的元件留在原本的位置
    let out: React.ReactElement[] = [...present]
    renderedRef.current.forEach((c, i) => {
        const leaving = exiting.get(c.key as React.Key)
        if (leaving && !out.some((o) => o.key === c.key)) out.splice(Math.min(i, out.length), 0, leaving)
    })
    // wait：還有元件在離場時，只畫已經在畫面上的，新的等離場完
    if (mode === 'wait' && exiting.size > 0) {
        const shown = new Set(renderedRef.current.map((c) => c.key))
        out = out.filter((c) => shown.has(c.key))
    }
    renderedRef.current = out

    useEffect(() => {
        for (const [k, el] of exitingRef.current) {
            if (timersRef.current.has(k)) continue
            // 等這個元件自己的離場時間（exit 裡寫的 duration，例如選單 0.15 秒），沒寫就用預設
            const own = (el.props as { exit?: { duration?: number } }).exit?.duration
            const secs = typeof own === 'number' ? own : EXIT_SECONDS
            timersRef.current.set(
                k,
                window.setTimeout(() => {
                    timersRef.current.delete(k)
                    exitingRef.current.delete(k)
                    renderedRef.current = renderedRef.current.filter((c) => c.key !== k)
                    // 移除後再出現就是新的一次，要播進場
                    skipKeysRef.current?.delete(k)
                    rerender((n) => n + 1)
                }, secs * 1000 + 30),
            )
        }
        for (const [k, t] of timersRef.current) {
            if (!exitingRef.current.has(k)) {
                window.clearTimeout(t)
                timersRef.current.delete(k)
            }
        }
    })
    useEffect(() => {
        const timers = timersRef.current
        return () => timers.forEach((t) => window.clearTimeout(t))
    }, [])

    return (
        <Fragment>
            {out.map((c) => {
                const k = c.key as React.Key
                return (
                    <PresenceContext.Provider key={k} value={{ exiting: exiting.has(k), skipInitial: skipKeysRef.current!.has(k) }}>
                        {c}
                    </PresenceContext.Provider>
                )
            })}
        </Fragment>
    )
}

export function LayoutGroup({ children }: { children?: React.ReactNode }) {
    return <Fragment>{children}</Fragment>
}
