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
                corphia: {
                    bronze: '#896E53',
                    beige: '#DDD8D0',
                    sand: '#ECE8E1',
                    'warm-gray': '#807C76',
                    ivory: '#F6F4F0',
                    obsidian: '#202022',
                    espresso: '#28282A',
                    ink: '#2A2722',
                },
                primary: {
                    50: '#F7F5F2',
                    100: '#EDE8E2',
                    200: '#D9D0C6',
                    300: '#BFB1A1',
                    400: '#A08C78',
                    500: '#896E53',
                    600: '#6F5943',
                    700: '#574537',
                    800: '#3F342B',
                    900: '#2A2722',
                    950: '#202022',
                },
                bg: {
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
                },
                border: {
                    subtle: 'rgb(var(--border-subtle) / <alpha-value>)',
                    strong: 'rgb(var(--border-strong) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
                    hover: 'rgb(var(--accent-hover) / <alpha-value>)',
                    active: 'rgb(var(--accent-active) / <alpha-value>)',
                    soft: 'rgb(var(--accent-soft))',
                },
                ios: {
                    blue: {
                        light: 'rgb(var(--color-ios-accent-light) / <alpha-value>)',
                        dark: 'rgb(var(--color-ios-accent-dark) / <alpha-value>)',
                    },
                    light: {
                        gray1: '#8e8e93',
                        gray2: '#aeaeb2',
                        gray3: '#c7c7cc',
                        gray4: '#d1d1d6',
                        gray5: '#e5e5ea',
                        gray6: '#f2f2f7',
                    },
                    dark: {
                        gray1: '#8e8e93',
                        gray2: '#636366',
                        gray3: '#48484a',
                        gray4: '#3a3a3c',
                        gray5: '#2c2c2e',
                        gray6: '#1c1c1e',
                        black: '#000000',
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
            boxShadow: {
                'sm': '0 0 4px rgb(0 0 0 / 0.05)',
                DEFAULT: '0 0 8px rgb(0 0 0 / 0.08)',
                'md': '0 0 12px rgb(0 0 0 / 0.1)',
                'lg': '0 0 20px rgb(0 0 0 / 0.12)',
                'xl': '0 0 30px rgb(0 0 0 / 0.15)',
                '2xl': '0 0 50px rgb(0 0 0 / 0.25)',
                'inner': 'inset 0 0 6px rgb(0 0 0 / 0.1)',
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
