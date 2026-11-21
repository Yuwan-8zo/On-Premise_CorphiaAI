/**
 * 小 AI 可以抓起來甩（MascotDock）
 *
 *   按住拖：跟著手指／滑鼠走；放開：照放手時的速度飛出去，碰到畫面邊緣會反彈（手機輕震一下），
 *   慢下來之後彈回右下角原位。只是點一下（移動不到 DRAG_START px）照常是「戳它」。
 *   系統開「減少動態效果」：放開直接回原位，不飛。
 *
 *   const fling = useFling(ref)   // ref 掛在小 AI 外面那一層
 *   fling.state  'idle' | 'held' | 'flying'（MascotDock 用來換表情）
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { haptic } from '@/lib/haptics'
import { prefersReducedMotion } from '@/lib/reducedMotion'
import { swallowNextClick } from '@/lib/swallowClick'

/** 移動超過這麼多 px 才算「拖」，不然算點一下 */
const DRAG_START = 6
/** 放手速度取最後這段時間的移動 */
const VELOCITY_WINDOW_MS = 90
/** 每毫秒保留多少速度（越接近 1 滑越遠） */
const FRICTION = 0.9965
/** 撞牆後剩多少速度 */
const BOUNCE = 0.62
/** 慢到這個速度（px／ms）就停下來回家 */
const STOP_SPEED = 0.05
/** 飛得再快也不超過這個速度（px／ms），不會一甩就不見 */
const MAX_SPEED = 4

export type FlingState = 'idle' | 'held' | 'flying'

export function useFling(ref: RefObject<HTMLElement | null>) {
    const [state, setState] = useState<FlingState>('idle')
    const pos = useRef({ x: 0, y: 0 })
    const raf = useRef(0)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        let start: { x: number; y: number; px: number; py: number } | null = null
        let dragging = false
        let samples: { t: number; x: number; y: number }[] = []

        const apply = (animate: boolean) => {
            el.style.transition = animate ? '' : 'none'
            el.style.transform = pos.current.x || pos.current.y ? `translate(${pos.current.x}px, ${pos.current.y}px)` : ''
        }
        const goHome = () => {
            pos.current = { x: 0, y: 0 }
            apply(true)
            setState('idle')
        }

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return
            cancelAnimationFrame(raf.current)
            start = { x: e.clientX, y: e.clientY, px: pos.current.x, py: pos.current.y }
            samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }]
            dragging = false
        }
        const onMove = (e: PointerEvent) => {
            if (!start) return
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (!dragging) {
                if (Math.hypot(dx, dy) < DRAG_START) return
                dragging = true
                el.setPointerCapture?.(e.pointerId)
                setState('held')
                haptic()
            }
            pos.current = { x: start.px + dx, y: start.py + dy }
            apply(false)
            samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY })
            samples = samples.filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS)
        }
        const onUp = (e: PointerEvent) => {
            if (!start) return
            start = null
            if (!dragging) return
            swallowNextClick() // 拖完放開不算「戳」
            const first = samples[0]
            const dt = Math.max(1, e.timeStamp - (first?.t ?? e.timeStamp))
            const clamp = (v: number) => Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v))
            let vx = clamp(((e.clientX - (first?.x ?? e.clientX)) / dt))
            let vy = clamp(((e.clientY - (first?.y ?? e.clientY)) / dt))
            if (prefersReducedMotion() || Math.hypot(vx, vy) < STOP_SPEED) { goHome(); return }

            setState('flying')
            // 原位的外框：算出能飛的範圍（不飛出畫面）
            const r = el.getBoundingClientRect()
            const homeLeft = r.left - pos.current.x
            const homeTop = r.top - pos.current.y
            const minX = -homeLeft, maxX = window.innerWidth - r.width - homeLeft
            const minY = -homeTop, maxY = window.innerHeight - r.height - homeTop
            let last = performance.now()
            const step = (now: number) => {
                const ms = Math.min(32, now - last)
                last = now
                let { x, y } = pos.current
                x += vx * ms
                y += vy * ms
                let hit = false
                if (x < minX || x > maxX) { x = Math.max(minX, Math.min(maxX, x)); vx = -vx * BOUNCE; hit = true }
                if (y < minY || y > maxY) { y = Math.max(minY, Math.min(maxY, y)); vy = -vy * BOUNCE; hit = true }
                if (hit) haptic()
                const keep = FRICTION ** ms
                vx *= keep
                vy *= keep
                pos.current = { x, y }
                apply(false)
                if (Math.hypot(vx, vy) < STOP_SPEED) { goHome(); return }
                raf.current = requestAnimationFrame(step)
            }
            raf.current = requestAnimationFrame(step)
        }

        el.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        return () => {
            cancelAnimationFrame(raf.current)
            el.removeEventListener('pointerdown', onDown)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
        }
    }, [ref])

    return { state }
}
