/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import type { Message } from '../../types/chat'
import { CorphiaLogo, CorphiaThinkingIcon } from '../icons/CorphiaIcons'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
}

/**
 * AI 品牌頭像
 *
 * 動態與靜態 icon 疊放在同一個容器中，透過 opacity + transition 做 cross-fade：
 * - isStreaming=true  → 動態 thinking icon 可見，靜態 logo 隱藏
 * - isStreaming=false → 靜態 logo 可見，  動態 thinking icon 隱藏
 */
const AIAvatar = ({ isStreaming }: { isStreaming: boolean }) => (
    <div className="relative w-8 h-8 flex-shrink-0">
        {/* 【底層】動態 Thinking Icon — streaming 時可見 */}
        <span
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: isStreaming ? 1 : 0 }}
        >
            <CorphiaThinkingIcon className="w-7 h-7 text-ios-blue-light dark:text-ios-blue-dark" />
        </span>

        {/* 【上層】靜態 Logo — streaming 結束後淡入 */}
        <span
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: isStreaming ? 0 : 1 }}
        >
            <CorphiaLogo className="w-8 h-8" />
        </span>
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
                    {/* 頭像固定靠左，動態/靜態 cross-fade */}
                    <div className="mt-1 flex-shrink-0">
                        <AIAvatar isStreaming={isStreaming && !message.content} />
                    </div>

                    {/* 內容區塊 */}
                    <div className="flex-1 min-w-0 text-gray-900 dark:text-gray-100 text-[15.5px] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-ios-dark-gray6 prose-pre:rounded-[12px] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/5 max-w-none">
                                <MarkdownRenderer content={message.content} />
                            </div>
                        ) : isStreaming ? (
                            // NOTE: 空白佔位，讓動態 icon 撐起高度，避免訊息列高度 = 0
                            <div className="h-8" />
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
