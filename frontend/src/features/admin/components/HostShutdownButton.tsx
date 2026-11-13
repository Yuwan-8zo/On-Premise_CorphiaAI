/**
 * 關閉主機服務（管理後台側欄最下面）
 *
 * 桌面版關掉視窗不會關服務（其他電腦和手機還連著），要把整套系統關掉就按這裡——和按「一鍵關閉」一樣。
 * 只在「主機本機」開的管理後台顯示：後端也只接受本機的請求，別的裝置按了也沒用，所以乾脆不顯示。
 * 關之前一定先確認：按下去所有人都會斷線，而且要有人在主機前面才能再開。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { systemApi } from '@/api/system'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'

/** 關閉的提示要停久一點：讓使用者讀完「可以關掉視窗了」 */
const STOPPING_TOAST_MS = 8000

/** 這一頁是不是在主機本機開的 */
export function isHostPage(hostname: string = window.location.hostname): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

export default function HostShutdownButton() {
    const { t } = useTranslation()
    const showConfirm = useUIStore((s) => s.showConfirm)
    const [stopping, setStopping] = useState(false)
    if (!isHostPage()) return null

    const stop = () =>
        showConfirm(
            t('admin.shutdown.confirm'),
            async () => {
                setStopping(true)
                try {
                    await systemApi.shutdownHost()
                    useToastStore.getState().add(t('admin.shutdown.stopping'), 'info', STOPPING_TOAST_MS)
                } catch (err) {
                    setStopping(false)
                    useToastStore.getState().error(getErrorMessage(err))
                }
            },
            t('admin.shutdown.hint'),
        )

    return (
        <button
            type="button"
            onClick={stop}
            disabled={stopping}
            className="mt-[var(--sp-8)] w-full rounded-full px-[var(--sp-12)] py-[var(--sp-8)] text-center text-[length:var(--fs-12)] font-semibold text-[var(--danger-ink)] transition-colors hover:bg-[var(--chip)] disabled:opacity-50 select-none"
        >
            {t(stopping ? 'admin.shutdown.stoppingShort' : 'admin.shutdown.button')}
        </button>
    )
}
