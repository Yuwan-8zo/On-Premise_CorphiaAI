/**
 * useAccentColor — read the user's currently-selected brand accent as a real
 * resolved RGB string for use in libraries (recharts) that can't evaluate
 * CSS variables in SVG attributes.
 *
 * Why this exists:
 *   - colors.css binds --accent → var(--color-ios-accent-light)
 *   - Tailwind classes like bg-accent / text-accent expand to
 *     rgb(var(--accent) / <alpha>) which CSS handles fine
 *   - But Recharts wants concrete strings for fill/stroke. Passing
 *     "rgb(var(--accent))" to <Bar fill={...}/> produces black (the var
 *     isn't resolved when the attribute is serialized to SVG)
 *
 * Solution: read the underlying CSS custom property via getComputedStyle
 * (which DOES return the resolved value for properties that don't reference
 * other variables), and re-read whenever the html element's data-accent
 * attribute or class list changes (theme switch / brand-color switch).
 */

import { useState, useEffect, useMemo } from 'react'

function readAccentRgbSpace(): string {
    if (typeof window === 'undefined') return '137 110 83'
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-ios-accent-light')
        .trim()
    return value || '137 110 83'
}

export interface AccentColor {
    /** Space-separated string like "137 110 83" — for compose-it-yourself use. */
    rgb: string
    /** Ready-to-use "rgb(r, g, b)" — pass to recharts fill/stroke. */
    full: string
    /** "#896E53" — for places that expect hex. */
    hex: string
    /** Build "rgba(r, g, b, alpha)" with custom opacity (0-1). */
    alpha: (a: number) => string
}

export function useAccentColor(): AccentColor {
    const [rgb, setRgb] = useState<string>(readAccentRgbSpace)

    useEffect(() => {
        const root = document.documentElement

        const update = () => {
            const next = readAccentRgbSpace()
            setRgb((prev) => (prev === next ? prev : next))
        }

        // data-accent flips when user picks Blue/Purple/etc.; class flips for dark mode.
        const observer = new MutationObserver(update)
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-accent', 'class', 'style'],
        })

        // Belt-and-suspenders: also re-read on mount in case the initial render
        // happened before the data-accent attribute was applied.
        update()

        return () => observer.disconnect()
    }, [])

    return useMemo<AccentColor>(() => {
        const [r = 137, g = 110, b = 83] = rgb.split(/\s+/).map((n) => Number(n) || 0)
        return {
            rgb,
            full: `rgb(${r}, ${g}, ${b})`,
            hex:
                '#' +
                [r, g, b]
                    .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
                    .join('')
                    .toUpperCase(),
            alpha: (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`,
        }
    }, [rgb])
}

/**
 * Generate N shades from the accent color for use in stacked charts, donuts,
 * etc. Shades go from light (0.4 alpha) to dark (0.95 alpha) by default.
 */
export function makeAccentShades(
    accent: AccentColor,
    count: number,
    { from = 0.95, to = 0.4 }: { from?: number; to?: number } = {},
): string[] {
    if (count <= 0) return []
    if (count === 1) return [accent.alpha(from)]
    return Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1)
        return accent.alpha(from + (to - from) * t)
    })
}


/**
 * 圖表分類色：Apple 系統色（藍、綠、橘、紅、紫、青、黃、粉、靛、灰），每一類一個明顯不同的色相，
 * 不用同一個顏色的深淺（太相近、分不出來）。深色外觀用 Apple 深色版，淺色外觀用淺色版。
 */
const APPLE_CATEGORY_DARK = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#FFD60A', '#FF375F', '#5E5CE6', '#8E8E93']
const APPLE_CATEGORY_LIGHT = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FFCC00', '#FF2D55', '#5856D6', '#8E8E93']
export function appleCategoryColors(n: number): string[] {
    const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    const base = dark ? APPLE_CATEGORY_DARK : APPLE_CATEGORY_LIGHT
    return Array.from({ length: n }, (_, i) => base[i % base.length])
}
