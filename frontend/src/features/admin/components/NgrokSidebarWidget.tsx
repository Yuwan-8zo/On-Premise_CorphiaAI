/**
 * NgrokSidebarWidget — Admin sidebar 底部的 ngrok 控制（按鈕版）
 * -------------------------------------------------------------
 * 不再內嵌 QR；改成「點 QR 按鈕彈出大 modal」的設計。
 */

import { Check } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'

import {
    CopyIcon,
    GlobeIcon,
    ItshoverIcon,
    QrcodeIcon,
    WifiOffIcon,
} from '@/components/icons/itshover'
import SidebarIconBadge from './SidebarIconBadge'
import GlassSwitch from '@/components/ui/GlassSwitch'
import Tooltip from '@/components/ui/Tooltip'

interface NgrokInfo {
    active: boolean
    url?: string | null
    api_url?: string | null
    ws_url?: string | null
}

export interface NgrokSidebarWidgetProps {
    info: NgrokInfo | null
    isLoading: boolean
    copied: boolean
    isOffline?: boolean
    onCopyUrl: () => void
    onShowQr: () => void
    onStart: () => void
    onStop: () => void
}

export default function NgrokSidebarWidget({
    info,
    isLoading,
    copied,
    isOffline = false,
    onCopyUrl,
    onShowQr,
    onStart,
    onStop,
}: NgrokSidebarWidgetProps) {
    const { t } = useTranslation()
    const isActive = Boolean(info?.active && info?.url)
    const showOfflineState = isOffline && !isActive

    const statusText = showOfflineState
        ? t('admin.ngrok.offlineBadge', '離線')
        : isActive
            ? t('admin.ngrok.activeStatus', '已啟動')
            : isLoading
                ? t('admin.ngrok.starting', '啟動中…')
                : t('admin.ngrok.inactive', '未啟動')

    const statusTextClass = showOfflineState
        ? 'text-[10px] text-amber-600 dark:text-amber-400 leading-tight mt-0.5'
        : 'text-[10px] text-text-secondary leading-tight mt-0.5'

    const copyButton = (
        <button
            type="button"
            onClick={onCopyUrl}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition "
            aria-label={t('admin.ngrok.copyUrl', '複製公開網址')}
        >
            {copied ? (
                <Check className="h-3 w-3 text-green-500" aria-hidden />
            ) : (
                <ItshoverIcon icon={CopyIcon} size={12} interactive />
            )}
        </button>
    )

    return (
        <div className="pt-3">
            <div className="snow-well rounded-[18px] p-2 shrink-0">
                <div className="flex items-center gap-1.5">
                    <SidebarIconBadge variant={showOfflineState ? 'warning' : 'accent'}>
                        <ItshoverIcon
                            icon={showOfflineState ? WifiOffIcon : GlobeIcon}
                            size={12}
                        />
                    </SidebarIconBadge>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-text-secondary leading-none">
                            Remote
                        </p>
                        <p className={statusTextClass}>{statusText}</p>
                    </div>

                    {isActive && (
                        <>
                            <Tooltip label={t('admin.ngrok.showQr', '顯示 QR Code')}>
                                <button
                                    type="button"
                                    onClick={onShowQr}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition "
                                    aria-label={t('admin.ngrok.showQr', '顯示 QR Code')}
                                >
                                    <ItshoverIcon icon={QrcodeIcon} size={12} interactive />
                                </button>
                            </Tooltip>
                            {info?.url ? (
                                <Tooltip label={info.url}>{copyButton}</Tooltip>
                            ) : (
                                copyButton
                            )}
                        </>
                    )}
                </div>

                <div className="mt-1.5 flex items-center justify-between border-t border-[var(--paper-line)] pt-1.5">
                    <span className="text-[10px] font-medium text-text-secondary">
                        {t('admin.ngrok.toggleOnLabel', '啟用')}
                    </span>
                    <GlassSwitch
                        checked={isActive}
                        loading={isLoading}
                        onChange={() => {
                            if (isActive) onStop()
                            else onStart()
                        }}
                        aria-label={
                            isActive
                                ? t('admin.ngrok.toggleOff', '關閉公開隧道')
                                : showOfflineState
                                    ? t('admin.ngrok.offlineDisabledTooltip', '目前離線中，無法啟用公開網址')
                                    : t('admin.ngrok.toggleOn', '啟動公開隧道')
                        }
                        size="sm"
                    />
                </div>
            </div>
        </div>
    )
}
