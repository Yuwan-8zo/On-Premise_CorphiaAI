// Corphia design tokens.
// Keep shared visual constants here so Tailwind, React, and global CSS agree.

export const radius = {
    // Snow 設計：同心大圓角。卡片 25、列表列 18、控制項 24、大型浮層 46
    pill: '9999px',
    'cv-xs': '8px',
    'cv-sm': '12px',
    'cv-md': '14px',
    'cv-lg': '18px',
    'cv-xl': '24px',
    'cv-2xl': '32px',
    'card-sm': '25px',
    'card-md': '25px',
    'card-lg': '32px',
    'card-xl': '46px',
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
    // Apple 系統色（iOS 26）：rgb＝淺色外觀、rgbDark＝深色外觀。依《Liquid Glass 元件規範》CSS 29–30；棕色已移除
    blue: { label: 'System Blue', hex: '#0091FF', rgb: '0 122 255', rgbDark: '0 145 255' },
    purple: { label: 'System Purple', hex: '#BF5AF2', rgb: '175 82 222', rgbDark: '191 90 242' },
    pink: { label: 'System Pink', hex: '#FF375F', rgb: '255 45 85', rgbDark: '255 55 95' },
    orange: { label: 'System Orange', hex: '#FF9230', rgb: '255 149 0', rgbDark: '255 146 48' },
    green: { label: 'System Green', hex: '#30D158', rgb: '52 199 89', rgbDark: '48 209 88' },
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
    // Snow 設計：紙張式柔和長陰影（上方細邊＋下方大範圍淡陰影）
    sm: '0 1px 2px rgb(43 39 34 / 0.05)',
    DEFAULT: '0 1px 2px rgb(43 39 34 / 0.05), 0 8px 20px -12px rgb(43 39 34 / 0.18)',
    md: '0 1px 2px rgb(43 39 34 / 0.05), 0 14px 30px -18px rgb(43 39 34 / 0.24)',
    lg: '0 1px 2px rgb(43 39 34 / 0.05), 0 20px 44px -30px rgb(43 39 34 / 0.28)',
    xl: '0 16px 36px -14px rgb(43 39 34 / 0.22)',
    '2xl': '0 24px 50px -24px rgb(43 39 34 / 0.32)',
    inner: 'inset 0 1px 3px rgb(0 0 0 / 0.08)',
}

/**
 * 動畫（《Liquid Glass 元件規範》時間與曲線總表）
 *   只用兩條曲線：減速 cubic-bezier(.23,1,.32,1)、彈性 cubic-bezier(.32,.72,0,1)；不用加速曲線
 *   按壓 0.17 秒；舊頁淡出 0.2 秒；選單 0.3 秒；新頁進場 0.42 秒；進場從 0.95 開始；隨時可以打斷
 */
export const motion = {
    duration: {
        instant: '1ms',
        press: '170ms',
        fast: '200ms',
        normal: '300ms',
        medium: '420ms',
        slow: '600ms',
        spin: '1s',
        pulse: '2s',
    },
    durationSeconds: {
        press: 0.17,
        fast: 0.2,
        hover: 0.17,
        normal: 0.3,
        spring: 0.42,
        page: 0.42,
        slow: 0.6,
        menuIn: 0.25, // 選單、下拉打開
        menuOut: 0.15, // 選單、下拉收起（比打開快，點完立刻讓開）
    },
    /** 選單打開時從這個大小放大到 1（＋淡入），收起時縮回這個大小 */
    menuScale: 0.96,
    easing: {
        apple: 'cubic-bezier(0.23, 1, 0.32, 1)', // 減速
        appleSoft: 'cubic-bezier(0.32, 0.72, 0, 1)', // 彈性
        standard: 'cubic-bezier(0.23, 1, 0.32, 1)', // 舊的「先加速後減速」一律改成減速
        pulse: 'cubic-bezier(0.4, 0, 0.6, 1)', // 只給載入中的呼吸燈（循環動畫，不是切換）
        pop: 'cubic-bezier(0.32, 0.72, 0, 1)', // 舊的回彈過頭改成規範的彈性曲線
    },
    // GSAP 用的曲線：quint.out ＝ cubic-bezier(.23,1,.32,1)；沒有加速曲線（in／inOut 也對到減速）
    gsapEase: {
        default: 'quint.out',
        in: 'quint.out',
        out: 'quint.out',
        inOut: 'quint.out',
        spring: 'expo.out',
    },
    spring: {
        default: { type: 'spring', stiffness: 200, damping: 25, mass: 1 },
        snappy: { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 },
        gentle: { type: 'spring', stiffness: 120, damping: 22, mass: 1 },
    },
    fade: {
        type: 'tween',
        duration: 0.2,
        ease: [0.23, 1, 0.32, 1],
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
