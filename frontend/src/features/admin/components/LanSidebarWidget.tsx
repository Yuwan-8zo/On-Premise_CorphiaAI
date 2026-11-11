/**
 * LanSidebarWidget — Admin sidebar 底部的區域網路開關
 * --------------------------------------------------
 * enabled=false: 只允許本機存取
 * enabled=true:  允許區網裝置存取；右下角出現 QR code 按鈕，點開全螢幕給手機掃描
 *
 * 切換立即生效（前端伺服器的 lanGate 每個請求都讀設定），不用重啟。
 */

import { Info, QrCode as QrIcon } from '@/components/snow/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GlobeIcon, ItshoverIcon, LockIcon } from '@/components/icons/itshover'
import SidebarIconBadge from './SidebarIconBadge'
import GlassSwitch from '@/components/ui/GlassSwitch'
import Tooltip from '@/components/ui/Tooltip'
import LanQrOverlay from './LanQrOverlay'

export interface LanSidebarWidgetProps {
    enabled: boolean
    isLoading: boolean
    lanIps: string[]
    onToggle: (nextEnabled: boolean) => void
}

export default function LanSidebarWidget({ enabled, isLoading, lanIps, onToggle }: LanSidebarWidgetProps) {
    const { t } = useTranslation()
    const [showQr, setShowQr] = useState(false)

    const statusText = enabled
        ? t('admin.lan.enabled', '已開啟')
        : t('admin.lan.disabled', '已關閉')

    return (
        <div className="pt-[var(--space)]">
            <div className="rounded-[var(--r-21)] border border-transparent bg-[var(--chip)] p-[var(--sp-9d5)] shrink-0">
                <div className="flex items-start gap-1.5">
                    <SidebarIconBadge>
                        <ItshoverIcon icon={enabled ? GlobeIcon : LockIcon} size={12} />
                    </SidebarIconBadge>
                    <div className="min-w-0 flex-1">
                        <p className="text-[length:var(--fs-12)] font-medium text-text-secondary leading-none">
                            LAN
                        </p>
                        <p className="text-[length:var(--fs-10)] text-text-secondary leading-tight mt-0.5">
                            {statusText}
                        </p>
                    </div>

                    <Tooltip
                        label={
                            enabled
                                ? t('admin.lan.tipOn', '允許區網裝置透過本機 IP 存取（立即生效）')
                                : t('admin.lan.tipOff', '僅允許本機存取（立即生效）')
                        }
                    >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-transparent bg-[var(--chip)] text-text-muted">
                            <Info className="h-3 w-3" aria-hidden />
                        </span>
                    </Tooltip>
                </div>

                <div className="mt-1.5 flex items-center justify-between border-t border-[var(--paper-line)] pt-1.5">
                    <span className="text-[length:var(--fs-10)] font-medium text-text-secondary">
                        {t('admin.lan.toggleLabel', '區域網路')}
                    </span>
                    <GlassSwitch
                        checked={enabled}
                        loading={isLoading}
                        onChange={() => onToggle(!enabled)}
                        aria-label={t('admin.lan.toggleAria', '切換區域網路存取')}
                        size="sm"
                    />
                </div>

                {enabled && lanIps.length > 0 && (
                    <div className="mt-1.5 flex items-end gap-2 border-t border-[var(--paper-line)] pt-1.5">
                        <div className="min-w-0 flex-1">
                            <p className="text-[length:var(--fs-10)] text-text-muted leading-tight">
                                {t('admin.lan.ips', '本機 IP')}
                            </p>
                            {/* 只顯示手機連得到的那一個（後端已排除虛擬網卡） */}
                            <div className="mt-1 text-[length:var(--fs-10)] text-text-secondary tabular-nums">{lanIps[0]}</div>
                        </div>
                        {/* 右下角：QR code，點開全螢幕給手機掃描 */}
                        <Tooltip label={t('admin.lan.qrOpen', '顯示手機連線 QR code')}>
                            <button
                                type="button"
                                onClick={() => setShowQr(true)}
                                aria-label={t('admin.lan.qrOpen', '顯示手機連線 QR code')}
                                className="btn-icon !w-[var(--sz-32)] !h-[var(--sz-32)] shrink-0 text-text-primary"
                            >
                                <QrIcon className="w-[var(--sz-17)] h-[var(--sz-17)]" />
                            </button>
                        </Tooltip>
                    </div>
                )}
                {showQr && enabled && lanIps.length > 0 && <LanQrOverlay ip={lanIps[0]} onClose={() => setShowQr(false)} />}
            </div>
        </div>
    )
}
