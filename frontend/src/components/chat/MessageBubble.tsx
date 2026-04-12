/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import type { Message } from '../../types/chat'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
}

// AI 簡約頭像 (ChatGPT 樣式：空心或簡潔的圖標)
const AIAvatar = () => (
    <div className="w-8 h-8 rounded-[12px] border border-gray-600 bg-transparent flex items-center justify-center flex-shrink-0">
        <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 text-gray-200">
            {/* 簡單的 AI / Star 圖示代表模型 */}
            <path d="M12 2l2.4 7.6H22l-6.2 4.5 2.4 7.6-6.2-4.5-6.2 4.5 2.4-7.6L2 9.6h7.6L12 2z" />
        </svg>
    </div>
)

const MessageBubble = memo(({ message, isStreaming = false }: MessageBubbleProps) => {
    const isUser = message.role === 'user'

    return (
        <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                <div className="max-w-[75%] bg-gray-100 dark:bg-ios-dark-gray5 text-gray-900 dark:text-gray-100 rounded-[20px] px-5 py-3 whitespace-pre-wrap text-[15.5px] leading-relaxed">
                    {message.content}
                </div>
            ) : (
                // AI 訊息：無背景框，流暢文字排版，包含頭像，靠左
                <div className="w-full flex gap-4">
                    {/* 頭像固定靠左，不隨內容拉伸 */}
                    <AIAvatar />
                    
                    {/* 內容區塊 */}
                    <div className="flex-1 min-w-0 pt-0.5 text-gray-900 dark:text-gray-100 text-[15.5px] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-ios-dark-gray6 prose-pre:rounded-[12px] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/5 max-w-none">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            <span className="inline-block w-3 h-3 rounded-full bg-gray-400 animate-pulse mt-1" />
                        ) : null}

                        {/* 來源引用 */}
                        {message.sources && message.sources.length > 0 && (
                            <div className="mt-4">
                                <SourceCitations sources={message.sources} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
