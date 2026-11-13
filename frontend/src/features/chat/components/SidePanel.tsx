/**
 * 旁邊的顯示面板：把 AI 做的成品（HTML／SVG）或執行程式的結果放大到聊天旁邊看
 *
 *   - 電腦：在聊天右邊佔一欄（開啟時把左邊的對話清單收成窄條，關掉再放回來）
 *   - 手機：蓋滿整個畫面
 *   - AI 改了一版：面板開著時自動換成最新的；用「‹ 2/3 ›」切回舊的
 *   - 成品可以切換看畫面／看程式碼、存成檔案
 * 內容一樣關在沙盒裡（lib/previewDoc），和程式碼區塊裡的預覽是同一套限制。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from '@/components/snow/icons'
import MaterialIcon from '@/components/icons/MaterialIcon'
import { PREVIEW_SANDBOX, buildPreviewDoc } from '@/lib/previewDoc'
import { useDebounced } from '@/lib/useDebounced'
import { MQ_DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { orderedItems, useSidePanelStore } from '@/store/sidePanelStore'
import { useUIStore } from '@/store/uiStore'
import { CODE_BUTTON, CopyButton, SaveButton } from './CodeButtons'
import RunResultView from './RunResultView'
import VersionSwitcher from './VersionSwitcher'

/** AI 還在寫的時候，畫面隔多久才重畫一次（毫秒）：每個字都重畫會一直閃 */
const PREVIEW_DEBOUNCE_MS = 400

export default function SidePanel() {
    const { t } = useTranslation()
    const open = useSidePanelStore((s) => s.open)
    const items = useSidePanelStore((s) => s.items)
    const currentId = useSidePanelStore((s) => s.currentId)
    const show = useSidePanelStore((s) => s.show)
    const close = useSidePanelStore((s) => s.close)
    const desktop = useMediaQuery(MQ_DESKTOP)
    const [showCode, setShowCode] = useState(false)
    const closeButton = useRef<HTMLButtonElement | null>(null)

    const current = open && currentId ? items[currentId] : undefined
    const visible = Boolean(current)
    const code = current?.kind === 'page' ? current.code : ''
    // 延後的是「同一個版本還在寫」的更新；換到另一個版本要馬上換，所以連編號一起記
    const live = useMemo(() => ({ id: currentId, code }), [currentId, code])
    const settled = useDebounced(live, PREVIEW_DEBOUNCE_MS)
    const previewCode = settled.id === currentId ? settled.code : code

    // 電腦上：面板開著時把對話清單收成窄條讓出空間；是面板收的，關掉時才放回來
    const collapsedSidebar = useRef(false)
    useEffect(() => {
        if (!desktop) return
        const ui = useUIStore.getState()
        if (visible && ui.sidebarOpen) {
            ui.setSidebarOpen(false)
            collapsedSidebar.current = true
        } else if (!visible && collapsedSidebar.current) {
            collapsedSidebar.current = false
            ui.setSidebarOpen(true)
        }
    }, [visible, desktop])

    // Esc 關閉；手機上蓋滿畫面，開啟時把焦點移到關閉鈕
    useEffect(() => {
        if (!visible) return
        if (!desktop) closeButton.current?.focus()
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented) close()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [visible, desktop, close])

    if (!current) return null
    const versions = orderedItems(items, current.kind).map((item) => item.id)
    const isPage = current.kind === 'page'

    return (
        <aside
            data-testid="side-panel"
            aria-label={t('ui.chat.sidePanel.label')}
            className="paper fixed inset-0 z-50 flex flex-col overflow-hidden !rounded-none pt-[env(safe-area-inset-top)] animate-fade-in-up md:relative md:inset-auto md:z-10 md:shrink-0 md:pt-0 md:w-[var(--side-panel-w)] md:h-[calc(100%-2*var(--sp-16))] md:my-4 md:mr-4 md:!rounded-[var(--r-36)]"
        >
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--paper-line)] px-[var(--sp-16)] py-[var(--sp-12)]">
                <h2 className="mr-auto text-[length:var(--fs-15)] font-semibold text-text-primary">
                    {t(isPage ? 'ui.chat.sidePanel.pageTitle' : 'ui.chat.sidePanel.runTitle')}
                </h2>
                <VersionSwitcher ids={versions} currentId={current.id} onSwitch={show} />
                {isPage && (
                    // 手機放不下一排：這組按鈕自己換到第二排，關閉鈕留在右上角
                    <div className="order-last flex basis-full flex-wrap items-center gap-2 md:order-none md:basis-auto">
                        <button type="button" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)} className={CODE_BUTTON}>
                            <MaterialIcon name={showCode ? 'visibility' : 'code'} size={14} aria-hidden />
                            {t(showCode ? 'ui.chat.codeFile.preview' : 'ui.chat.codeFile.showCode')}
                        </button>
                        <SaveButton code={current.code} language={current.language} />
                        <CopyButton code={current.code} />
                    </div>
                )}
                <button ref={closeButton} type="button" onClick={close} aria-label={t('ui.chat.sidePanel.close')} className="btn-icon btn-icon-plain !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted">
                    <X />
                </button>
            </header>

            {isPage && !showCode && (
                <iframe
                    title={t('ui.chat.codeFile.previewTitle')}
                    sandbox={PREVIEW_SANDBOX}
                    referrerPolicy="no-referrer"
                    srcDoc={buildPreviewDoc(previewCode)}
                    className="block min-h-0 w-full flex-1 border-0 bg-white"
                />
            )}
            {isPage && showCode && (
                <pre className="min-h-0 flex-1 overflow-auto p-[var(--sp-16)] text-[length:var(--fs-13)] leading-relaxed whitespace-pre-wrap break-words selectable-text">{current.code}</pre>
            )}
            {current.kind === 'run' && (
                <div className="min-h-0 flex-1 overflow-auto px-[var(--sp-16)] pb-[var(--sp-16)]">
                    <RunResultView result={current.result} fill />
                </div>
            )}
        </aside>
    )
}
