/**
 * 旁邊的顯示面板：把 AI 做的成品（HTML／SVG）或執行程式的結果放大到聊天旁邊看
 *
 *   - 電腦：在聊天右邊佔一欄（開啟時把左邊的對話清單收成窄條，關掉再放回來）
 *   - 手機：蓋滿整個畫面
 *   - AI 改了一版：面板開著時自動換成最新的；用「‹ 2/3 ›」切回舊的
 *   - 成品可以切換看畫面／看程式碼、存成檔案、放大成全螢幕
 *   - 一個對話不只一個檔案：面板首頁是「這個對話的檔案」清單（成品、執行結果、AI 產生的檔案、你附加的檔案），點了才看那一份
 *   - 開關都有動畫：電腦上從右邊展開／收起（寬度漸變，聊天區跟著平順讓位），手機上由下往上浮現
 * 內容一樣關在沙盒裡（lib/previewDoc），和程式碼區塊裡的預覽是同一套限制。
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { readMs } from '@/lib/cssVars'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Contract, Expand, FileText, X } from '@/components/snow/icons'
import MaterialIcon from '@/components/icons/MaterialIcon'
import { PREVIEW_FRAME_STYLE, PREVIEW_SANDBOX, buildPreviewDoc } from '@/lib/previewDoc'
import { useDebounced } from '@/lib/useDebounced'
import { MQ_DESKTOP, useMediaQuery } from '@/lib/useMediaQuery'
import { attachedItemId, dropOtherAttachments, orderedItems, useSidePanelStore, type SidePanelItem } from '@/store/sidePanelStore'
import { useChatStore } from '@/store/chatStore'
import FileAttachments from './FileAttachments'
import { loadAttachments } from '@/lib/attachmentCache'
import { bundleHtml } from '@/lib/htmlBundle'
import { useToastStore } from '@/store/toastStore'
import { useUIStore } from '@/store/uiStore'
import { CopyButton, PANEL_BUTTON, PANEL_ICON, SaveButton } from './CodeButtons'
import RunResultView from './RunResultView'
import VersionSwitcher from './VersionSwitcher'

// PDF 引擎很大：只有打開引用原文時才載入
const PdfPreview = lazy(() => import('./PdfPreview'))

/** AI 還在寫的時候，畫面隔多久才重畫一次（毫秒）：每個字都重畫會一直閃 */
const PREVIEW_DEBOUNCE_MS = 400

