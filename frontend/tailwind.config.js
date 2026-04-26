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
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#896E53',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
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
