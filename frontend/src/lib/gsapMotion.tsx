import React, {
    Fragment,
    createElement,
    forwardRef,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react'
import { gsap } from '@/lib/gsap'

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
    if (Array.isArray(ease)) return 'power2.out'
    if (ease === 'easeInOut') return 'power2.inOut'
    if (ease === 'easeIn') return 'power2.in'
    if (ease === 'easeOut') return 'power2.out'
    return ease || 'power2.out'
}

function transitionVars(transition?: MotionLikeProps['transition']) {
    if (!transition) return { duration: 0.25, ease: 'power2.out' }
    return {
        delay: transition.delay,
        duration: transition.duration ?? (transition.type === 'spring' ? 0.36 : 0.25),
        ease: normalizeEase(transition.ease),
    }
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
            exit: _exit,
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

        useImperativeHandle(forwardedRef, () => innerRef.current as HTMLElement)

        useLayoutEffect(() => {
            const element = innerRef.current
            if (!element) return

            if (!hasMounted.current) {
                const initialVars = resolveMotionValue(motionInitial, motionVariants)
                if (Object.keys(motionStyle).length > 0) gsap.set(element, motionStyle)
                if (initialVars) gsap.set(element, initialVars)
                hasMounted.current = true
            }

            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if (animateVars) {
                gsap.to(element, {
                    ...animateVars,
                    ...transitionVars(transition as MotionLikeProps['transition']),
                    overwrite: 'auto',
                })
            }
        }, [stableKey(motionAnimate), stableKey(motionInitial), stableKey(motionStyle), stableKey(transition), stableKey(motionVariants)])

        const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
            if (whileHover && innerRef.current) {
                gsap.to(innerRef.current, { ...whileHover, duration: 0.18, ease: 'power2.out', overwrite: 'auto' })
            }
            ;(onMouseEnter as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseLeave = (event: React.MouseEvent<HTMLElement>) => {
            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if ((whileHover || whileTap) && innerRef.current && animateVars) {
                gsap.to(innerRef.current, { ...animateVars, duration: 0.18, ease: 'power2.out', overwrite: 'auto' })
            }
            ;(onMouseLeave as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseDown = (event: React.MouseEvent<HTMLElement>) => {
            if (whileTap && innerRef.current) {
                gsap.to(innerRef.current, { ...whileTap, duration: 0.12, ease: 'power2.out', overwrite: 'auto' })
            }
            ;(onMouseDown as ((event: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        }

        const handleMouseUp = (event: React.MouseEvent<HTMLElement>) => {
            const animateVars = resolveMotionValue(motionAnimate, motionVariants)
            if ((whileTap || whileHover) && innerRef.current && animateVars) {
                gsap.to(innerRef.current, { ...animateVars, duration: 0.16, ease: 'power2.out', overwrite: 'auto' })
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
    button: createMotionElement('button'),
    div: createMotionElement('div'),
    label: createMotionElement('label'),
    p: createMotionElement('p'),
    section: createMotionElement('section'),
} as Record<'button' | 'div' | 'label' | 'p' | 'section', React.ComponentType<AnyMotionProps>>

export function AnimatePresence({ children }: { children?: React.ReactNode; [key: string]: unknown }) {
    return <Fragment>{children}</Fragment>
}

export function LayoutGroup({ children }: { children?: React.ReactNode }) {
    return <Fragment>{children}</Fragment>
}
