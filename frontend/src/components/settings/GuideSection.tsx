/**
 * 使用說明（Apple「使用技巧」風格的分組清單）
 *   頁面標題＋一句說明 → 「重新觀看引導」膠囊 → 依使用者要做的事分組：
 *   開始對話／讓 AI 幫你做更多（記憶、風格、做檔案、搜尋、桌面版）／用你的文件回答問題（編號步驟）／管理對話／資料安全／帳號與權限
 *   每列＝彩色圓形圖示（Apple 系統色，半徑 15、離左 16、垂直置中，跟卡片角 32 同心）＋標題（15／20 半粗）＋白話說明（13／18 次要字）
 *   樣式用 snow.css 的 .set-*（設定頁共用）
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Lock, MessageSquare, Mic, MoreHorizontal, Play, Reader, Share, Shield, ShieldCheck, User, UserRoundCog, Users, Cpu, Server,
    Sparkles, FileText, Search, SlidersHorizontal, Layers3, Palette,
} from '@/components/snow/icons'

import { resetOnboarding } from '@/components/onboarding/onboardingFlag'
import { useUIStore } from '@/store/uiStore'

type Tone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal'

/** 一列：彩色圖示方塊＋標題＋說明 */
function TipRow({ icon, tone, title, desc }: { icon: ReactNode; tone: Tone; title: string; desc: string }) {
    return (
        <div className="set-row has-icon !pl-[var(--sp-16)]">
            <span
                className="set-icon !rounded-full text-white"
                style={{ background: `var(--sys-${tone})` }}
                aria-hidden
            >
                {icon}
            </span>
            <span className="set-label">
                <span className="block text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary">{title}</span>
                <span className="mt-[var(--sp-2)] block text-[length:var(--fs-13)] leading-[var(--lh-18)] text-text-secondary">{desc}</span>
            </span>
        </div>
    )
}

