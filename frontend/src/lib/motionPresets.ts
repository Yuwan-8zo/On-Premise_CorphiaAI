import { MOTION } from '@/design-system'

type SpringPreset = {
    type: 'spring'
    stiffness: number
    damping: number
    mass: number
}

type TweenPreset = {
    type: 'tween'
    duration: number
    ease: readonly [number, number, number, number]
}

function springFromToken(value: { stiffness: number; damping: number; mass: number }): SpringPreset {
    return {
        type: 'spring',
        stiffness: value.stiffness,
        damping: value.damping,
        mass: value.mass,
    }
}

export const spring = springFromToken(MOTION.spring.default)
export const springSnappy = springFromToken(MOTION.spring.snappy)
export const springGentle = springFromToken(MOTION.spring.gentle)

export const fade: TweenPreset = {
    type: 'tween',
    duration: MOTION.fade.duration,
    ease: MOTION.fade.ease,
}
