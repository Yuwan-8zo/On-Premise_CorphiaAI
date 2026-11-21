/**
 * 歡迎頁 → 登入的過場（B3＋B2）
 *   1. shrinkToOrb：「開始使用」收成一顆玻璃球
 *   2. splitOrb：球一分為二——小 AI 從球的位置、球的大小彈到左邊（FLIP），
 *      登入卡片從球的位置用圓形擴散撐開（clip-path），球同時淡掉
 *   時間與曲線讀 login.css 在 .login-page 上的設定（--login-*），這裡不另外寫數字。
 */

import { backdropColor, tintFor } from '@/components/mascot/backdropTint'

export interface Orb {
    el: HTMLDivElement
    /** 球心（視窗座標） */
    cx: number
    cy: number
    /** 球的直徑 */
    d: number
}

const cssVar = (host: Element, name: string) => getComputedStyle(host).getPropertyValue(name).trim()
const cssMs = (host: Element, name: string) => {
    const v = cssVar(host, name)
    return v.endsWith('ms') ? Number.parseFloat(v) : Number.parseFloat(v) * 1000 || 0
}

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** 按鈕收成球；回傳球（之後交給 splitOrb） */
export async function shrinkToOrb(button: HTMLElement, host: HTMLElement): Promise<Orb> {
    const b = button.getBoundingClientRect()
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2
    const d = Number.parseFloat(cssVar(host, '--login-orb')) || b.height
    const el = document.createElement('div')
    el.className = 'login-orb'
    Object.assign(el.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })
    // 球的顏色跟小 AI 一樣：照按鈕後面的背景色算（淺色背景再濃一點）
    const { tint, light } = tintFor(backdropColor(button))
    el.style.setProperty('--orb-tint', tint)
    el.classList.toggle('on-light', light)
    document.body.appendChild(el)
    const anim = el.animate(
        [
            { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` },
            { left: `${cx - d / 2}px`, top: `${cy - d / 2}px`, width: `${d}px`, height: `${d}px` },
        ],
        { duration: cssMs(host, '--login-t-orb'), easing: cssVar(host, '--login-ease-sp'), fill: 'forwards' },
    )
    await anim.finished.catch(() => undefined)
    return { el, cx, cy, d }
}

/** 球分裂：小 AI 往左、卡片圓形擴散；回傳整段要多久（毫秒） */
export function splitOrb(orb: Orb, host: HTMLElement, mascot: HTMLElement, card: HTMLElement) {
    const { el, cx, cy, d } = orb
    const ease = cssVar(host, '--login-ease-sp')
    const tMascot = cssMs(host, '--login-t-mascot')
    const tCard = cssMs(host, '--login-t-card')

    // 小 AI：從球的位置、球的大小彈到定位（眼睛晚一點才出現，像球裡長出眼睛）
    const m = mascot.getBoundingClientRect()
    mascot.animate(
        [
            { transform: `translate(${cx - (m.left + m.width / 2)}px, ${cy - (m.top + m.height / 2)}px) scale(${d / m.width})` },
            { transform: 'none' },
        ],
        { duration: tMascot, easing: cssVar(host, '--login-ease-mascot') },
    )
    mascot.querySelector('.m-eyes')?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: tMascot })

    // 卡片：從球的位置用圓形擴散撐開，裡面的東西依序浮上來
    const c = card.getBoundingClientRect()
    const ox = cx - c.left
    const oy = cy - c.top
    const corners: Array<[number, number]> = [[0, 0], [c.width, 0], [0, c.height], [c.width, c.height]]
    const r = Math.max(...corners.map(([x, y]) => Math.hypot(x - ox, y - oy))) + 4
    card.animate(
        [{ clipPath: `circle(${d / 2}px at ${ox}px ${oy}px)` }, { clipPath: `circle(${r}px at ${ox}px ${oy}px)` }],
        { duration: tCard, delay: 60, easing: ease, fill: 'backwards' },
    )
    Array.from(card.children).forEach((child, i) =>
        child.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], {
            duration: tCard * 0.62,
            delay: tCard * 0.38 + i * 35,
            easing: ease,
            fill: 'backwards',
        }),
    )

    // 球：一分為二的瞬間淡掉
    el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.25)' }], {
        duration: cssMs(host, '--login-t-orb-out'),
        easing: 'ease-out',
        fill: 'forwards',
    }).finished.then(() => el.remove(), () => el.remove())

    return Math.max(tMascot, tCard)
}
