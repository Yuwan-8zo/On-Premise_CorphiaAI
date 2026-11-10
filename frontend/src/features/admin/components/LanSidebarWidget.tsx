/**
 * LanSidebarWidget — Admin sidebar 底部的區域網路開關
 * --------------------------------------------------
 * enabled=false: 只允許本機存取（127.0.0.1）
 * enabled=true:  允許區網存取（0.0.0.0）
 *
 * 重要：這是 listener bind host 設定，切換後需要重啟 start.py 才會生效。
 */

import { Info } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'

import { GlobeIcon, ItshoverIcon, LockIcon } from '@/components/icons/itshover'
import SidebarIconBadge from './SidebarIconBadge'
import GlassSwitch from '@/components/ui/GlassSwitch'
import Tooltip from '@/components/ui/Tooltip'

export interface LanSidebarWidgetProps {
    enabled: boolean
    isLoading: boolean
    lanIps: string[]
    onToggle: (nextEnabled: boolean) => void
}

export default function LanSidebarWidget({ enabled, isLoading, lanIps, onToggle }: LanSidebarWidgetProps) {
    const { t } = useTranslation()

    const statusText = enabled
        ? t('admin.lan.enabled', '已開啟')
        : t('admin.lan.disabled', '已關閉')

    return (
        <div className="pt-3">
            <div className="rounded-[18px] border border-transparent bg-[var(--chip)] p-2 shrink-0">
                <div className="flex items-center gap-1.5">
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
                                ? t('admin.lan.tipOn', '允許區網裝置透過本機 IP 存取（需重啟生效）')
                                : t('admin.lan.tipOff', '僅允許本機存取（需重啟生效）')
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
                    <div className="mt-1.5 border-t border-[var(--paper-line)] pt-1.5">
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
                )}
            </div>
        </div>
    )
}
