import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useUIStore } from '../store/uiStore'
import { Message } from '../types/chat'

interface MessageBubbleProps {
    message: Message
}

export const MessageBubble = memo(({ message }: MessageBubbleProps) => {
    const isUser = message.role === 'user'
    const theme = useUIStore((state) => state.theme)

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-sm ${isUser
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                    }`}
            >
                {isUser ? (
                    <div className="whitespace-pre-wrap text-base">{message.content}</div>
                ) : (
                    <div className="prose prose-slate dark:prose-invert max-w-none text-base">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={theme === 'dark' ? oneDark : oneLight}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                }
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>

                        {/* 來源引用 */}
                        {message.sources && message.sources.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-medium text-slate-500 mb-2">參考資料：</p>
                                <div className="flex flex-wrap gap-2">
                                    {message.sources.map((source, idx) => (
                                        <span
                                            key={idx}
                                            className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                            title={source.content}
                                        >
                                            📄 {source.documentName || 'Document'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
})

MessageBubble.displayName = 'MessageBubble'
