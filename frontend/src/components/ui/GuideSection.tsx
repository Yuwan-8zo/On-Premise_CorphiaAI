/**
 * 使用說明（Apple 設定的分組清單）：頁面標題＋說明；每個主題一組，組名在卡片上方，條目是一列一列的清單
 * 「重新觀看引導」是一列可點的動作列（強調色文字），放在最上面一組
 * 樣式用 snow.css 的 .set-*（設定頁共用）
 */
import { Sparkles } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'

import { resetOnboarding } from '@/components/onboarding/OnboardingTour'
import { useUIStore } from '@/store/uiStore'

export default function GuideSection() {
    const { t } = useTranslation()
    const triggerOnboardingReplay = useUIStore((s) => s.triggerOnboardingReplay)
    const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

    function handleReplayOnboarding() {
        // 清旗標 + 觸發 replay token，並關掉 settings modal 讓 chat 看得到 tour
        resetOnboarding()
        setSettingsOpen(false)
        setTimeout(() => triggerOnboardingReplay(), 200)
    }

    const roles: [string, string][] = [
        ['Engineer', t('guide.auth.engineer')],
        ['Admin', t('guide.auth.admin')],
        ['User', t('guide.auth.user')],
    ]

    return (
        <div className="set-page">
            <h2 className="set-title">{t('guide.title')}</h2>

            <section className="set-section">
                <div className="set-group">
                    <button type="button" onClick={handleReplayOnboarding} className="set-row set-row-btn has-icon">
                        <span className="set-icon text-accent"><Sparkles className="w-[18px] h-[18px]" /></span>
                        <span className="set-label text-accent">{t('settings.replayTour', '重新觀看引導')}</span>
                    </button>
                </div>
                <p className="set-footer">{t('guide.subtitle')}</p>
            </section>

            {/* 一、權限管理與角色 */}
            <section className="set-section">
                <div className="set-header">{t('guide.auth.title')}</div>
                <div className="set-group">
                    {roles.map(([role, desc]) => (
                        <div key={role} className="set-row !items-start">
                            <span className="w-[84px] flex-none font-semibold">{role}</span>
                            <span className="flex-1 min-w-0 text-[14px] leading-[20px] text-text-secondary">{desc}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* 二、專案模式與知識庫 */}
            <section className="set-section">
                <div className="set-header">{t('guide.project.title')}</div>
                <div className="set-group">
                    {[
                        t('guide.project.step1'),
                        <>{t('guide.project.step2Start')} <strong className="text-text-primary">{t('guide.project.step2Types')}</strong> {t('guide.project.step2End')}</>,
                        t('guide.project.step3'),
                        t('guide.project.step4'),
                    ].map((step, i) => (
                        <div key={i} className="set-row !items-start">
                            <span className="w-[22px] h-[22px] flex-none rounded-full bg-[var(--chip)] text-[12px] font-semibold flex items-center justify-center">{i + 1}</span>
                            <span className="flex-1 min-w-0 text-[14px] leading-[20px] text-text-secondary">{step}</span>
                        </div>
                    ))}
                </div>
                <p className="set-footer">
                    {t('guide.project.descStart')} <strong className="text-text-primary">{t('guide.project.mode')}</strong>{t('guide.project.descEnd')}
                </p>
            </section>

            {/* 三、對話與介面操作技巧 */}
            <section className="set-section">
                <div className="set-header">{t('guide.chat.title')}</div>
                <div className="set-group">
                    <div className="set-row">
                        <span className="set-label">
                            {t('guide.chat.minimapTitle')}
                            <span className="set-sub">
                                {t('guide.chat.minimapDescStart')}<strong className="text-accent">{t('guide.chat.minimapDescHighlight')}</strong> {t('guide.chat.minimapDescEnd')}
                            </span>
                        </span>
                    </div>
                    <div className="set-row">
                        <span className="set-label">
                            {t('guide.chat.scrollBottomTitle')}
                            <span className="set-sub">{t('guide.chat.scrollBottomDesc')}</span>
                        </span>
                    </div>
                    <div className="set-row">
                        <span className="set-label">
                            {t('guide.chat.renameTitle')}
                            <span className="set-sub">{t('guide.chat.renameDesc')}</span>
                        </span>
                    </div>
                </div>
            </section>
        </div>
    )
}
