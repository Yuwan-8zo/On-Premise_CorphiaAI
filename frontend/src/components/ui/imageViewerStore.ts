/** 看大圖（ImageViewer）的狀態與開關：分開放，元件檔只放元件 */
import { create } from 'zustand'
import { morph } from '@/lib/viewTransition'

/** 縮圖和大圖共用的轉場名稱（同一時間只會有一個元素掛著） */
export const IMAGE_MORPH = 'image-morph'

interface ViewerState {
    src: string | null
    alt: string
    from: HTMLElement | null
}

export const useViewer = create<ViewerState>(() => ({ src: null, alt: '', from: null }))

export function openImage(src: string, alt: string, from: HTMLElement) {
    from.style.viewTransitionName = IMAGE_MORPH
    void morph(() => {
        from.style.viewTransitionName = ''
        from.style.visibility = 'hidden'
        useViewer.setState({ src, alt, from })
    })
}

export function closeImage() {
    const { from } = useViewer.getState()
    void morph(() => {
        useViewer.setState({ src: null })
        if (from) {
            from.style.visibility = ''
            from.style.viewTransitionName = IMAGE_MORPH
        }
    }).then(() => { if (from) from.style.viewTransitionName = '' })
}

