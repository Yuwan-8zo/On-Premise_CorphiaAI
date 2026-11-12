/**
 * Markdown 渲染元件
 * 
 * 支援 GFM、程式碼高亮、數學公式
 */

import React, { lazy, memo, Suspense } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** 圖片網址是不是本機的（同一台伺服器的相對或絕對路徑、data:image、blob:）；外部網址回 false */
function isLocalImage(src?: string): boolean {
    if (!src) return false
    if (/^(data:image\/|blob:)/i.test(src)) return true
    try {
        return new URL(src, window.location.href).origin === window.location.origin
    } catch {
        return false
    }
}

/**
 * 外部連結實際會連到哪個網站（主機名稱）；站內連結、不是 http(s) 的回 null。
 * 連結顯示的字可以和實際網址完全不同（「點這裡看詳情」其實連到別的網站、把資料帶在網址裡），
 * 所以外部連結一律在後面標出主機，讓使用者按之前看得到要去哪裡。
 */
function externalHost(href?: string): string | null {
    if (!href) return null
    try {
        const url = new URL(href, window.location.href)
        return /^https?:$/.test(url.protocol) && url.origin !== window.location.origin ? url.host : null
    } catch {
        return null
    }
}

/** 節點裡的純文字（用來判斷連結的字是不是已經寫出網站了） */
function nodeText(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(nodeText).join('')
    if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children)
    return ''
}

/**
 * 網址過濾：沿用套件的預設（擋掉 javascript: 之類），只多放行「圖片的內嵌資料」（data:image/…、blob:）。
 * 內嵌圖片的資料就在文字裡，不會連到任何地方；預設會把它整個清掉，結果被當成外部圖片顯示「已封鎖」。
 */
function urlTransform(url: string, key: string): string {
    if (key === 'src' && /^(data:image\/|blob:)/i.test(url)) return url
    return defaultUrlTransform(url)
}
import i18n from '@/i18n'

const MarkdownCodeBlock = lazy(() => import('./MarkdownCodeBlock'))

/** 模型輸出的 <br>、<br/> → 行分隔符號（U+2028）；不開放任意 HTML */
const LINE_BREAK = '\u2028'
const normalizeBreaks = (md: string) => md.replace(/<br\s*\/?>/gi, LINE_BREAK)

/** 表格儲存格：有換行時一行一塊；「- 」「• 」「* 」開頭的行做成凸排條列（第二行對齊文字，不對齊符號） */
function cellLines(children: React.ReactNode): React.ReactNode {
    const arr = React.Children.toArray(children)
    const text = arr.every((c) => typeof c === 'string') ? (arr as string[]).join('') : null
    if (text === null || !text.includes(LINE_BREAK)) {
        if (typeof text === 'string' && /^\s*[-•*]\s+/.test(text)) {
            return <span className="md-hang">{text.replace(/^\s*[-•*]\s+/, '')}</span>
        }
        return withBreaks(children)
    }
    return text.split(LINE_BREAK).map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line)
        return (
            <span key={i} className={bullet ? 'md-hang' : 'block'}>
                {bullet ? line.replace(/^\s*[-•*]\s+/, '') : line}
            </span>
        )
    })
}

/** 把文字裡的行分隔符號換成 <br />（只處理直接的文字節點） */
function withBreaks(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, (child) => {
        if (typeof child !== 'string' || !child.includes(LINE_BREAK)) return child
        const parts = child.split(LINE_BREAK)
        return parts.map((part, i) => (
            <React.Fragment key={i}>
                {i > 0 && <br />}
                {part}
            </React.Fragment>
        ))
    })
}

interface MarkdownRendererProps {
    content: string
    className?: string
}

// 錯誤捕獲邊界，防止 Markdown 解析失敗導致整個畫面黑屏
class MarkdownErrorBoundary extends React.Component<
    { children: React.ReactNode; fallbackContent: string },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode; fallbackContent: string }) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Markdown rendering error:', error, errorInfo, 'Content:', this.props.fallbackContent)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="text-[var(--ink-red)] p-4 bg-[color-mix(in_srgb,var(--sys-red)_10%,transparent)] rounded-[var(--r-10)] border border-[color-mix(in_srgb,var(--sys-red)_20%,transparent)]">
                    <p className="font-bold mb-2">{i18n.t('ui.misc.parseError')}</p>
                    <div className="text-sm font-mono whitespace-pre-wrap text-text-primary">
                        {String(this.props.fallbackContent || '')}
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

