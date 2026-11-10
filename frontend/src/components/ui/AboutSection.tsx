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
                <div className="w-20 h-20 rounded-[18px] set-group flex items-center justify-center mb-2">
                    <CorphiaLogoSymbol className="w-12 h-12" />
                </div>
                <h2 className="text-[22px] leading-[28px] font-bold text-text-primary">Corphia AI Platform</h2>
                <p className="text-[15px] text-text-secondary">{t('about.version')} 2.3.0</p>
            </div>

            <section className="set-section">
                {/* 「系統穩定」標籤（24 高、半徑 12）跟卡片角（32）同心：離右、離上都是 20 */}
                <div className="set-group pt-[10px]">
                    <div className="set-row !pr-[20px]">
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

            <p className="set-footer text-center mt-6">{t('about.copyright')}</p>
        </div>
    )
}
