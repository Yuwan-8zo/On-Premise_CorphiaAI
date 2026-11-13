/**
 * 程式碼高亮 — 僅註冊常用語言，縮小 markdown chunk。
 */
import { memo, useMemo, useState } from 'react'
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
import { PREVIEW_SANDBOX, buildPreviewDoc, isPreviewable } from '@/lib/previewDoc'
import { isRunnable } from '@/lib/pyRunner'
import { useSidePanelItem } from '@/features/chat/hooks/useSidePanelItem'
import { CODE_BUTTON, CopyButton, OpenInPanelButton, SaveButton } from './CodeButtons'
import CodeRunPanel from './CodeRunPanel'
import { useTranslation } from 'react-i18next'

SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('markdown', markdown)

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
    // 可以預覽的成品也能放到旁邊的顯示面板看（比較大、可以切換版本）
    const panelContent = useMemo(() => (canPreview ? { kind: 'page' as const, code: children, language } : null), [canPreview, children, language])
    const { ref, openInPanel, shownInPanel } = useSidePanelItem(panelContent)
    return (
    <div ref={ref} className="relative group my-4">
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
            {canPreview && <OpenInPanelButton onOpen={openInPanel} shown={shownInPanel} />}
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
        {/* Python 可以直接執行（在這台裝置瀏覽器的沙盒裡，不在主機上；見 lib/pyRunner） */}
        {isRunnable(language) && <CodeRunPanel code={children} />}
    </div>
    )
})

MarkdownCodeBlock.displayName = 'MarkdownCodeBlock'

export default MarkdownCodeBlock
