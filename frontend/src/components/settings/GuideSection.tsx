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
    Bookmark, FileText, Search, SlidersHorizontal, Layers3, Palette,
} from '@/components/snow/icons'

import { resetOnboarding } from '@/components/onboarding/onboardingFlag'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { CHAT_HOTKEYS } from '@/features/chat/hooks/useChatHotkeys'

/** 按鍵的寫法：Mac 的修飾鍵一律用符號（⌘ ⇧ ⌥，和 Mac 選單一樣），其他系統用英文字（Ctrl Shift Alt） */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MAC_KEYS: Record<string, string> = { mod: '⌘', Shift: '⇧', Alt: '⌥' }
export const keyLabel = (k: string, mac = IS_MAC) => {
    if (mac) return MAC_KEYS[k] ?? k
    return k === 'mod' ? 'Ctrl' : k
}

/** 有實體鍵盤（滑鼠等精確指標）才講 Enter／Shift＋Enter；手機上沒有這些鍵 */
const HAS_KEYBOARD = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

/** 一列：圖示＋標題＋說明。圖示一律灰底、強調色（以前每列一種彩色實心圓，藍橘紅紫綠像彩虹，沒有一個是重點） */
function TipRow({ icon, title, desc }: Readonly<{ icon: ReactNode; title: string; desc: string }>) {
    return (
        <div className="set-row has-icon !pl-[var(--sp-16)]">
            <span className="set-icon !rounded-full bg-[var(--chip)] text-accent" aria-hidden>
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
    const userId = useAuthStore((s) => s.user?.id)

    function handleReplayOnboarding() {
        // 清旗標＋觸發重播，並關掉設定視窗讓聊天頁看得到引導
        resetOnboarding(userId)
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
                        <span className="set-label text-accent font-semibold">{t('settings.replayTour')}</span>
                    </button>
                </div>
            </section>

            {/* 開始對話 */}
            <section className="set-section">
                <div className="set-header">{t('guide.chat.title')}</div>
                <div className="set-group guide-group">
                    <TipRow icon={<MessageSquare className={ic} />} title={t('guide.chat.newTitle')} desc={t('guide.chat.newDesc') + (HAS_KEYBOARD ? t('guide.chat.newKeys') : '')} />
                    <TipRow icon={<Reader className={ic} />} title={t('guide.chat.promptTitle')} desc={t('guide.chat.promptDesc')} />
                    <TipRow icon={<Mic className={ic} />} title={t('guide.chat.voiceTitle')} desc={t('guide.chat.voiceDesc')} />
                    <TipRow icon={<Cpu className={ic} />} title={t('guide.chat.modelTitle')} desc={t('guide.chat.modelDesc')} />
                </div>
            </section>

            {/* 鍵盤快捷鍵：有實體鍵盤才顯示（清單和 hooks/useChatHotkeys.ts 同一份） */}
            {HAS_KEYBOARD && (
                <section className="set-section">
                    <div className="set-header">{t('guide.hotkeys.title')}</div>
                    <div className="set-group guide-group">
                        {CHAT_HOTKEYS.map((h) => (
                            <div key={h.id} className="set-row">
                                <span className="set-label">{t(`guide.hotkeys.${h.id}`)}</span>
                                <span className="flex gap-[var(--sp-4)] shrink-0">
                                    {h.keys.map((k) => <kbd key={k} className="kbd">{keyLabel(k)}</kbd>)}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 讓 AI 幫你做更多：記憶、風格、做檔案、搜尋、專案指示、桌面版 */}
            <section className="set-section">
                <div className="set-header">{t('guide.more.title')}</div>
                <div className="set-group guide-group">
                    <TipRow icon={<Bookmark className={ic} />} title={t('guide.more.memoryTitle')} desc={t('guide.more.memoryDesc')} />
                    <TipRow icon={<Palette className={ic} />} title={t('guide.more.styleTitle')} desc={t('guide.more.styleDesc')} />
                    <TipRow icon={<FileText className={ic} />} title={t('guide.more.fileTitle')} desc={t('guide.more.fileDesc')} />
                    <TipRow icon={<Search className={ic} />} title={t('guide.more.searchTitle')} desc={t('guide.more.searchDesc')} />
                    <TipRow icon={<SlidersHorizontal className={ic} />} title={t('guide.more.projectTitle')} desc={t('guide.more.projectDesc')} />
                    <TipRow icon={<Layers3 className={ic} />} title={t('guide.more.desktopTitle')} desc={t('guide.more.desktopDesc')} />
                </div>
            </section>

            {/* 用你的文件回答問題：編號步驟 */}
            <section className="set-section">
                <div className="set-header">{t('guide.project.title')}</div>
                <div className="set-group guide-group">
                    {steps.map((step, i) => (
                        <div key={i} className="set-row has-icon !pl-[var(--sp-16)] !py-[var(--sp-16)]">
                            <span className="set-icon !rounded-full bg-[var(--chip)] text-accent text-[length:var(--fs-13)] font-semibold tabular-nums">
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
                    <TipRow icon={<MoreHorizontal className={ic} />} title={t('guide.manage.menuTitle')} desc={t('guide.manage.menuDesc')} />
                    <TipRow icon={<ShieldCheck className={ic} />} title={t('guide.manage.verifyTitle')} desc={t('guide.manage.verifyDesc')} />
                    <TipRow icon={<Share className={ic} />} title={t('guide.manage.shareTitle')} desc={t('guide.manage.shareDesc')} />
                </div>
            </section>

            {/* 資料安全 */}
            <section className="set-section">
                <div className="set-header">{t('guide.security.title')}</div>
                <div className="set-group guide-group">
                    <TipRow icon={<Server className={ic} />} title={t('guide.security.localTitle')} desc={t('guide.security.localDesc')} />
                    <TipRow icon={<Lock className={ic} />} title={t('guide.security.piiTitle')} desc={t('guide.security.piiDesc')} />
                    <TipRow icon={<Shield className={ic} />} title={t('guide.security.blockTitle')} desc={t('guide.security.blockDesc')} />
                    <TipRow icon={<ShieldCheck className={ic} />} title={t('guide.security.checkTitle')} desc={t('guide.security.checkDesc')} />
                </div>
            </section>

            {/* 帳號與權限 */}
            <section className="set-section">
                <div className="set-header">{t('guide.roles.title')}</div>
                <div className="set-group guide-group">
                    <TipRow icon={<User className={ic} />} title={t('guide.roles.user')} desc={t('guide.roles.userDesc')} />
                    <TipRow icon={<UserRoundCog className={ic} />} title={t('guide.roles.engineer')} desc={t('guide.roles.engineerDesc')} />
                    <TipRow icon={<Users className={ic} />} title={t('guide.roles.admin')} desc={t('guide.roles.adminDesc')} />
                </div>
            </section>
        </div>
    )
}