export default function SidePanel() {
    const { t } = useTranslation()
    const open = useSidePanelStore((s) => s.open)
    const items = useSidePanelStore((s) => s.items)
    const currentId = useSidePanelStore((s) => s.currentId)
    const view = useSidePanelStore((s) => s.view)
    const show = useSidePanelStore((s) => s.show)
    const showList = useSidePanelStore((s) => s.showList)
    const close = useSidePanelStore((s) => s.close)
    const messages = useChatStore((s) => s.messages)
    const conversationId = useChatStore((s) => s.currentConversation?.id)
    // 換對話：上一個對話附加的檔案不能還留在面板裡
    useEffect(() => { dropOtherAttachments(conversationId) }, [conversationId])
    const desktop = useMediaQuery(MQ_DESKTOP)
    const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled === true
    const [showCode, setShowCode] = useState(false)
    const closeButton = useRef<HTMLButtonElement | null>(null)

    const listOpen = open && view === 'list'
    const shownItem = open && view === 'item' && currentId ? items[currentId] : undefined
    // 關閉動畫：面板關掉後，最後顯示的畫面（清單或某一份）再留一下，播完收起的動畫才拿掉
    const [leaving, setLeaving] = useState<{ list: boolean; item?: SidePanelItem } | null>(null)
    const lastShown = useRef<{ list: boolean; item?: SidePanelItem } | null>(null)
    useEffect(() => {
        if (listOpen || shownItem) { lastShown.current = { list: listOpen, item: shownItem }; setLeaving(null); return }
        if (!lastShown.current) return
        setLeaving(lastShown.current)
        lastShown.current = null
        const timer = window.setTimeout(() => setLeaving(null), readMs('--duration-panel'))
        return () => window.clearTimeout(timer)
    }, [listOpen, shownItem])
    const visible = listOpen || Boolean(shownItem)
    const listMode = listOpen || (!visible && Boolean(leaving?.list))
    const current = listMode ? undefined : (shownItem ?? leaving?.item)
    // 預覽第一次載入完成前先藏起來（大的網頁要幾秒才畫得出來，不藏會先閃一片白）；
    // 同一份在 AI 邊寫邊更新時不再藏，不然會一直閃
    const [frameReady, setFrameReady] = useState(false)
    useEffect(() => { setFrameReady(false) }, [currentId])
    // 全螢幕：整個面板蓋滿視窗（瀏覽器支援時連瀏覽器本身也全螢幕）；按 Esc 或再按一次縮回
    const [full, setFull] = useState(false)
    const panelRef = useRef<HTMLElement | null>(null)
    const toggleFull = () => {
        const next = !full
        setFull(next)
        try {
            if (next) void panelRef.current?.requestFullscreen?.().catch(() => undefined)
            else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
        } catch {
            // 不支援瀏覽器全螢幕：只用畫面內的蓋滿
        }
    }
    useEffect(() => {
        const onChange = () => { if (!document.fullscreenElement) setFull(false) }
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])
    useEffect(() => { if (!visible) setFull(false) }, [visible])
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
            if (event.key !== 'Escape' || event.defaultPrevented) return
            // 全螢幕時 Esc 先縮回，再按一次才關面板
            if (full) setFull(false)
            else close()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [visible, desktop, close, full])

    if (!current && !listMode) return null
    // 版本：AI 在對話裡寫的同一種成品（掛在訊息上）；附加的檔案自己就是一份，沒有版本
    const versions = current ? (current.el ? orderedItems(items, current.kind).filter((item) => item.el).map((item) => item.id) : [current.id]) : []
    const isPage = current?.kind === 'page'
    const iconBtn = 'btn-icon !w-[var(--sz-34)] !h-[var(--sz-34)] [--R:calc(var(--sz-34)/2)]'

    return (
        <aside
            ref={panelRef}
            data-testid="side-panel"
            aria-label={t('ui.chat.sidePanel.label')}
            className={full
                ? 'paper side-panel side-panel-full fixed inset-0 z-[60] flex flex-col overflow-hidden !rounded-none'
                : `paper side-panel ${leaving ? 'side-panel-out' : 'side-panel-in'} fixed inset-0 z-50 flex flex-col overflow-hidden !rounded-none pt-[env(safe-area-inset-top)] md:relative md:inset-auto md:z-10 md:shrink-0 md:pt-0 md:w-[var(--side-panel-w)] md:h-[calc(100%-2*var(--sp-16))] md:my-4 md:mr-4 md:!rounded-[var(--r-36)]`}
        >
            <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--paper-line)] px-[var(--sp-16)] py-[var(--sp-12)]">
                {!listMode && (
                    // 回到這個對話的所有檔案
                    <button type="button" onClick={showList} aria-label={t('ui.chat.sidePanel.allFiles')} title={t('ui.chat.sidePanel.allFiles')} className={iconBtn}>
                        <ChevronLeft className="w-[var(--sz-16)] h-[var(--sz-16)]" />
                    </button>
                )}
                <h2 className="mr-auto min-w-0 truncate text-[length:var(--fs-15)] font-semibold text-text-primary">
                    {panelTitle(listMode, current, items, t)}
                </h2>
                {current && <VersionSwitcher ids={versions} currentId={current.id} onSwitch={show} />}
                {current?.kind === 'page' && (
                    // 手機放不下一排：這組按鈕自己換到第二排，關閉鈕留在右上角
                    <div className="order-last flex basis-full flex-wrap items-center gap-2 md:order-none md:basis-auto">
                        <button type="button" aria-pressed={showCode} onClick={() => setShowCode((v) => !v)} className={PANEL_BUTTON}>
                            <MaterialIcon name={showCode ? 'visibility' : 'code'} size={PANEL_ICON} aria-hidden />
                            {t(showCode ? 'ui.chat.codeFile.preview' : 'ui.chat.codeFile.showCode')}
                        </button>
                        <SaveButton code={current.code} language={current.language} className={PANEL_BUTTON} iconSize={PANEL_ICON} />
                        <CopyButton code={current.code} className={PANEL_BUTTON} iconSize={PANEL_ICON} />
                    </div>
                )}
                {/* 全螢幕：手機上面板本來就蓋滿畫面；iPhone（含 Duo 這種寬的）Safari 不支援網頁元素全螢幕，按了沒反應 */}
                {desktop && canFullscreen && (
                    <button type="button" onClick={toggleFull} aria-pressed={full} aria-label={t(full ? 'ui.chat.sidePanel.exitFull' : 'ui.chat.sidePanel.full')} title={t(full ? 'ui.chat.sidePanel.exitFull' : 'ui.chat.sidePanel.full')}
                        className={iconBtn}>
                        {full ? <Contract className="w-[var(--sz-16)] h-[var(--sz-16)]" /> : <Expand className="w-[var(--sz-16)] h-[var(--sz-16)]" />}
                    </button>
                )}
                <button ref={closeButton} type="button" onClick={close} aria-label={t('ui.chat.sidePanel.close')} className={iconBtn}>
                    <X className="w-[var(--sz-16)] h-[var(--sz-16)]" />
                </button>
            </header>

            {listMode && <FileList items={items} messages={messages} onOpen={show} conversationId={conversationId} />}
            {isPage && !showCode && !frameReady && (
                <div className="flex min-h-0 flex-1 items-center justify-center text-[length:var(--fs-14)] text-text-secondary" role="status">
                    {t('common.loading')}
                </div>
            )}
            {isPage && !showCode && (
                <iframe
                    onLoad={() => setFrameReady(true)}
                    title={t('ui.chat.codeFile.previewTitle')}
                    sandbox={PREVIEW_SANDBOX}
                    referrerPolicy="no-referrer"
                    srcDoc={buildPreviewDoc(previewCode)}
                    style={PREVIEW_FRAME_STYLE}
                    className={`block min-h-0 w-full border-0 transition-opacity duration-[var(--duration-fast)] ${frameReady ? 'flex-1 opacity-100' : 'h-0 opacity-0'}`}
                />
            )}
            {isPage && showCode && (
                <pre className="min-h-0 flex-1 overflow-auto p-[var(--sp-16)] text-[length:var(--fs-13)] leading-relaxed whitespace-pre-wrap break-words selectable-text">{current?.kind === 'page' ? current.code : ''}</pre>
            )}
            {current?.kind === 'text' && (
                <pre className="min-h-0 flex-1 overflow-auto p-[var(--sp-16)] text-[length:var(--fs-13)] leading-relaxed whitespace-pre-wrap break-words selectable-text">{current.text}</pre>
            )}
            {current?.kind === 'pdf' && (
                <Suspense fallback={<output className="block p-[var(--sp-16)] text-[length:var(--fs-14)] text-text-secondary">{t('common.loading')}</output>}>
                    <PdfPreview documentId={current.documentId} quote={current.quote} />
                </Suspense>
            )}
            {current?.kind === 'run' && (
                <div className="min-h-0 flex-1 overflow-auto px-[var(--sp-16)] pb-[var(--sp-16)]">
                    <RunResultView result={current.result} fill />
                </div>
            )}
        </aside>
    )
}


