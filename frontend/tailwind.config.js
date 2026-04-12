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
                // Corphia Brand Indigo/Violet - 更具高階 AI 科技感的專屬主色調
                primary: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1', // Main brand
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                },
                corphia: {
                    dark: '#0A0F1C', // 帶有深邃藍紫調的黑，不使用 ChatGPT 的平淡純灰黑
                    card: '#131B2B', // 暗色模式的卡片底色
                    light: '#F8FAFC', // 帶有極微弱冷色調的白
                }
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
        },
    },
    plugins: [],
}
