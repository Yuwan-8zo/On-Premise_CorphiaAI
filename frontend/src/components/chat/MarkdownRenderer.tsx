/**
 * Markdown 渲染元件
 * 
 * 支援 GFM、程式碼高亮、數學公式
 */

import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// @ts-expect-error - no types available
import remarkMark from 'remark-mark'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownRendererProps {
    content: string
    className?: string
}

// 複製按鈕元件
const CopyButton = ({ code }: { code: string }) => {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('複製失敗:', err)
        }
    }

    return (
        <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-1 text-xs text-slate-400 hover:text-white 
               bg-slate-700 hover:bg-slate-600 rounded transition-colors"
        >
            {copied ? '已複製 ✓' : '複製'}
        </button>
    )
}

// 程式碼區塊元件
const CodeBlock = memo(({
    language,
    children
}: {
    language: string
    children: string
}) => {
    return (
        <div className="relative group my-4">
            {/* 語言標籤 */}
            {language && (
                <div className="absolute top-0 left-0 px-2 py-1 text-xs text-slate-400 bg-slate-800 rounded-tl rounded-br">
                    {language}
                </div>
            )}

            {/* 複製按鈕 */}
            <CopyButton code={children} />

            {/* 程式碼內容 */}
            <SyntaxHighlighter
                language={language || 'text'}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    borderRadius: '0.5rem',
                    padding: '2rem 1rem 1rem',
                }}
                showLineNumbers={children.split('\n').length > 3}
                wrapLines
            >
                {children}
            </SyntaxHighlighter>
        </div>
    )
})

CodeBlock.displayName = 'CodeBlock'

// 錯誤捕獲邊界，防止 Markdown 解析失敗導致整個畫面黑屏
class MarkdownErrorBoundary extends React.Component<
    { children: React.ReactNode; fallbackContent: any },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode; fallbackContent: any }) {
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
                <div className="text-red-500 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-900/30">
                    <p className="font-bold mb-2">解析訊息內容時發生錯誤</p>
                    <div className="text-sm font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-300">
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
    const safeContent = typeof content === 'string' ? content : String(content || '')
    
    return (
        <MarkdownErrorBoundary fallbackContent={safeContent}>
            <div className={`markdown-body ${className}`}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMark]}
                    components={{
                        // 程式碼區塊
                        code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '')
                            const isInline = !match && !String(children).includes('\n')

                            if (isInline) {
                                return (
                                    <code
                                        className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400 
                               rounded text-sm font-mono"
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                )
                            }

                            return (
                                <CodeBlock language={match?.[1] || ''}>
                                    {String(children).replace(/\n$/, '')}
                                </CodeBlock>
                            )
                        },

                        // 標題
                        h1: ({ children }) => (
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-6 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-5 mb-3">
                                {children}
                            </h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-2">
                                {children}
                            </h3>
                        ),

                        // 螢光筆/標記文字 (==文字==)
                        mark: ({ children }) => (
                            <mark className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400 rounded font-medium">
                                {children}
                            </mark>
                        ),

                        // 段落
                        p: ({ children }) => (
                            <p className="my-3 leading-relaxed text-slate-700 dark:text-slate-300">
                                {children}
                            </p>
                        ),

                        // 列表
                        ul: ({ children }) => (
                            <ul className="my-3 pl-6 list-disc text-slate-700 dark:text-slate-300 space-y-1">
                                {children}
                            </ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="my-3 pl-6 list-decimal text-slate-700 dark:text-slate-300 space-y-1">
                                {children}
                            </ol>
                        ),
                        li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                        ),

                        // 引用
                        blockquote: ({ children }) => (
                            <blockquote className="my-4 pl-4 border-l-4 border-primary-500 bg-slate-50 dark:bg-slate-800/50 py-2 italic text-slate-600 dark:text-slate-400">
                                {children}
                            </blockquote>
                        ),

                        // 連結
                        a: ({ href, children }) => (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 dark:text-primary-400 hover:underline"
                            >
                                {children}
                            </a>
                        ),

                        // 表格
                        table: ({ children }) => (
                            <div className="my-4 overflow-x-auto">
                                <table className="min-w-full border border-slate-200 dark:border-slate-700">
                                    {children}
                                </table>
                            </div>
                        ),
                        thead: ({ children }) => (
                            <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>
                        ),
                        th: ({ children }) => (
                            <th className="px-4 py-2 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                {children}
                            </th>
                        ),
                        td: ({ children }) => (
                            <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                {children}
                            </td>
                        ),

                        // 分隔線
                        hr: () => (
                            <hr className="my-6 border-slate-200 dark:border-slate-700" />
                        ),

                        // 強調
                        strong: ({ children }) => (
                            <strong className="font-semibold text-slate-800 dark:text-slate-100">{children}</strong>
                        ),
                        em: ({ children }) => (
                            <em className="italic">{children}</em>
                        ),

                        // 圖片
                        img: ({ src, alt }) => (
                            <img
                                src={src}
                                alt={alt || ''}
                                className="max-w-full h-auto rounded-[16px] my-4"
                            />
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
