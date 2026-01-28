/**
 * 訊息氣泡元件
 */

import { memo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import type { Message } from '../../types/chat'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
}

// 使用者頭像
const UserAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-sm">
        👤
    </div>
)

// AI 頭像
const AIAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm">
        🤖
    </div>
)

const MessageBubble = memo(({ message, isStreaming = false }: MessageBubbleProps) => {
    const isUser = message.role === 'user'

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* 頭像 */}
            <div className="flex-shrink-0 mt-1">
                {isUser ? <UserAvatar /> : <AIAvatar />}
            </div>

            {/* 訊息內容 */}
            <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={`rounded-2xl px-4 py-3 ${isUser
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm'
                        }`}
                >
                    {isUser ? (
                        // 使用者訊息直接顯示
                        <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                        // AI 訊息使用 Markdown 渲染
                        <>
                            {message.content ? (
                                <MarkdownRenderer content={message.content} />
                            ) : isStreaming ? (
                                <span className="inline-block w-2 h-5 bg-primary-500 animate-pulse" />
                            ) : null}
                        </>
                    )}
                </div>

                {/* 來源引用 */}
                {!isUser && message.sources && message.sources.length > 0 && (
                    <SourceCitations sources={message.sources} />
                )}

                {/* 時間戳記 */}
                <div className={`mt-1 text-xs text-slate-400 ${isUser ? 'text-right' : ''}`}>
                    {new Date(message.createdAt).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </div>
            </div>
        </div>
    )
})

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