// 主元件
const MarkdownRenderer = memo(({ content, className = '' }: MarkdownRendererProps) => {
    // 確保 content 一定是字串，防止因為 undefined 或 obj 導致 react-markdown 崩潰
    const safeContent = normalizeBreaks(typeof content === 'string' ? content : String(content || ''))
    
    return (
        <MarkdownErrorBoundary fallbackContent={safeContent}>
            <div className={`markdown-body ${className}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={urlTransform}
                    components={{
                        // 程式碼區塊
                        code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '')
                            const isInline = !match && !String(children).includes('\n')

                            if (isInline) {
                                return (
                                    <code
                                        className="px-1.5 py-0.5 bg-[var(--chip)] text-accent rounded text-sm font-mono"
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                )
                            }

                            return (
                                <Suspense
                                    fallback={
                                        <pre className="my-4 p-4 rounded-[var(--r-14)] bg-[var(--chip)] text-sm overflow-x-auto">
                                            {String(children).replace(/\n$/, '')}
                                        </pre>
                                    }
                                >
                                    <MarkdownCodeBlock language={match?.[1] || ''}>
                                        {String(children).replace(/\n$/, '')}
                                    </MarkdownCodeBlock>
                                </Suspense>
                            )
                        },

                        // 標題
                        h1: ({ children }) => (
                            <h1 className="text-2xl font-bold text-text-primary mt-6 mb-4 border-b border-[var(--paper-line)] pb-2">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-xl font-bold text-text-primary mt-5 mb-3">
                                {children}
                            </h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className="text-lg font-semibold text-text-primary mt-4 mb-2">
                                {children}
                            </h3>
                        ),

                        // 螢光筆/標記文字 (==文字==)
                        mark: ({ children }) => (
                            <mark className="px-1.5 py-0.5 bg-[var(--chip)] text-accent rounded font-medium">
                                {children}
                            </mark>
                        ),

                        // 段落
                        p: ({ children }) => (
                            <p className="my-3 leading-relaxed text-text-primary">
                                {withBreaks(children)}
                            </p>
                        ),

                        // 列表
                        ul: ({ children }) => (
                            <ul className="my-3 pl-6 list-disc text-text-primary space-y-1">
                                {children}
                            </ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="my-3 pl-6 list-decimal text-text-primary space-y-1">
                                {children}
                            </ol>
                        ),
                        li: ({ children }) => (
                            <li className="leading-relaxed">{withBreaks(children)}</li>
                        ),

                        // 引用
                        blockquote: ({ children }) => (
                            <blockquote className="my-4 pl-4 border-l-4 border-accent bg-[var(--chip)] py-2 italic text-text-secondary">
                                {children}
                            </blockquote>
                        ),

                        // 連結
                        // 外部連結：字的後面標出實際的網站（字裡已經寫了就不重複），滑鼠停著看得到完整網址
                        a: ({ href, children }) => {
                            const host = externalHost(href)
                            return (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={host ? href : undefined}
                                    className="text-accent "
                                >
                                    {children}
                                    {host && !nodeText(children).includes(host) && <span className="md-link-host">{host}</span>}
                                </a>
                            )
                        },

                        // 表格
                        table: ({ children }) => (
                            <div className="md-table glass-chip my-4 overflow-x-auto overflow-y-hidden scrollbar-none">
                                <table>{children}</table>
                            </div>
                        ),
                        th: ({ children }) => <th>{withBreaks(children)}</th>,
                        td: ({ children }) => <td>{cellLines(children)}</td>,

                        // 分隔線
                        hr: () => (
                            <hr className="my-6 border-[var(--paper-line)]" />
                        ),

                        // 強調 (改由 index.css 統一由 --color-ios-accent 控制顏色與螢光筆效果)
                        strong: ({ children }) => (
                            <strong className="font-semibold relative whitespace-pre-wrap">
                                {children}
                            </strong>
                        ),
                        em: ({ children }) => (
                            <em className="italic">{children}</em>
                        ),

                        // 圖片
                        // 只顯示本機的圖片（同一台伺服器、data:、blob:）。外部網址一律不載入：
                        // 瀏覽器一載入就等於連到外面，被惡意內容誘導的回答可以把資料帶在網址裡送出去
                        img: ({ src, alt }) =>
                            isLocalImage(src) ? (
                                <img
                                    src={src}
                                    alt={alt || ''}
                                    className="max-w-full h-auto rounded-[var(--r-16)] my-4"
                                />
                            ) : (
                                <span className="tag">{i18n.t('ui.chat.imageBlocked', { alt: alt || '' }).trim()}</span>
                            ),
                    }}
                >
                    {safeContent}
                </ReactMarkdown>
            </div>
        </MarkdownErrorBoundary>
    )
})

MarkdownRenderer.displayName = 'MarkdownRenderer'

export default MarkdownRenderer