export default function GuideSection() {
    const { t } = useTranslation()
    const triggerOnboardingReplay = useUIStore((s) => s.triggerOnboardingReplay)
    const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

    function handleReplayOnboarding() {
        // 清旗標＋觸發重播，並關掉設定視窗讓聊天頁看得到引導
        resetOnboarding()
        setSettingsOpen(false)
        setTimeout(() => triggerOnboardingReplay(), 200)
    }

    const ic = 'w-[var(--sz-16)] h-[var(--sz-16)]'
    const steps = [t('guide.project.step1'), t('guide.project.step2'), t('guide.project.step3'), t('guide.project.step4')]

    return (
        <div className="set-page">
            <h2 className="set-title">{t('guide.title')}</h2>
            <p className="-mt-[var(--sp-14)] mb-[var(--sp-26)] text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-secondary">{t('guide.subtitle')}</p>

            {/* 重新觀看引導：單列膠囊 */}
            <section className="set-section">
                <div className="set-group">
                    <button type="button" onClick={handleReplayOnboarding} className="set-row set-row-btn has-icon">
                        <span className="set-icon text-accent"><Play className="w-[var(--sz-16)] h-[var(--sz-16)] -translate-x-[var(--sp-0d5)]" /></span>
                        <span className="set-label text-accent font-semibold">{t('settings.replayTour', '重新觀看引導')}</span>
                    </button>
                </div>
            </section>

            {/* 開始對話 */}
            <section className="set-section">
                <div className="set-header">{t('guide.chat.title')}</div>
                <div className="set-group guide-group">
                    <TipRow tone="blue" icon={<MessageSquare className={ic} />} title={t('guide.chat.newTitle')} desc={t('guide.chat.newDesc')} />
                    <TipRow tone="orange" icon={<Reader className={ic} />} title={t('guide.chat.promptTitle')} desc={t('guide.chat.promptDesc')} />
                    <TipRow tone="red" icon={<Mic className={ic} />} title={t('guide.chat.voiceTitle')} desc={t('guide.chat.voiceDesc')} />
                    <TipRow tone="purple" icon={<Cpu className={ic} />} title={t('guide.chat.modelTitle')} desc={t('guide.chat.modelDesc')} />
                </div>
            </section>

            {/* 讓 AI 幫你做更多：記憶、風格、做檔案、搜尋、專案指示、桌面版 */}
            <section className="set-section">
                <div className="set-header">{t('guide.more.title')}</div>
                <div className="set-group guide-group">
                    <TipRow tone="purple" icon={<Sparkles className={ic} />} title={t('guide.more.memoryTitle')} desc={t('guide.more.memoryDesc')} />
                    <TipRow tone="teal" icon={<Palette className={ic} />} title={t('guide.more.styleTitle')} desc={t('guide.more.styleDesc')} />
                    <TipRow tone="blue" icon={<FileText className={ic} />} title={t('guide.more.fileTitle')} desc={t('guide.more.fileDesc')} />
                    <TipRow tone="orange" icon={<Search className={ic} />} title={t('guide.more.searchTitle')} desc={t('guide.more.searchDesc')} />
                    <TipRow tone="green" icon={<SlidersHorizontal className={ic} />} title={t('guide.more.projectTitle')} desc={t('guide.more.projectDesc')} />
                    <TipRow tone="red" icon={<Layers3 className={ic} />} title={t('guide.more.desktopTitle')} desc={t('guide.more.desktopDesc')} />
                </div>
            </section>

            {/* 用你的文件回答問題：編號步驟 */}
            <section className="set-section">
                <div className="set-header">{t('guide.project.title')}</div>
                <div className="set-group guide-group">
                    {steps.map((step, i) => (
                        <div key={i} className="set-row has-icon !pl-[var(--sp-16)] !py-[var(--sp-16)]">
                            <span className="set-icon !rounded-full bg-[color-mix(in_srgb,var(--sys-blue)_18%,transparent)] text-[var(--ink-blue)] text-[length:var(--fs-13)] font-bold tabular-nums">
                                {i + 1}
                            </span>
                            <span className="set-label text-[length:var(--fs-15)] leading-[var(--lh-20)] text-text-primary">{step}</span>
                        </div>
                    ))}
                </div>
                <p className="set-footer">{t('guide.project.footer')}</p>
            </section>

            {/* 管理對話 */}
            <section className="set-section">
                <div className="set-header">{t('guide.manage.title')}</div>
                <div className="set-group guide-group">
                    <TipRow tone="teal" icon={<MoreHorizontal className={ic} />} title={t('guide.manage.menuTitle')} desc={t('guide.manage.menuDesc')} />
                    <TipRow tone="green" icon={<ShieldCheck className={ic} />} title={t('guide.manage.verifyTitle')} desc={t('guide.manage.verifyDesc')} />
                    <TipRow tone="blue" icon={<Share className={ic} />} title={t('guide.manage.shareTitle')} desc={t('guide.manage.shareDesc')} />
                </div>
            </section>

            {/* 資料安全 */}
            <section className="set-section">
                <div className="set-header">{t('guide.security.title')}</div>
                <div className="set-group guide-group">
                    <TipRow tone="green" icon={<Server className={ic} />} title={t('guide.security.localTitle')} desc={t('guide.security.localDesc')} />
                    <TipRow tone="orange" icon={<Lock className={ic} />} title={t('guide.security.piiTitle')} desc={t('guide.security.piiDesc')} />
                    <TipRow tone="red" icon={<Shield className={ic} />} title={t('guide.security.blockTitle')} desc={t('guide.security.blockDesc')} />
                    <TipRow tone="blue" icon={<ShieldCheck className={ic} />} title={t('guide.security.checkTitle')} desc={t('guide.security.checkDesc')} />
                </div>
            </section>

            {/* 帳號與權限 */}
            <section className="set-section">
                <div className="set-header">{t('guide.roles.title')}</div>
                <div className="set-group guide-group">
                    <TipRow tone="blue" icon={<User className={ic} />} title={t('guide.roles.user')} desc={t('guide.roles.userDesc')} />
                    <TipRow tone="purple" icon={<UserRoundCog className={ic} />} title={t('guide.roles.engineer')} desc={t('guide.roles.engineerDesc')} />
                    <TipRow tone="orange" icon={<Users className={ic} />} title={t('guide.roles.admin')} desc={t('guide.roles.adminDesc')} />
                </div>
            </section>
        </div>
    )
}

