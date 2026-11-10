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

/*
 * 高級感切換（全站自動套用）：
 *   進場：淡入的元件同時由模糊 8px 對焦到清楚
 *   離場：AnimatePresence 留住被拿掉的元件，0.2 秒淡出＋失焦 6px（規範：淡出／小過場 0.2 秒、減速曲線）
 */
const ENTER_BLUR = 8
const EXIT_BLUR = 6
const EXIT_SECONDS = 0.2

const PresenceContext = createContext<{ exiting: boolean; skipInitial: boolean }>({ exiting: false, skipInitial: false })

function prefersReducedMotion() {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

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

function normalizeEase(ease?: string | number[]) {
    // 規範不用加速曲線：陣列、easeIn、easeInOut、自訂字串一律換成減速（quint.out ＝ cubic-bezier(.23,1,.32,1)）
    void ease
    return MOTION.gsapEase.default
}

function transitionVars(transition?: MotionLikeProps['transition']) {
    if (!transition) return { duration: MOTION.durationSeconds.normal, ease: MOTION.gsapEase.default }
    const spring = transition.type === 'spring'
    return {
        delay: transition.delay,
        duration: transition.duration ?? (spring ? MOTION.durationSeconds.spring : MOTION.durationSeconds.normal),
        // 規範只有減速與彈性兩條曲線：spring 走彈性，其餘一律減速（不用加速曲線）
        ease: spring ? MOTION.gsapEase.spring : normalizeEase(transition.ease),
    }
}

/** 系統「減少動態效果」：拿掉位移與縮放，只留淡入淡出（規範：換頁只留 0.12＋0.2 秒淡入淡出） */
const REDUCED_KEYS = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'xPercent', 'yPercent']
export function stripForReducedMotion<T extends Record<string, unknown> | undefined>(vars: T): T {
    if (!vars || typeof window === 'undefined' || !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return vars
    const out = { ...vars } as Record<string, unknown>
    for (const k of REDUCED_KEYS) delete out[k]
    return out as T
}

function mergeRefs<T>(node: T | null, innerRef: React.MutableRefObject<T | null>, forwardedRef: React.ForwardedRef<T>) {
    innerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
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
        const motionInitial = initial as MotionLikeProps['initial']
        const motionAnimate = animate as MotionLikeProps['animate']
        const motionVariants = variants as MotionLikeProps['variants']
        const { domStyle, motionStyle } = useMemo(() => splitStyle(style as AnyMotionProps['style']), [stableKey(style)])

        const presence = useContext(PresenceContext)

        useImperativeHandle(forwardedRef, () => innerRef.current as HTMLElement)

        useLayoutEffect(() => {
            const element = innerRef.current
            if (!element || presence.exiting) return

            let focusIn = false
            if (!hasMounted.current) {
                const skip = presence.skipInitial || motionInitial === false
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
                    ...transitionVars(transition as MotionLikeProps['transition']),
                    overwrite: 'auto',
                })
            }
        }, [stableKey(motionAnimate), stableKey(motionInitial), stableKey(motionStyle), stableKey(transition), stableKey(motionVariants)])

        // 離場：被 AnimatePresence 留住的元件，照 exit（沒寫就倒放進場）淡出＋失焦，期間不能點
        const wasExiting = useRef(false)
        useLayoutEffect(() => {
            const element = innerRef.current
            if (!element) return
            if (!presence.exiting) {
                // 離場途中又被加回來（例如快速開關選單）：直接回到顯示狀態
                if (wasExiting.current) {
                    wasExiting.current = false
                    const back = resolveMotionValue(motionAnimate, motionVariants) ?? { opacity: 1 }
                    gsap.to(element, { ...back, filter: 'blur(0px)', clearProps: 'filter,pointerEvents', duration: MOTION.durationSeconds.fast, ease: MOTION.gsapEase.default, overwrite: 'auto' })
                }
                return
            }
            wasExiting.current = true
            const exitVars = stripForReducedMotion(
                (exit as GsapVars | undefined) ?? resolveMotionValue(motionInitial, motionVariants) ?? { opacity: 0 },
            ) as GsapVars
            const blur = exitVars.opacity === 0 && exitVars.filter === undefined && !prefersReducedMotion()
            gsap.to(element, {
                ...exitVars,
                ...(blur ? { filter: `blur(${EXIT_BLUR}px)` } : {}),
                pointerEvents: 'none',
                duration: EXIT_SECONDS,
                ease: MOTION.gsapEase.default,
                overwrite: 'auto',
            })
        }, [presence.exiting])

        const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
            if (whileHover && innerRef.current) {
                gsap.to(innerRef.current, { ...whileHover, duration: MOTION.durationSeconds.hover, ease: MOTION.gsapEase.out, overwrite: 'auto' })
            }
            ;(onMouseEnter as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if ((whileHover || whileTap) && innerRef.current && animateVars) {
                gsap.to(innerRef.current, { ...animateVars, duration: MOTION.durationSeconds.hover, ease: MOTION.gsapEase.out, overwrite: 'auto' })
            }
            ;(onMouseLeave as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
            if (whileTap && innerRef.current) {
                gsap.to(innerRef.current, { ...whileTap, duration: MOTION.durationSeconds.press, ease: MOTION.gsapEase.out, overwrite: 'auto' })
            }
            ;(onMouseDown as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseUp = (event: React.MouseEvent<HTMLElement>) => {
            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if ((whileTap || whileHover) && innerRef.current && animateVars) {
                gsap.to(innerRef.current, { ...animateVars, duration: MOTION.durationSeconds.fast, ease: MOTION.gsapEase.out, overwrite: 'auto' })
            }
            ;(onMouseUp as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        return createElement(tag, {
            ...domProps,
            ref: (node: HTMLElement | null) => mergeRefs(node, innerRef, forwardedRef),
            style: domStyle,
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            onMouseDown: handleMouseDown,
            onMouseUp: handleMouseUp,
        })
    })
}

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
 *   initial={false}：第一次出現的子元件不播進場
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
    const exitingRef = useRef(new Map<React.Key, React.ReactElement>())
    const timersRef = useRef(new Map<React.Key, number>())
    const lastRef = useRef<React.ReactElement[]>([])
    const firstKeysRef = useRef<Set<React.Key> | null>(null)

    const present = Children.toArray(children).filter(isValidElement) as React.ReactElement[]
    const presentKeys = new Set(present.map((c) => c.key as React.Key))
    if (firstKeysRef.current === null) firstKeysRef.current = initial ? new Set() : presentKeys

    for (const c of lastRef.current) {
        const k = c.key as React.Key
        if (!presentKeys.has(k) && !exitingRef.current.has(k)) exitingRef.current.set(k, c)
    }
    for (const k of presentKeys) exitingRef.current.delete(k)

    // 離場中的元件留在原本的位置
    let out: React.ReactElement[] = [...present]
    lastRef.current.forEach((c, i) => {
        const k = c.key as React.Key
        const leaving = exitingRef.current.get(k)
        if (leaving && !out.some((o) => o.key === k)) out.splice(Math.min(i, out.length), 0, leaving)
    })
    if (mode === 'wait' && exitingRef.current.size > 0) out = out.filter((c) => exitingRef.current.has(c.key as React.Key))
    lastRef.current = mode === 'wait' && exitingRef.current.size > 0 ? [...out, ...present.filter((c) => !out.includes(c))] : out

    useEffect(() => {
        for (const k of exitingRef.current.keys()) {
            if (timersRef.current.has(k)) continue
            timersRef.current.set(
                k,
                window.setTimeout(() => {
                    timersRef.current.delete(k)
                    exitingRef.current.delete(k)
                    lastRef.current = lastRef.current.filter((c) => c.key !== k)
                    rerender((n) => n + 1)
                }, EXIT_SECONDS * 1000 + 30),
            )
        }
        for (const [k, t] of timersRef.current) {
            if (!exitingRef.current.has(k)) {
                window.clearTimeout(t)
                timersRef.current.delete(k)
            }
        }
    })
    useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), [])

    return (
        <Fragment>
            {out.map((c) => {
                const k = c.key as React.Key
                return (
                    <PresenceContext.Provider key={k} value={{ exiting: exitingRef.current.has(k), skipInitial: firstKeysRef.current!.has(k) }}>
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
