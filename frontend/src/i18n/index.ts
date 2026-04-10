/**
 * i18n 國際化設定
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 翻譯資源
import zhTW from './locales/zh-TW'
import enUS from './locales/en-US'

// 取得儲存的語言或使用預設
const savedLanguage = localStorage.getItem('ui-storage')
const defaultLanguage = savedLanguage
    ? JSON.parse(savedLanguage).state?.language || 'zh-TW'
    : 'zh-TW'

i18n
    .use(initReactI18next)
    .init({
        resources: {
            'zh-TW': { translation: zhTW },
            'en-US': { translation: enUS },
        },
        lng: defaultLanguage,
        fallbackLng: 'zh-TW',
        interpolation: {
            escapeValue: false,
        },
    })

export default i18n
