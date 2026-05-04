/**
 * NgrokQrModal — 全螢幕 QR 顯示
 * --------------------------------
 * 點 sidebar QR 按鈕後直接全螢幕鋪 QR code（沒有卡片邊距）。
 * 關閉方式：點任何地方（含 QR 本身），或按 Esc。
 *
 * QR 用 api.qrserver.com 線上服務（同 LoginPage QrAccessModal），
 * 沒有額外 npm dependency。size 用 1024 拿到夠清楚的高解析度，
 * 容器再用 CSS 把它縮放到 min(90vw, 90vh) 的方塊。
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface NgrokQrModalProps {
    url: string | null | undefined
    isOpen: boolean
    onClose: () => void
}

export default function NgrokQrModal({ url, isOpen, onClose }: NgrokQrModalProps) {
    // ESC 關閉
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    if (!isOpen || !url) return null

    return createPortal(
        // 背景：輕度 backdrop-blur（從 2xl→sm）+ 提高半透明，讓底層更看得清，玻璃感保留但不糊
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-base/55 supports-[backdrop-filter]:bg-bg-base/45 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="QR Code"
        >
            {/* QR 卡片：玻璃感包一層白邊；自己也只用 backdrop-blur-md 不要太糊 */}
            <div
                className="rounded-cv-md border border-white/50 dark:border-white/20 bg-bg-surface/55 supports-[backdrop-filter]:bg-bg-surface/35 backdrop-blur-md p-3 shadow-[0_22px_70px_rgb(0_0_0/0.22)] dark:shadow-[0_22px_70px_rgb(0_0_0/0.5)]"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(90vw, 90vh)',
                    height: 'min(90vw, 90vh)',
                }}
            >
                {/* QR：image-rendering: pixelated 讓縮放後模塊保持銳利不被瀏覽器 smoothing 模糊 */}
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=0&qzone=0&format=png&data=${encodeURIComponent(url)}`}
                    alt="QR"
                    className="block w-full h-full select-none rounded-cv-sm"
                    style={{ imageRendering: 'pixelated' }}
                    loading="eager"
                    draggable={false}
                />
            </div>
        </div>,
        document.body,
    )
}
