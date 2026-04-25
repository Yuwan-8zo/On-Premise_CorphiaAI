/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Corphia AI Brand Palette
                corphia: {
                    // --- New Enterprise Palette ---
                    // Primary
                    bronze: '#8B7355',
                    'bronze-hover': '#7A6348',
                    'bronze-active': '#6B563E',
                    // Backgrounds
                    main: '#EBE8E2',
                    card: '#F4F2EC',
                    sidebar: '#E2DED6',
                    // Inputs
                    'input-bg': '#EDEAE4',
                    'input-border': '#D6D2CA',
                    // Icons
                    'icon-bg': '#E2DED6',
                    // Text
                    ink: '#36312D',
                    'text-body': '#6D6761',
                    'text-helper': '#9E9790',

                    // --- Legacy Dark Mode / Fallbacks ---
                    beige: '#E0D9D3',
                    sand: '#F9F8F6',
                    ivory: '#FFFFFF',
                    obsidian: '#1E1A18',
                    espresso: '#2D2824',
                },
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#94785A', // Overriding 500 to our bronze for any stray components
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
                },
                // Apple iOS System Palette
                ios: {
                    blue: {
                        light: 'rgb(var(--color-ios-accent-light) / <alpha-value>)',
                        dark: 'rgb(var(--color-ios-accent-dark) / <alpha-value>)',
                    },
                    // 淺色模式系統灰
                    light: {
                        gray1: '#8e8e93', // 142,142,147
                        gray2: '#aeaeb2', // 174,174,178
                        gray3: '#c7c7cc', // 199,199,204
                        gray4: '#d1d1d6', // 209,209,214
                        gray5: '#e5e5ea', // 229,229,234
                        gray6: '#f2f2f7', // 242,242,247
                    },
                    // 深色模式系統灰
                    dark: {
                        gray1: '#8e8e93', // 142,142,147
                        gray2: '#636366', // 99,99,102
                        gray3: '#48484a', // 72,72,74
                        gray4: '#3a3a3c', // 58,58,60
                        gray5: '#2c2c2e', // 44,44,46
                        gray6: '#1c1c1e', // 28,28,30
                        black: '#000000', // OLED Black
                    }
                },
            },
            fontFamily: {
                sans: ['Inter', 'Noto Sans TC', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'card-sm': '22px',
                'card-md': '30px',
                'card-lg': '34px',
                'card-xl': '38px',
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
                }
            },
            animation: {
                'typing-bounce': 'typing-bounce 1s infinite',
                'draw-c': 'draw-c-path 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                'pop-spark': 'pop-spark 2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite',
            }
        },
    },
    plugins: [],
}
