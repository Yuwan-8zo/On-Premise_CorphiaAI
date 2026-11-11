/**
 * LanQrOverlay — 區域網路連線 QR code（全螢幕，給手機掃描）
 *   - 網址＝本機在區網的 IP＋目前的前端連接埠，手機掃了直接開聊天室
 *   - 只顯示一個網址：後端已挑出電腦實際連網用的那張網卡（排除 WSL／Hyper-V 等手機連不到的虛擬網卡）
 *   - 點背景、按 Esc 或右上角關閉
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { X } from '@/components/snow/icons'
import QrCode from '@/components/ui/QrCode'

interface LanQrOverlayProps {
    /** 手機要連的本機 IP */
    ip: string
    onClose: () => void
}

/** 區網裝置要開的網址（沿用目前頁面的協定與連接埠） */
const lanUrl = (ip: string) => `${window.location.protocol}//${ip}${window.location.port ? `:${window.location.port}` : ''}/`

export default function LanQrOverlay({ ip, onClose }: LanQrOverlayProps) {
    const { t } = useTranslation()
    const url = lanUrl(ip)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('admin.lan.qrTitle', '用手機掃描連線')}
            className="lan-qr-overlay"
            onClick={onClose}
        >
            <button type="button" onClick={onClose} aria-label={t('common.close', '關閉')} className="btn-icon lan-qr-close">
                <X className="w-[22px] h-[22px]" />
            </button>
            <div className="lan-qr-body" onClick={(e) => e.stopPropagation()}>
                <p className="lan-qr-title">{t('admin.lan.qrTitle', '用手機掃描連線')}</p>
                <p className="lan-qr-sub">{t('admin.lan.qrHint', '手機要和這台電腦連在同一個網路')}</p>
                <div className="lan-qr-code">
                    <QrCode value={url} />
                </div>
                <p className="lan-qr-url selectable-text">{url}</p>
            </div>
        </div>,
        document.body,
    )
}
