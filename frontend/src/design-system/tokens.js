// Corphia design tokens.
// Keep shared visual constants here so Tailwind, React, and global CSS agree.

export const radius = {
    pill: '9999px',
    'cv-xs': '6px',
    'cv-sm': '10px',
    'cv-md': '14px',
    'cv-lg': '20px',
    'cv-xl': '24px',
    'cv-2xl': '32px',
    'card-sm': '22px',
    'card-md': '30px',
    'card-lg': '34px',
    'card-xl': '38px',
}

export const fontSize = {
    caption: ['12px', '16px'],
    'body-sm': ['13px', '18px'],
    body: ['14px', '20px'],
    'body-lg': ['16px', '24px'],
    'title-sm': ['18px', '24px'],
    title: ['22px', '28px'],
    display: ['36px', '44px'],
}

export const themeColors = {
    // 暖色調米色 / 深灰，避開純白純黑造成的視覺壓迫
    darkBg: '#202022',
    darkSurface: '#28282A',
    darkBgGradient: 'linear-gradient(135deg, #202022 0%, #101012 100%)',
    lightBg: '#F6F4F0',
    lightSurface: '#F2EFEA',
    textOnLight: '#2A2722',
    textOnDark: '#F6F4F0',
}

export const brandColors = {
    bronze: '#896E53',
    bronzeHover: '#6F5943',
    bronzeActive: '#574537',
}

export const accentColors = {
    default: { label: 'Titanium Bronze', hex: '#896E53', rgb: '137 110 83' },
    blue: { label: 'System Blue', hex: '#3F8EF7', rgb: '63 142 247' },
    purple: { label: 'Electric Purple', hex: '#DB37F4', rgb: '219 55 244' },
    pink: { label: 'Signal Pink', hex: '#F64066', rgb: '246 64 102' },
    orange: { label: 'Warm Orange', hex: '#FB8D2D', rgb: '251 141 45' },
    green: { label: 'Mint Green', hex: '#22D9C5', rgb: '34 217 197' },
}

export const palette = {
    corphia: {
        // 'bronze' 改成綁定使用者選的品牌色（透過 --color-ios-accent-light）。
        // 原本寫死成 #896E53，導致 text-corphia-bronze / bg-corphia-bronze 等
        // class 永遠停在金色，使用者切到藍/粉/橘/綠時這些元件不跟著變。
        // 改用 rgb(var(--color-ios-accent-light) / <alpha>) 之後，
        // Tailwind 的 alpha 修飾子（/30 /50 等）也能正常運作。
        bronze: 'rgb(var(--color-ios-accent-light) / <alpha-value>)',
        beige: '#DDD8D0',
        sand: '#ECE8E1',
        'warm-gray': '#807C76',
        ivory: themeColors.lightBg,
        obsidian: themeColors.darkBg,
        espresso: themeColors.darkSurface,
        ink: themeColors.textOnLight,
    },
    primary: {
        50: '#F7F5F2',
        100: '#EDE8E2',
        200: '#D9D0C6',
        300: '#BFB1A1',
        400: '#A08C78',
        500: brandColors.bronze,
        600: brandColors.bronzeHover,
        700: brandColors.bronzeActive,
        800: '#3F342B',
        900: themeColors.textOnLight,
        950: themeColors.darkBg,
    },
    bg: {
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        main: 'rgb(var(--bg-main) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
    },
    text: {
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        disabled: 'rgb(var(--text-disabled) / <alpha-value>)',
        // --text-on-accent 是 hex（#000 or #fff），App.tsx 依 accent 亮度動態切換。
        // 用在「bg-accent 上的文字」，Tailwind class: text-text-on-accent
        'on-accent': 'var(--text-on-accent, #fff)',
    },
    border: {
        subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
        strong: 'rgb(var(--border-strong) / <alpha-value>)',
    },
    accent: {
        DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
        hover: 'rgb(var(--accent-hover) / <alpha-value>)',
        active: 'rgb(var(--accent-active) / <alpha-value>)',
        soft: 'rgb(var(--accent-soft) / <alpha-value>)',
    },
    ios: {
        blue: {
            light: 'rgb(var(--color-ios-accent-light) / <alpha-value>)',
            dark: 'rgb(var(--color-ios-accent-dark) / <alpha-value>)',
        },
        light: {
            gray1: '#8E8E93',
            gray2: '#AEAEB2',
            gray3: '#C7C7CC',
            gray4: '#D1D1D6',
            gray5: '#E5E5EA',
            gray6: '#F2F2F7',
        },
        dark: {
            gray1: '#8E8E93',
            gray2: '#636366',
            gray3: '#48484A',
            gray4: '#3A3A3C',
            gray5: '#2C2C2E',
            gray6: '#1C1C1E',
            black: '#000000',
        },
    },
}

