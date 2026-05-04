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
