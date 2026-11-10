/**
 * 程式碼高亮 — 僅註冊常用語言，縮小 markdown chunk。
 */
import { memo, useState } from 'react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import MaterialIcon from '@/components/icons/MaterialIcon'

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('markdown', markdown)

const CopyButton = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false)

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
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-xs text-text-secondary bg-[var(--chip)]  rounded transition-colors"
        >
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={14} aria-hidden />
            {copied ? '已複製' : '複製'}
        </button>
    )
}

const MarkdownCodeBlock = memo(({
    language,
    children,
}: {
    language: string
    children: string
}) => (
    <div className="relative group my-4">
        {language && (
            <div className="absolute top-0 left-0 px-2 py-1 text-xs text-text-secondary bg-[var(--chip)] rounded-tl rounded-br">
                {language}
            </div>
        )}
        <CopyButton code={children} />
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
))

MarkdownCodeBlock.displayName = 'MarkdownCodeBlock'

export default MarkdownCodeBlock
