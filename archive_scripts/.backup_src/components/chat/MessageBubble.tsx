/**
 * MessageBubble 訊息氣泡元件
 *
 * 顯示單一對話訊息，支援 Markdown 渲染與串流游標動畫
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '../../types/chat'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
    const isUser = message.role === 'user'

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* 頭像 */}
            <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium
                    ${isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 dark:bg-slate-600 text-white'
                    }`}
            >
                {isUser ? 'U' : 'AI'}
            </div>

            {/* 訊息內容 */}
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm
                    ${isUser
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm'
                    }`}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    const isBlock = Boolean(match)
                                    return isBlock ? (
                                        <SyntaxHighlighter
                                            style={oneDark}
                                            language={match![1]}
                                            PreTag="div"
                                            className="!rounded-lg !text-xs"
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code
                                            className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-xs"
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    )
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                        {/* 串流游標 */}
                        {isStreaming && (
                            <span className="inline-block w-2 h-4 bg-slate-400 dark:bg-slate-500 animate-pulse ml-0.5 align-middle rounded-sm" />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
