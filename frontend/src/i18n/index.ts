/**
 * i18n 國際化設定
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 翻譯資源
import zhTW from './locales/zh-TW'
import enUS from './locales/en-US'
import jaJP from './locales/ja-JP'

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
            'ja-JP': { translation: jaJP },
        },
        lng: defaultLanguage,
        fallbackLng: 'zh-TW',
        interpolation: {
            escapeValue: false,
        },
    })

// 網頁宣告的語言跟著介面語言（螢幕閱讀器用對的發音、瀏覽器斷字正確）
const syncHtmlLang = (lng: string) => { document.documentElement.lang = lng }
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
