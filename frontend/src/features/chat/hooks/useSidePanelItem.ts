/**
 * 讓對話裡的一個區塊可以「在旁邊開啟」：向面板登記自己的內容，內容變了（AI 還在寫）跟著更新，離開畫面就取消登記。
 * content 傳 null＝這個區塊現在沒有東西可以顯示。
 */
import { useCallback, useEffect, useId, useRef } from 'react'
import { useSidePanelStore, type SidePanelContent } from '@/store/sidePanelStore'

export function useSidePanelItem(content: SidePanelContent | null) {
    const id = useId()
    const ref = useRef<HTMLDivElement | null>(null)
    const kind = content?.kind
    const code = content?.kind === 'page' ? content.code : ''
    const language = content?.kind === 'page' ? content.language : ''
    const result = content?.kind === 'run' ? content.result : null

    useEffect(() => {
        const { register, unregister } = useSidePanelStore.getState()
        if (kind === 'page') register(id, { kind, code, language }, ref.current)
        else if (kind === 'run' && result) register(id, { kind, result }, ref.current)
        else unregister(id)
    }, [id, kind, code, language, result])

    useEffect(() => () => useSidePanelStore.getState().unregister(id), [id])

    const openInPanel = useCallback(() => useSidePanelStore.getState().show(id), [id])
    /** 面板現在顯示的就是這一個 */
    const shownInPanel = useSidePanelStore((s) => s.open && s.currentId === id)
    return { ref, openInPanel, shownInPanel }
}
