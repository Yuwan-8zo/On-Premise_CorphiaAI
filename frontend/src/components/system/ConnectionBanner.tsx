/**
 * 斷線提示（登入後每一頁的頂端）
 *   連續兩次連不上主機（systemStore.offline）→ 頂端出現玻璃膠囊「連不上主機，正在重新連線…」；
 *   斷線時按送出的提問會先存起來（outboxStore），膠囊加一句「恢復後會自動送出」，旁邊可以取消；
 *   恢復連線 → 改成「已重新連線」，RECONNECTED_MS 後收起來。
 *   不擋點擊（只有「取消」按得到），報讀軟體會唸出來。
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSystemStore } from '@/store/systemStore'
import { useOutboxStore } from '@/store/outboxStore'

/** 「已重新連線」顯示多久 */
const RECONNECTED_MS = 2400

export default function ConnectionBanner() {
    const { t } = useTranslation()
    const offline = useSystemStore((s) => s.offline)
    const queued = useOutboxStore((s) => s.entry)
    const clear = useOutboxStore((s) => s.clear)
    const [back, setBack] = useState(false)
    const wasOffline = useRef(false)

    useEffect(() => {
        if (offline) {
            wasOffline.current = true
            setBack(false)
            return
        }
        if (!wasOffline.current) return
        wasOffline.current = false
        setBack(true)
        const id = window.setTimeout(() => setBack(false), RECONNECTED_MS)
        return () => window.clearTimeout(id)
    }, [offline])

    if (!offline && !back) return null

    return (
        <div className="conn-banner-wrap" role="status" aria-live="polite">
            <div className={`conn-banner glass-chip${back ? ' is-back' : ''}`}>
                <span className={`conn-dot${back ? ' is-ok' : ''}`} aria-hidden />
                <span>{back ? t('ui.conn.back') : t('ui.conn.lost')}</span>
                {offline && queued && (
                    <>
                        <span className="conn-sub">{t('ui.conn.queued')}</span>
                        <button type="button" className="conn-cancel" onClick={clear}>{t('common.cancel')}</button>
                    </>
                )}
            </div>
        </div>
    )
}
