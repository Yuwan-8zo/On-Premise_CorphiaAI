import tokens from './src/design-system/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: tokens.palette,
            fontFamily: {
                sans: [
                    '"Noto Sans TC"',
                    '"Source Han Sans TC"',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"SF Pro Text"',
                    '"SF Pro Display"',
                    'Inter',
                    '"Noto Sans TC"',
                    'system-ui',
                    'sans-serif',
                ],
            },
            borderRadius: tokens.radius,
            fontSize: tokens.fontSize,
            boxShadow: tokens.boxShadow,
            transitionDuration: {
                DEFAULT: tokens.motion.duration.fast,
                press: tokens.motion.duration.press,
                fast: tokens.motion.duration.fast,
                normal: tokens.motion.duration.normal,
                medium: tokens.motion.duration.medium,
                slow: tokens.motion.duration.slow,
            },
            // 規範不用加速曲線：Tailwind 的 ease-in／ease-in-out 也覆寫成減速
            transitionTimingFunction: {
                DEFAULT: tokens.motion.easing.apple,
                in: tokens.motion.easing.apple,
                'in-out': tokens.motion.easing.apple,
                out: tokens.motion.easing.apple,
                apple: tokens.motion.easing.apple,
                'apple-soft': tokens.motion.easing.appleSoft,
                standard: tokens.motion.easing.standard,
                pop: tokens.motion.easing.pop,
            },
            keyframes: tokens.motion.keyframes,
            animation: tokens.motion.animation,
        },
    },
    plugins: [],
}
