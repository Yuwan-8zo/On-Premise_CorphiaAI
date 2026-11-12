/**
 * DesktopUpdateNotice — 桌面版有新版本時的提示（只在桌面版裡出現）
 *
 *   桌面版啟動後會在背景向公司伺服器問最新版本（不連外網）；這裡過幾秒去問小幫手結果，
 *   有新版就在右下角顯示一張小卡片：「更新」＝下載、核對、關閉後換成新版再自動開啟；「稍後」＝這次先不提醒
 *   沒有新版、問不到、不是桌面版：什麼都不顯示
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { desktop, useDesktop } from '@/lib/desktop'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'

/** 啟動後多久去問有沒有新版（毫秒）：第一次等背景檢查做完，第二次補問一次（伺服器回得慢的時候） */
const CHECK_DELAYS_MS = [4000, 20000]

export default function DesktopUpdateNotice() {
    const { t } = useTranslation()
    const isDesktop = useDesktop()
    const toast = useToastStore((s) => s.add)
    const [latest, setLatest] = useState<string | null>(null)
    const [current, setCurrent] = useState('')
    const [busy, setBusy] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (!isDesktop) return
        const timers = CHECK_DELAYS_MS.map((ms) =>
            window.setTimeout(() => {
                desktop.info().then((info) => {
                    setCurrent(info.version)
                    if (info.update) setLatest(info.update.version)
                }).catch(() => undefined)
            }, ms),
        )
        return () => timers.forEach((id) => window.clearTimeout(id))
    }, [isDesktop])

    if (!isDesktop || !latest || dismissed) return null

    const update = async () => {
        setBusy(true)
        try {
            await desktop.update()
            toast(t('ui.office.updating'), 'success')
        } catch (err) {
            toast(getErrorMessage(err), 'error')
            setBusy(false)
        }
    }

    return (
        <div role="status" className="fixed bottom-[var(--sp-16)] right-[var(--sp-16)] z-[1200] paper paper-solid !rounded-[var(--r-26)] p-[var(--sp-12)] pl-[var(--sp-16)] flex items-center gap-[var(--sp-12)] max-w-[calc(100vw-2*var(--sp-16))] page-in">
            <span className="min-w-0">
                <span className="block text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary">{t('ui.office.updateTitle', { version: latest })}</span>
                <span className="block text-[length:var(--fs-12)] leading-[var(--lh-16)] text-text-secondary">{t('ui.office.updateHint', { version: current })}</span>
            </span>
            <button type="button" onClick={() => setDismissed(true)} disabled={busy} className="btn btn-sm btn-secondary flex-shrink-0">{t('ui.office.updateLater')}</button>
            <button type="button" onClick={update} disabled={busy} className="btn btn-sm btn-primary flex-shrink-0">{busy ? t('common.loading') : t('ui.office.updateNow')}</button>
        </div>
    )
}
