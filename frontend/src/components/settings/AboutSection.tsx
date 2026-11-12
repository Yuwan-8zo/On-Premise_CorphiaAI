/**
 * 關於（Apple「關於本機」風格）：置中 App 圖示＋名稱＋版本，下面一組「左標籤、右數值」的清單，最下方版權說明
 * 樣式用 snow.css 的 .set-*（設定頁共用）
 *
 * 「桌面版」區塊（要不要顯示在畫面一出來就決定，不會之後才冒出來把版面往下推）：
 *   - 在桌面版裡：顯示已安裝的版本
 *   - Windows 電腦的瀏覽器：下載入口（版本、大小、下載鈕）；伺服器上還沒有安裝檔就寫明
 *   - 手機、平板、其他系統：不顯示（安裝檔只有 Windows 版）
 * 版本、大小還沒讀到時用同格式的灰色佔位。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from '@/components/snow/icons'
import { SkelText } from '@/components/ui/Skeleton'
import { desktop, desktopRelease, useDesktop, type DesktopRelease } from '@/lib/desktop'
import { formatBytes } from '@/lib/formatBytes'
import { CorphiaLogoSymbol } from '../icons/CorphiaIcons'

/** 這台裝置能不能安裝桌面版（安裝檔只有 Windows 版） */
const IS_WINDOWS = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

export default function AboutSection() {
    const { t } = useTranslation()
    const isDesktop = useDesktop()
    const showDesktop = isDesktop || IS_WINDOWS
    /** 伺服器上的安裝檔；undefined＝還在讀 */
    const [release, setRelease] = useState<DesktopRelease | undefined>(undefined)
    /** 桌面版裡：已安裝的版本；空字串＝還在讀 */
    const [installed, setInstalled] = useState('')

    useEffect(() => {
        if (!showDesktop) return
        let stale = false
        if (isDesktop) {
            desktop.info().then((info) => { if (!stale) setInstalled(info.version) }).catch(() => { if (!stale) setInstalled('—') })
        } else {
            desktopRelease.latest()
                .then((r) => { if (!stale) setRelease(r) })
                .catch(() => { if (!stale) setRelease({ available: false, version: '' }) })
        }
        return () => { stale = true }
    }, [showDesktop, isDesktop])

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

            {showDesktop && (
                <section className="set-section">
                    <div className="set-header">{t('about.desktopHeader')}</div>
                    <div className="set-group">
                        {isDesktop ? (
                            <div className="set-row">
                                <span className="set-label">{t('about.desktopInstalled')}</span>
                                <span className="set-value tabular-nums">{installed || <SkelText>0.0.0</SkelText>}</span>
                            </div>
                        ) : (
                            <div className="set-row">
                                <span className="set-label">
                                    {t('about.desktopLabel')}
                                    <span className="set-sub tabular-nums">
                                        {release === undefined
                                            ? <SkelText>{t('about.desktopSub', { version: '0.0.0', size: '00.0 MB' })}</SkelText>
                                            : release.available
                                                ? t('about.desktopSub', { version: release.version, size: formatBytes(release.size ?? 0) })
                                                : t('about.desktopNone')}
                                    </span>
                                </span>
                                {release?.available && (
                                    <a href={desktopRelease.downloadUrl()} download className="btn btn-sm btn-primary flex-shrink-0" aria-label={t('about.desktopDownloadAria')}>
                                        <Download className="h-4 w-4" />
                                        {t('about.desktopDownload')}
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="set-footer">{t('about.desktopHint')}</p>
                </section>
            )}

            <p className="set-footer text-center mt-6">{t('about.copyright', { year: new Date().getFullYear() })}</p>
        </div>
    )
}
