/**
 * 輸入框的「附加圖片」：選檔或直接貼上截圖，附給下一則訊息
 *
 * 從 ChatInputArea 抽出來（那個元件已經很大）：這裡管「目前附了哪些圖」和上傳、取消、送出後清掉。
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { chatImagesApi, type VisionStatus } from '@/api/chatImages'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/store/toastStore'

interface Options {
    /** 這台主機能不能看圖、上限多少（null＝還沒問到或不能看圖） */
    vision: VisionStatus | null
    conversationId?: string
    /** 還沒有對話時先建一個（回它的編號） */
    ensureConversation?: () => Promise<string | undefined>
}

export function useChatImages({ vision, conversationId, ensureConversation }: Options) {
    const { t } = useTranslation()
    const [images, setImages] = useState<string[]>([])
    /** 圖片屬於哪個對話（全新對話附圖時會先建立對話，編號要記下來才讀得到縮圖） */
    const [owner, setOwner] = useState<string | undefined>(conversationId)
    const [busy, setBusy] = useState(false)
    const enabled = Boolean(vision?.enabled)

    // 換對話、重新整理頁面：問伺服器這個對話有沒有還沒送出的圖
    useEffect(() => {
        setImages([])
        setOwner(conversationId)
        if (!enabled || !conversationId) return
        let cancelled = false
        chatImagesApi.pending(conversationId).then((ids) => { if (!cancelled) setImages(ids) }).catch(() => undefined)
        return () => { cancelled = true }
    }, [conversationId, enabled])

    const attach = useCallback(async (files: File[]) => {
        const toast = useToastStore.getState()
        const picked = files.filter((f) => f.type.startsWith('image/'))
        if (!vision?.enabled || picked.length === 0 || busy) return
        if (images.length + picked.length > vision.max_images) { toast.error(t('chat.images.tooMany', { max: vision.max_images })); return }
        if (picked.some((f) => f.size > vision.max_mb * 1024 * 1024)) { toast.error(t('chat.images.tooBig', { max: vision.max_mb })); return }
        setBusy(true)
        try {
            const id = conversationId ?? owner ?? await ensureConversation?.()
            if (!id) { toast.error(t('chat.attachFiles.noConversation')); return }
            const result = await chatImagesApi.attach(id, picked)
            setOwner(id)
            setImages(result.images)
            if (result.skipped.length > 0) toast.error(t('chat.images.skipped', { names: result.skipped.map((s) => s.name).join('、') }))
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setBusy(false)
        }
    }, [vision, busy, images.length, conversationId, owner, ensureConversation, t])

    /** 取消附加（還沒送出） */
    const remove = useCallback(async () => {
        const id = owner
        setImages([])
        if (!id) return
        try { await chatImagesApi.cancel(id) } catch { /* 取消失敗不影響使用者：沒送出的圖過一陣子會自動清掉 */ }
    }, [owner])

    /** 送出訊息時呼叫：伺服器會把圖片掛到那一則訊息上，這裡只清掉輸入框上的縮圖。回傳剛送出的圖片編號 */
    const takeForSend = useCallback((): string[] => {
        const sent = images
        if (sent.length) setImages([])
        return sent
    }, [images])

    return { enabled, images, owner, busy, attach, remove, takeForSend }
}
