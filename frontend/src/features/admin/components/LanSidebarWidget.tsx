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
        <div className="pt-[12px]">
            <div className="rounded-[21px] border border-transparent bg-[var(--chip)] p-[9.5px] shrink-0">
                <div className="flex items-start gap-1.5">
                    <SidebarIconBadge>
                        <ItshoverIcon icon={enabled ? GlobeIcon : LockIcon} size={12} />
                    </SidebarIconBadge>
                    <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-text-secondary leading-none">
                            LAN
                        </p>
                        <p className="text-[10px] text-text-secondary leading-tight mt-0.5">
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
                    <span className="text-[10px] font-medium text-text-secondary">
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
                            <p className="text-[10px] text-text-muted leading-tight">
                                {t('admin.lan.ips', '本機 IP')}
                            </p>
                            <div className="mt-1 space-y-0.5">
                                {lanIps.slice(0, 3).map((ip) => (
                                    <div key={ip} className="text-[10px] text-text-secondary tabular-nums">
                                        {ip}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* 右下角：QR code，點開全螢幕給手機掃描 */}
                        <Tooltip label={t('admin.lan.qrOpen', '顯示手機連線 QR code')}>
                            <button
                                type="button"
                                onClick={() => setShowQr(true)}
                                aria-label={t('admin.lan.qrOpen', '顯示手機連線 QR code')}
                                className="btn-icon !w-[32px] !h-[32px] shrink-0 text-text-primary"
                            >
                                <QrIcon className="w-[17px] h-[17px]" />
                            </button>
                        </Tooltip>
                    </div>
                )}
                {showQr && enabled && lanIps.length > 0 && <LanQrOverlay ips={lanIps} onClose={() => setShowQr(false)} />}
            </div>
        </div>
    )
}
