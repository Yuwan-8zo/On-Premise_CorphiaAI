/**
 * 聊天裡的一張圖片（輸入框上方的小縮圖、訊息泡泡裡的圖）
 *
 * 圖片要登入才讀得到，所以不能把網址直接放進 img：用帶登入憑證的請求把內容拿回來，轉成只在這一頁有效的暫時網址。
 * 元件拿掉時把暫時網址釋放掉（不然每看一張圖就佔一份記憶體）。
 * zoomable：點一下用 ImageViewer 看大圖（縮圖直接變形放大）。
 */
import { useEffect, useState } from 'react'
import { chatImagesApi } from '@/api/chatImages'
import { openImage } from '@/components/ui/imageViewerStore'
import i18n from '@/i18n'

interface ChatImageProps {
    conversationId: string
    imageId: string
    alt: string
    className?: string
    /** 點一下看大圖 */
    zoomable?: boolean
}

export default function ChatImage({ conversationId, imageId, alt, className = '', zoomable = false }: ChatImageProps) {
    const [url, setUrl] = useState<string | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let cancelled = false
        let created: string | null = null
        setUrl(null)
        setFailed(false)
        chatImagesApi
            .fetch(conversationId, imageId)
            .then((blob) => {
                if (cancelled) return
                created = URL.createObjectURL(blob)
                setUrl(created)
            })
            .catch(() => { if (!cancelled) setFailed(true) })
        return () => {
            cancelled = true
            if (created) URL.revokeObjectURL(created)
        }
    }, [conversationId, imageId])

    // 還在讀、或讀不到（圖片被刪了）：留一個同樣大小的底，版面不會跳動
    if (!url) return <span role="img" aria-label={alt} className={`inline-block bg-[var(--chip)] ${failed ? 'opacity-50' : 'skel'} ${className}`} />
    if (zoomable) {
        return (
            <button type="button" className={`chat-image-zoom ${className}`} aria-label={i18n.t('ui.image.zoom', { alt })} onClick={(e) => openImage(url, alt, e.currentTarget)}>
                <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
        )
    }
    return <img src={url} alt={alt} className={`object-cover ${className}`} draggable={false} />
}