export const boxShadow = {
    sm: '0 1px 2px rgb(0 0 0 / 0.04)',
    DEFAULT: '0 2px 6px rgb(0 0 0 / 0.05)',
    md: '0 4px 12px rgb(0 0 0 / 0.06)',
    lg: '0 8px 20px rgb(0 0 0 / 0.07)',
    xl: '0 12px 28px rgb(0 0 0 / 0.09)',
    '2xl': '0 20px 40px rgb(0 0 0 / 0.12)',
    inner: 'inset 0 1px 3px rgb(0 0 0 / 0.06)',
}

export const motion = {
    duration: {
        instant: '1ms',
        press: '120ms',
        fast: '150ms',
        normal: '250ms',
        medium: '300ms',
        slow: '600ms',
        spin: '1s',
        pulse: '2s',
    },
    durationSeconds: {
        press: 0.12,
        fast: 0.15,
        hover: 0.18,
        normal: 0.25,
        spring: 0.36,
        slow: 0.6,
    },
    easing: {
        apple: 'cubic-bezier(0.16, 1, 0.3, 1)',
        appleSoft: 'cubic-bezier(0.22, 1, 0.36, 1)',
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pulse: 'cubic-bezier(0.4, 0, 0.6, 1)',
        pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    gsapEase: {
        default: 'power2.out',
        in: 'power2.in',
        out: 'power2.out',
        inOut: 'power2.inOut',
    },
    spring: {
        default: { type: 'spring', stiffness: 200, damping: 25, mass: 1 },
        snappy: { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 },
        gentle: { type: 'spring', stiffness: 120, damping: 22, mass: 1 },
    },
    fade: {
        type: 'tween',
        duration: 0.18,
        ease: [0.4, 0, 0.2, 1],
    },
    keyframes: {
        'typing-bounce': {
            '0%, 100%': { transform: 'translateY(10%)', opacity: '0.4' },
            '50%': { transform: 'translateY(-60%)', opacity: '1' },
        },
        'draw-c-path': {
            '0%': { strokeDashoffset: '28', opacity: '0' },
            '10%': { strokeDashoffset: '28', opacity: '1' },
            '50%': { strokeDashoffset: '0', opacity: '1' },
            '70%': { strokeDashoffset: '0', opacity: '1' },
            '100%': { strokeDashoffset: '-28', opacity: '0' },
        },
        'pop-spark': {
            '0%, 40%': { transform: 'scale(0)', opacity: '0' },
            '50%': { transform: 'scale(1.2)', opacity: '1' },
            '60%, 75%': { transform: 'scale(1)', opacity: '1' },
            '100%': { transform: 'scale(0)', opacity: '0' },
        },
    },
    animation: {
        'typing-bounce': 'typing-bounce 1s infinite',
        'draw-c': 'draw-c-path 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'pop-spark': 'pop-spark 2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
    },
}

export default {
    radius,
    fontSize,
    themeColors,
    brandColors,
    accentColors,
    palette,
    boxShadow,
    motion,
}
