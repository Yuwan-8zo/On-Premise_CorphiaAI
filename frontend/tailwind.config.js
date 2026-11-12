import tokens from './src/design-system/tokens.js'

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        /*
         * 斷點：lg（寬螢幕＝左右兩欄）不只看寬度，也看版面形狀——
         *   寬 1024 以上；或橫放、寬 768 以上、高 500 以上（iPhone Duo、iPad 橫放：寬約 1000 也該用寬版）。
         *   一般手機橫放高度只有 400 左右，仍用直版。其餘斷點維持 Tailwind 預設。
         */
        // 注意：lg 用了自訂的媒體查詢（raw），Tailwind 會因此停用所有 max-sm:／max-md: 這類寫法（寫了也不會產生樣式）。
        // 要「只在小螢幕」就寫成「預設值＋md:覆蓋」，例如 opacity-0 md:opacity-100
        screens: {
            sm: '640px',
            md: '768px',
            lg: { raw: '(min-width: 1024px), (orientation: landscape) and (min-width: 768px) and (min-height: 500px)' },
            xl: '1280px',
            '2xl': '1536px',
        },
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
