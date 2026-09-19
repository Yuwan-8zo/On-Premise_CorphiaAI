import tokens from '../frontend/src/design-system/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
    // 掃描真實 frontend 的所有元件 + demo 本身的 src
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        '../frontend/src/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: tokens.palette,
            fontFamily: {
                sans: [
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
                press: tokens.motion.duration.press,
                fast: tokens.motion.duration.fast,
                normal: tokens.motion.duration.normal,
                medium: tokens.motion.duration.medium,
                slow: tokens.motion.duration.slow,
            },
            transitionTimingFunction: {
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
