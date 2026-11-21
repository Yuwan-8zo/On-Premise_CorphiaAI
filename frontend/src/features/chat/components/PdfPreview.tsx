/**
 * 引用原文預覽（react-pdf 10，MIT；React 18 只能用 10 版）
 *
 * 聊天回答的「參考來源」點「在原文中查看」→ 右側面板打開那份 PDF，被引用的段落標黃，並自動捲到第一處。
 *   - 檔案從後端 GET /documents/{id}/file 拿（權限和查看文件一樣，每次打開都寫稽核紀錄）
 *   - 全部離線：PDF 引擎（worker）、中文字碼表（cmaps）、標準字型都打包在系統裡（vite.config.ts 複製到 /pdfjs）
 *   - 比對方式見 utils/citeHighlight.ts
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'

import apiClient from '@/api/client'
import { escapeHtml, isQuoted, normalizeForMatch } from '../utils/citeHighlight'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const PDF_OPTIONS = {
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
}
/** 太長的檔案只畫前面這幾頁（預覽用，不是閱讀器） */
const MAX_PAGES = 60
/** 文字層停止更新多久之後才捲到標記（各頁畫好的順序不固定） */
const SETTLE_MS = 200

interface Props {
    documentId: string
    quote: string
}

export default function PdfPreview({ documentId, quote }: Readonly<Props>) {
    const { t } = useTranslation()
    const [file, setFile] = useState<{ data: Uint8Array } | null>(null)
    const [error, setError] = useState(false)
    const [pages, setPages] = useState(0)
    const [width, setWidth] = useState(0)
    const boxRef = useRef<HTMLDivElement>(null)
    const scrolled = useRef(false)
    const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const quoteNorm = useMemo(() => normalizeForMatch(quote), [quote])

    useEffect(() => {
        let stale = false
        setFile(null); setError(false); setPages(0); scrolled.current = false
        apiClient.get(`/documents/${documentId}/file`, { responseType: 'arraybuffer' })
            .then((r) => { if (!stale) setFile({ data: new Uint8Array(r.data as ArrayBuffer) }) })
            .catch(() => { if (!stale) setError(true) })
        return () => { stale = true }
    }, [documentId])

    // 頁面寬度跟著面板寬度（面板可以拉寬、全螢幕）
    useEffect(() => {
        const el = boxRef.current
        if (!el || typeof ResizeObserver === 'undefined') return
        // 頁面寬＝面板內容寬（扣掉 .pdf-preview 左右內距，數值在 CSS 定義一次）
        const inner = () => {
            const cs = getComputedStyle(el)
            return el.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight)
        }
        const ro = new ResizeObserver(() => setWidth(inner()))
        ro.observe(el)
        setWidth(inner())
        return () => ro.disconnect()
    }, [])

    // 換了一段引用（同一份檔案不重新下載）：允許再捲一次到新的標記
    // 文字層已經畫好的頁面不一定會再觸發 onTextLayer，所以主動排一次
    useEffect(() => {
        scrolled.current = false
        onTextLayer()
        return () => clearTimeout(settle.current)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quote])

    // 每一頁的文字層畫好後排一次捲動：各頁畫好的順序不固定（實測第 4 頁比第 1 頁先好），
    // 所以等文字層停止更新 SETTLE_MS 之後才捲，而且捲到「最長的」標記——最長的那行最能代表被引用的段落。
    // 只捲一次，之後使用者自己捲就不再搶。
    const onTextLayer = () => {
        if (scrolled.current) return
        clearTimeout(settle.current)
        settle.current = setTimeout(() => {
            const marks = Array.from(boxRef.current?.querySelectorAll('mark.cite-hl') ?? [])
            if (!marks.length) return
            const best = marks.reduce((a, b) => ((b.textContent?.length ?? 0) > (a.textContent?.length ?? 0) ? b : a), marks[0])
            scrolled.current = true
            best.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, SETTLE_MS)
    }

    return (
        <div ref={boxRef} className="pdf-preview min-h-0 flex-1 overflow-auto">
            {error && <p className="p-[var(--sp-16)] text-[length:var(--fs-14)] text-text-secondary">{t('ui.sources.pdfFailed')}</p>}
            {!error && !file && <output className="block p-[var(--sp-16)] text-[length:var(--fs-14)] text-text-secondary">{t('common.loading')}</output>}
            {file && width > 0 && (
                <Document
                    file={file}
                    options={PDF_OPTIONS}
                    onLoadSuccess={(pdf) => setPages(Math.min(pdf.numPages, MAX_PAGES))}
                    onLoadError={() => setError(true)}
                    loading={null}
                >
                    {Array.from({ length: pages }, (_, i) => (
                        <Page
                            key={i}
                            pageNumber={i + 1}
                            width={width}
                            renderAnnotationLayer={false}
                            customTextRenderer={({ str }) => (isQuoted(str, quoteNorm) ? `<mark class="cite-hl">${escapeHtml(str)}</mark>` : escapeHtml(str))}
                            onRenderTextLayerSuccess={onTextLayer}
                            className="pdf-page"
                            loading={null}
                        />
                    ))}
                </Document>
            )}
        </div>
    )
}
