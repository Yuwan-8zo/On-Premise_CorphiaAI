/**
 * 設定 › 語言（Apple：勾選清單）
 */
import { useTranslation } from 'react-i18next'
import { Check } from '@/components/snow/icons'
import { LANGUAGES } from '@/i18n/languages'
import { useUIStore } from '@/store/uiStore'

export default function LanguageSection() {
    const { t } = useTranslation()
    const { language, setLanguage } = useUIStore()

    return (
        <>
            <h2 className="set-title">{t('settings.language')}</h2>
            <section className="set-section">
                <div className="set-group" role="radiogroup" aria-label={t('settings.language')}>
                    {LANGUAGES.map((lang) => {
                        const on = language === lang.code
                        return (
                            <button
                                key={lang.code}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => setLanguage(lang.code)}
                                className="set-row set-row-btn"
                            >
                                <span className="set-label">{lang.label}</span>
                                {on && <Check className="w-[var(--sz-18)] h-[var(--sz-18)] text-accent" />}
                            </button>
                        )
                    })}
                </div>
            </section>
        </>
    )
}