type TFn = (key: string, opts?: Record<string, unknown>) => string

/** 面板標題：檔案清單／網頁名稱／檔名／執行結果 */
function panelTitle(listMode: boolean, current: SidePanelItem | null | undefined, items: Record<string, SidePanelItem>, t: TFn): string {
    if (listMode) return t('ui.chat.sidePanel.files')
    if (current?.kind === 'page') return pageTitle(current, items, t)
    if (current?.kind === 'text' || current?.kind === 'pdf') return current.title
    return t('ui.chat.sidePanel.runTitle')
}

/** 成品的名稱：附加的檔名 → 網頁自己的 <title> → 「網頁 N」 */
function pageTitle(item: SidePanelItem, items: Record<string, SidePanelItem>, t: TFn): string {
    if (item.kind !== 'page') return ''
    if (item.title) return item.title
    const own = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(item.code)?.[1]?.trim()
    if (own) return own
    const n = orderedItems(items, 'page').findIndex((p) => p.id === item.id) + 1
    return t('ui.chat.sidePanel.pageN', { n })
}

/** 這個對話的所有檔案（一頁看完）：可以預覽的成品、執行結果、AI 產生的檔案、你附加過的檔案 */
function FileList({ items, messages, onOpen, conversationId }: {
    items: Record<string, SidePanelItem>
    messages: { attachments?: { id: string; filename: string; kind: string; size: number }[]; files?: string[] }[]
    onOpen: (id: string) => void
    conversationId?: string
}) {
    const { t } = useTranslation()
    const [opening, setOpening] = useState<string | null>(null)
    /** 打開你附加的檔案：用這個瀏覽器留的原檔（伺服器不保留內容） */
    const openAttached = async (name: string) => {
        if (!conversationId || opening) return
        setOpening(name)
        try {
            const files = await loadAttachments(conversationId)
            const file = files.find((f) => f.name === name)
            if (!file) {
                useToastStore.getState().add(t('ui.chat.sidePanel.notCached'), 'info')
                return
            }
            const id = attachedItemId(conversationId, name)
            const panel = useSidePanelStore.getState()
            const ext = name.split('.').pop()?.toLowerCase() ?? ''
            if (/^(html?|xhtml)$/.test(ext)) {
                // 網頁：連同一起附加的 CSS／JS 嵌進去預覽
                const page = await bundleHtml([file, ...files.filter((f) => f !== file)])
                if (page) panel.register(id, { kind: 'page', code: page.code, language: 'html', title: name }, null)
            } else if (ext === 'svg') {
                panel.register(id, { kind: 'page', code: await readAsText(file), language: 'svg', title: name }, null)
            } else if (file.type.startsWith('image/')) {
                const url = await readAsDataUrl(file)
                panel.register(id, { kind: 'page', code: `<img alt="" src="${url}" style="display:block;max-width:100%;margin:auto">`, language: 'html', title: name }, null)
            } else if (TEXT_EXTS.has(ext)) {
                panel.register(id, { kind: 'text', text: await readAsText(file), title: name }, null)
            } else {
                // Word、PDF 這類瀏覽器沒辦法直接顯示：存回這台電腦
                const a = document.createElement('a')
                a.href = URL.createObjectURL(file)
                a.download = name
                a.click()
                setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
                return
            }
            onOpen(id)
        } finally {
            setOpening(null)
        }
    }
    // 只列這個對話畫面上的（AI 寫的成品、執行結果都掛在訊息上）；附加的檔案在下面「你附加的檔案」
    const pages = orderedItems(items, 'page').filter((p) => p.el?.isConnected)
    const runs = orderedItems(items, 'run').filter((r) => r.el?.isConnected)
    const made = messages.flatMap((m) => m.attachments ?? [])
    const attached = [...new Set(messages.flatMap((m) => m.files ?? []))]
    const row = 'flex w-full items-center gap-[var(--sp-10)] rounded-[var(--r-14)] px-[var(--sp-12)] py-[var(--sp-10)] text-left text-[length:var(--fs-14)] text-text-primary transition-colors'
    const heading = 'px-[var(--sp-12)] pb-[var(--sp-6)] text-[length:var(--fs-12)] font-semibold text-text-secondary'
    if (!pages.length && !runs.length && !made.length && !attached.length) {
        return <div className="flex min-h-0 flex-1 items-center justify-center text-[length:var(--fs-14)] text-text-secondary">{t('ui.chat.sidePanel.empty')}</div>
    }
    return (
        <div className="min-h-0 flex-1 overflow-auto p-[var(--sp-10)] flex flex-col gap-[var(--sp-16)]">
            {pages.length > 0 && (
                <section>
                    <h3 className={heading}>{t('ui.chat.sidePanel.previews')}</h3>
                    {pages.map((p) => (
                        <button key={p.id} type="button" className={`${row} hover:bg-[var(--chip)]`} onClick={() => onOpen(p.id)}>
                            <MaterialIcon name="code" size={18} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{pageTitle(p, items, t)}</span>
                        </button>
                    ))}
                </section>
            )}
            {runs.length > 0 && (
                <section>
                    <h3 className={heading}>{t('ui.chat.sidePanel.runs')}</h3>
                    {runs.map((r, i) => (
                        <button key={r.id} type="button" className={`${row} hover:bg-[var(--chip)]`} onClick={() => onOpen(r.id)}>
                            <MaterialIcon name="play_arrow" size={18} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{t('ui.chat.sidePanel.runN', { n: i + 1 })}</span>
                        </button>
                    ))}
                </section>
            )}
            {made.length > 0 && (
                <section>
                    <h3 className={heading}>{t('ui.chat.sidePanel.aiFiles')}</h3>
                    <div className="px-[var(--sp-2)]"><FileAttachments files={made} /></div>
                </section>
            )}
            {attached.length > 0 && (
                <section>
                    <h3 className={heading}>{t('ui.chat.sidePanel.yourFiles')}</h3>
                    {attached.map((name) => (
                        <button key={name} type="button" className={`${row} hover:bg-[var(--chip)]`} onClick={() => void openAttached(name)} disabled={opening === name}>
                            <FileText className="h-[var(--sz-18)] w-[var(--sz-18)] shrink-0 text-accent" />
                            <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
                            {opening === name && <span className="shrink-0 text-[length:var(--fs-12)] text-text-secondary">{t('common.loading')}</span>}
                        </button>
                    ))}
                    <p className="px-[var(--sp-12)] pt-[var(--sp-4)] text-[length:var(--fs-12)] text-text-secondary">{t('ui.chat.sidePanel.yourFilesNote')}</p>
                </section>
            )}
        </div>
    )
}


/** 直接顯示內容的文字檔、程式碼檔 */
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'xml', 'log'])

function readAsText(file: File): Promise<string> {
    if (typeof file.text === 'function') return file.text()
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result ?? '')); r.readAsText(file) })
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result ?? '')); r.readAsDataURL(file) })
}
