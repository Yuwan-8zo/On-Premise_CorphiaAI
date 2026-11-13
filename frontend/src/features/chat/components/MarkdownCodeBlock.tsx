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
import { copyText } from '@/lib/clipboard'
import { useDesktop } from '@/lib/desktop'
import { saveTextFile, suggestFilename } from '@/lib/saveTextFile'
import { PREVIEW_SANDBOX, buildPreviewDoc, isPreviewable } from '@/lib/previewDoc'
import { useTranslation } from 'react-i18next'

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('markdown', markdown)

/** 程式碼區塊右上角的小按鈕（複製、存檔共用同一個樣式） */
const CODE_BUTTON = 'inline-flex items-center gap-1 px-2 py-1 text-xs text-text-secondary bg-[var(--chip)] rounded transition-colors'

const CopyButton = ({ code }: { code: string }) => {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        if (await copyText(code)) {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            className={CODE_BUTTON}
        >
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={14} aria-hidden />
            {copied ? t('ui.message.copied') : t('ui.message.copy')}
        </button>
    )
}

/** 存成檔案：桌面版跳出另存新檔、寫到這台電腦；瀏覽器是一般下載 */
const SaveButton = ({ code, language }: { code: string; language: string }) => {
    const { t } = useTranslation()
    const isDesktop = useDesktop()
    return (
        <button
            type="button"
            onClick={() => void saveTextFile(suggestFilename(language), code, isDesktop)}
            className={CODE_BUTTON}
        >
            <MaterialIcon name="download" size={14} aria-hidden />
            {t(isDesktop ? 'ui.chat.codeFile.save' : 'ui.chat.codeFile.download')}
        </button>
    )
}

const MarkdownCodeBlock = memo(({
    language,
    children,
}: {
    language: string
    children: string
}) => {
    const { t } = useTranslation()
    // HTML／SVG 可以直接看成品（關在沙盒裡、不能連網，見 lib/previewDoc）
    const canPreview = isPreviewable(language, children)
    const [preview, setPreview] = useState(false)
    return (
    <div className="relative group my-4">
        {language && (
            <div className="absolute top-0 left-0 px-2 py-1 text-xs text-text-secondary bg-[var(--chip)] rounded-tl rounded-br">
                {language}
            </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {canPreview && (
                <button type="button" aria-pressed={preview} onClick={() => setPreview((v) => !v)} className={CODE_BUTTON}>
                    <MaterialIcon name={preview ? 'code' : 'visibility'} size={14} aria-hidden />
                    {t(preview ? 'ui.chat.codeFile.showCode' : 'ui.chat.codeFile.preview')}
                </button>
            )}
            <SaveButton code={children} language={language} />
            <CopyButton code={children} />
        </div>
        {preview ? (
            <div className="rounded-[var(--r-12)] overflow-hidden border border-[var(--paper-line)] bg-[var(--chip)] pt-[var(--sz-40)]">
                <iframe
                    title={t('ui.chat.codeFile.previewTitle')}
                    sandbox={PREVIEW_SANDBOX}
                    referrerPolicy="no-referrer"
                    srcDoc={buildPreviewDoc(children)}
                    className="block w-full h-[var(--sz-320)] border-0 bg-white"
                />
            </div>
        ) : (
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
        )}
    </div>
    )
})

MarkdownCodeBlock.displayName = 'MarkdownCodeBlock'

export default MarkdownCodeBlock
