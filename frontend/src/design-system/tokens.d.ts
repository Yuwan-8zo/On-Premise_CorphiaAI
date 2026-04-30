declare const tokens: {
    radius: Record<string, string>
    fontSize: Record<string, [string, string]>
    themeColors: Record<string, string>
    brandColors: Record<string, string>
    accentColors: Record<string, { label: string; hex: string; rgb: string }>
    palette: Record<string, unknown>
    boxShadow: Record<string, string>
    motion: {
        duration: Record<string, string>
        durationSeconds: Record<string, number>
        easing: Record<string, string>
        gsapEase: Record<string, string>
        spring: Record<string, { type: string; stiffness: number; damping: number; mass: number }>
        fade: { type: string; duration: number; ease: readonly [number, number, number, number] }
        keyframes: Record<string, unknown>
        animation: Record<string, string>
    }
}

export default tokens
