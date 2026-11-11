/**
 * 設定 › 主題（Apple：外觀預覽圖三選一、強調顏色）
 */
import { useTranslation } from 'react-i18next'
import { ACCENT_COLORS } from '@/design-system'
import { useUIStore, type AccentColorType } from '@/store/uiStore'

const ACCENT_OPTIONS = Object.entries(ACCENT_COLORS) as [AccentColorType, (typeof ACCENT_COLORS)[string]][]
const MODES = ['light', 'dark', 'system'] as const
type Mode = (typeof MODES)[number]

export default function AppearanceSection() {
    const { t } = useTranslation()
    const { accentColor, setAccentColor, themePreference, setThemePreference } = useUIStore()
    const modeLabel = (mode: Mode) =>
        mode === 'light' ? t('settings.themeLight') : mode === 'dark' ? t('settings.themeDark') : t('settings.themeSystem')

    return (
        <>
            <h2 className="set-title">{t('settings.theme')}</h2>

            <section className="set-section">
                <div className="set-header">{t('settings.appearanceSection', '外觀')}</div>
                {/* 外觀卡：同其他多列分組 32；內距 14，縮圖同心 32−14＝18（見 .set-thumb） */}
                <div className="set-group p-4">
                    <div className="flex gap-4">
                        {MODES.map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                aria-pressed={themePreference === mode}
                                onClick={() => setThemePreference(mode)}
                                className={`set-appearance ${themePreference === mode ? 'is-current' : ''}`}
                            >
                                <span className="set-thumb">
                                    <AppearancePreview mode={mode} />
                                </span>
                                {modeLabel(mode)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="set-section">
                <div className="set-group !rounded-full">
                    {/* 右內距 12：膠囊高 56，最後一顆色點（32 的按鈕）圓心離右緣 28＝膠囊半圓的圓心，同心 */}
                    <div className="set-row !pr-[var(--sp-12)]">
                        <span className="set-label">{t('settings.accentColor', '強調顏色')}</span>
                        <div className="flex items-center gap-1">
                            {ACCENT_OPTIONS.map(([key, color]) => (
                                <button
                                    key={key}
                                    type="button"
                                    aria-label={color.label}
                                    aria-pressed={accentColor === key}
                                    onClick={() => setAccentColor(key)}
                                    className={`set-swatch ${accentColor === key ? 'is-current' : ''}`}
                                >
                                    <span style={{ backgroundColor: color.hex }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}

/** 外觀預覽圖（Apple 系統設定的迷你視窗）：淺色、深色、自動（左右各半） */
function AppearancePreview({ mode }: { mode: Mode }) {
    const win = (dark: boolean) => {
        const page = dark ? '#000000' : '#F2F2F7'
        const card = dark ? '#1C1C1E' : '#FFFFFF'
        return (
            <span className="absolute inset-0 block" style={{ background: page }}>
                {/* 側欄 */}
                <span className="absolute left-[8%] top-[12%] bottom-[12%] w-[24%] rounded-[var(--r-5)]" style={{ background: card }} />
                {/* 內容卡 */}
                <span className="absolute left-[36%] right-[8%] top-[12%] h-[34%] rounded-[var(--r-5)]" style={{ background: card }} />
                <span className="absolute left-[36%] right-[8%] top-[52%] bottom-[12%] rounded-[var(--r-5)]" style={{ background: card }} />
                {/* 強調色按鈕 */}
                <span className="absolute left-[42%] top-[22%] w-[22%] h-[12%] rounded-full" style={{ background: 'rgb(var(--accent))' }} />
            </span>
        )
    }
    if (mode !== 'system') return win(mode === 'dark')
    return (
        <>
            {win(false)}
            <span className="absolute inset-0 block" style={{ clipPath: 'inset(0 0 0 50%)' }}>{win(true)}</span>
        </>
    )
}
