/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import type { Message } from '../../types/chat'
import { CorphiaLogo } from '../icons/CorphiaIcons'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
}

// AI 品牌頭像：使用 Corphia 官方 Logo 圖示
const AIAvatar = () => (
    <div className="w-8 h-8 flex-shrink-0">
        <CorphiaLogo className="w-8 h-8" />
    </div>
)

const MessageBubble = memo(({ message, isStreaming = false }: MessageBubbleProps) => {
    const isUser = message.role === 'user'

    return (
        <div id={`msg-${message.id}`} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                <div className="max-w-[75%] bg-gray-100 dark:bg-ios-dark-gray5 text-gray-900 dark:text-gray-100 rounded-[20px] px-5 py-3 whitespace-pre-wrap text-[15.5px] leading-relaxed">
                    {message.content}
                </div>
            ) : (
                // AI 訊息：無背景框，流暢文字排版，包含頭像，靠左
                <div className="w-full flex items-start gap-3">
                    {/* 頭像固定靠左，對齊第一行文字 */}
                    <div className="mt-1 flex-shrink-0">
                        <AIAvatar />
                    </div>
                    
                    {/* 內容區塊 */}
                    <div className="flex-1 min-w-0 text-gray-900 dark:text-gray-100 text-[15.5px] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-ios-dark-gray6 prose-pre:rounded-[12px] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/5 max-w-none">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="font-semibold text-gray-500 dark:text-gray-400 text-[14px] mr-0.5">Thinking</span>
                                <span className="flex items-center gap-1">
                                    <span className="w-[5px] h-[5px] rounded-full bg-gray-500 dark:bg-gray-400 animate-typing-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-[5px] h-[5px] rounded-full bg-gray-500 dark:bg-gray-400 animate-typing-bounce" style={{ animationDelay: '200ms' }} />
                                    <span className="w-[5px] h-[5px] rounded-full bg-gray-500 dark:bg-gray-400 animate-typing-bounce" style={{ animationDelay: '400ms' }} />
                                </span>
                            </div>
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
