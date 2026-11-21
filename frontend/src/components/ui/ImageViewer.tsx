/**
 * 看大圖：點聊天裡的圖片，縮圖直接「變形」放大成全螢幕（lib/viewTransition），關掉時縮回原來的位置
 *   openImage(網址, 說明文字, 被點的縮圖)；點任何地方、按 Esc 或右上角關閉
 *   縮圖在開著的時候先藏起來（不然會同時看到兩張）；不支援轉場的瀏覽器直接打開、直接關
 */
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from '@/components/snow/icons'
import { useDismiss } from '@/lib/useDismiss'
import { IMAGE_MORPH, closeImage, useViewer } from './imageViewerStore'

export default function ImageViewer() {
    const { t } = useTranslation()
    const { src, alt } = useViewer()
    const boxRef = useRef<HTMLDivElement>(null)
    useDismiss(!!src, closeImage, [], { outside: false })
    if (!src) return null
    return createPortal(
        <div ref={boxRef} className="image-viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={closeImage}>
            <img src={src} alt={alt} className="image-viewer-img" style={{ viewTransitionName: IMAGE_MORPH }} />
            <button type="button" className="image-viewer-close glass-chip" aria-label={t('common.close')} onClick={closeImage}>
                <X aria-hidden />
            </button>
        </div>,
        document.body,
    )
}
