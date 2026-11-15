/**
 * LanQrOverlay — 區域網路連線 QR code（全螢幕，給手機掃描）
 *   - 網址＝本機在區網的 IP＋目前的前端連接埠，手機掃了直接開聊天室
 *   - 只顯示一個網址：後端已挑出電腦實際連網用的那張網卡（排除 WSL／Hyper-V 等手機連不到的虛擬網卡）
 *   - 點背景、按 Esc 或右上角關閉；開關都有動畫：背景的顏色與模糊漸變（玻璃不做整體透明度，Safari 會閃），內容淡入淡出＋縮放
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { X } from '@/components/snow/icons'
import QrCode from '@/components/ui/QrCode'
import { prefersReducedMotion } from '@/lib/reducedMotion'

interface LanQrOverlayProps {
    /** 手機要連的本機 IP */
    ip: string
    /** 完整網址（主機模式由後端給，含加密的協定和埠）；沒給就照目前頁面的協定與埠組 */
    url?: string
    /** 區網連線有沒有加密 */
    encrypted?: boolean
    /** 主機發證憑證的指紋：手機第一次連線跳出憑證提醒時用來核對 */
    fingerprint?: string
    onClose: () => void
}

/** 指紋顯示前幾組（全長 32 組太長；前 8 組已經足夠讓人核對是不是同一張） */
const FINGERPRINT_GROUPS = 8

/** 區網裝置要開的網址（沿用目前頁面的協定與連接埠） */
const lanUrl = (ip: string) => `${window.location.protocol}//${ip}${window.location.port ? `:${window.location.port}` : ''}/`

export default function LanQrOverlay({ ip, url: givenUrl, encrypted = false, fingerprint = '', onClose }: LanQrOverlayProps) {
    const { t } = useTranslation()
    const url = givenUrl || lanUrl(ip)
    const [leaving, setLeaving] = useState(false)

    /** 關閉：先播淡出（.is-leaving，0.2 秒），播完才真的移除；減少動態效果時直接關 */
    const close = useCallback(() => {
        if (prefersReducedMotion()) { onClose(); return }
        setLeaving(true)
        window.setTimeout(onClose, 200)
    }, [onClose])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [close])

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('admin.lan.qrTitle', '用手機掃描連線')}
            className={`lan-qr-overlay ${leaving ? 'is-leaving' : ''}`}
            onClick={close}
        >
            {/* 大小同後台左上角的返回鈕：34 圓鈕、圖示 18 */}
            <button type="button" onClick={close} aria-label={t('common.close', '關閉')} className="btn-icon !w-[var(--sz-34)] !h-[var(--sz-34)] lan-qr-close">
                <X className="w-[var(--sz-18)] h-[var(--sz-18)]" />
            </button>
            <div className="lan-qr-body" onClick={(e) => e.stopPropagation()}>
                <p className="lan-qr-title">{t('admin.lan.qrTitle', '用手機掃描連線')}</p>
                <p className="lan-qr-sub">{t('admin.lan.qrHint', '手機要和這台電腦連在同一個網路')}</p>
                <div className="lan-qr-code">
                    <QrCode value={url} />
                </div>
                <p className="lan-qr-url selectable-text">{url}</p>
                {/* 手機開啟後可以裝成 App（主畫面圖示、全螢幕） */}
                <p className="lan-qr-sub">{t('admin.lan.installHint')}</p>
                {/* 加密連線：憑證是主機自己簽的，手機第一次會跳提醒；給指紋的前幾組讓人核對 */}
                {encrypted && (
                    <p className="lan-qr-sub">
                        {t('admin.lan.encryptedHint')}
                        {fingerprint && <span className="block tabular-nums selectable-text">{t('admin.lan.fingerprint', { value: fingerprint.split(':').slice(0, FINGERPRINT_GROUPS).join(':') })}</span>}
                        <span className="block selectable-text">{t('admin.lan.setupHint', { url: `${url}lan-setup` })}</span>
                    </p>
                )}
            </div>
        </div>,
        document.body,
    )
}
