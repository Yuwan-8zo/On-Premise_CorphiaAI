/**
 * 關於（Apple「關於本機」風格）：置中 App 圖示＋名稱＋版本，下面一組「左標籤、右數值」的清單，最下方版權說明
 * 樣式用 snow.css 的 .set-*（設定頁共用）
 */
import { useTranslation } from 'react-i18next'
import { CorphiaLogoSymbol } from '../icons/CorphiaIcons'

export default function AboutSection() {
    const { t } = useTranslation()

    const rows: [string, string][] = [
        [t('about.frontend'), 'React + FastAPI'],
        [t('about.inference'), 'llama.cpp'],
        [t('about.vector'), 'pgvector'],
        [t('about.dataCore'), 'PostgreSQL'],
    ]

    return (
        <div className="set-page">
            <div className="set-section set-hero">
                <div className="w-20 h-20 rounded-[var(--r-18)] set-group flex items-center justify-center mb-2">
                    <CorphiaLogoSymbol className="w-12 h-12 text-text-primary" color="currentColor" />
                </div>
                <h2 className="text-[length:var(--fs-22)] leading-[var(--lh-28)] font-bold text-text-primary">Corphia AI Platform</h2>
                <p className="text-[length:var(--fs-15)] text-text-secondary">{t('about.version')} 2.3.0</p>
            </div>

            <section className="set-section">
                {/* 「系統穩定」標籤（半徑 12）離右 20、離上 20，跟卡片角 32 同心 */}
                <div className="set-group pt-[var(--sp-8)]">
                    <div className="set-row">
                        <span className="set-label">{t('about.statusLabel', '系統狀態')}</span>
                        <span className="tag tag-green">{t('about.systemStable')}</span>
                    </div>
                    {rows.map(([label, value]) => (
                        <div key={label} className="set-row">
                            <span className="set-label">{label}</span>
                            <span className="set-value">{value}</span>
                        </div>
                    ))}
                </div>
                <p className="set-footer">{t('about.description')}</p>
            </section>

            <p className="set-footer text-center mt-6">{t('about.copyright', { year: new Date().getFullYear() })}</p>
        </div>
    )
}
