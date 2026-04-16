/**
 * 訊息氣泡元件 (ChatGPT UI 復刻版)
 */

import { memo, useState } from 'react'
import MarkdownRenderer from './MarkdownRenderer'
import SourceCitations from './SourceCitations'
import type { Message } from '../../types/chat'
import { CorphiaLogo, CorphiaThinkingIcon } from '../icons/CorphiaIcons'
import { Copy, Edit2, Check, X } from 'lucide-react'
import { conversationsApi } from '../../api/conversations'
import { useChatStore } from '../../store/chatStore'

interface MessageBubbleProps {
    message: Message
    isStreaming?: boolean
    onResubmit?: (messageId: string, content: string) => void
}

/**
 * AI 品牌頭像
 *
 * 動態與靜態 icon 疊放在同一個容器中，透過 opacity + transition 做 cross-fade：
 * - isStreaming=true  → 動態 thinking icon 可見，靜態 logo 隱藏
 * - isStreaming=false → 靜態 logo 可見，  動態 thinking icon 隱藏
 */
const AIAvatar = ({ isStreaming }: { isStreaming: boolean }) => (
    <div className="relative w-8 h-8 flex-shrink-0 -mt-[2px]">
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

const MessageBubble = memo(({ message, isStreaming = false, onResubmit }: MessageBubbleProps) => {
    const isUser = message.role === 'user'
    
    // 編輯狀態
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(message.content)

    // 處理複製
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content)
        } catch (err) {
            console.error('複製失敗:', err)
        }
    }

    // 處理儲存編輯
    const handleSaveEdit = async () => {
        if (!editContent.trim() || editContent === message.content) {
            setIsEditing(false)
            return
        }
        
        try {
            // 先樂觀更新 UI
            useChatStore.getState().updateMessage(message.id, { content: editContent })
            setIsEditing(false)
            
            if (onResubmit) {
                // 如果有提供 onResubmit，代表此為重新生成流程，由上層處理截斷與重送
                onResubmit(message.id, editContent)
            } else {
                // 實際呼叫 API 更新後端資料庫 (單純更新文字，不重新生成)
                if (!message.id.startsWith('temp-')) {
                    await conversationsApi.updateMessageText(message.id, editContent)
                }
            }
        } catch (err) {
            console.error('更新訊息失敗:', err)
            // 若失敗可選擇回復原狀態
            useChatStore.getState().updateMessage(message.id, { content: message.content })
        }
    }

    return (
        <div id={`msg-${message.id}`} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
            {isUser ? (
                // 使用者訊息：極簡深灰圓角氣泡，靠右，無頭像
                <div className="flex flex-col items-end max-w-[75%] group">
                    <div className="bg-gray-100 dark:bg-ios-dark-gray5 text-gray-900 dark:text-gray-100 rounded-[20px] px-5 py-3 whitespace-pre-wrap text-[15.5px] leading-relaxed relative">
                        {isEditing ? (
                            <div className="flex flex-col gap-2 min-w-[250px]">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full bg-white dark:bg-ios-dark-gray4 text-gray-900 dark:text-gray-100 rounded-lg p-2 outline-none resize-none border border-gray-200 dark:border-gray-700 focus:border-ios-blue-light focus:ring-1 focus:ring-ios-blue-light"
                                    rows={Math.min(5, editContent.split('\n').length || 1)}
                                />
                                <div className="flex justify-end gap-2 mt-1">
                                    <button onClick={() => { setEditContent(message.content); setIsEditing(false); }} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-200 dark:bg-ios-dark-gray4 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full transition-colors flex items-center justify-center shadow-sm" title="取消">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleSaveEdit} className="p-1.5 text-white bg-ios-blue-light dark:bg-ios-blue-dark hover:opacity-80 rounded-full transition-colors flex items-center justify-center shadow-sm" title="儲存修改">
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            message.content
                        )}
                    </div>
                    {/* 工具列，滑鼠移入 (group-hover) 時浮現 */}
                    {!isEditing && (
                        <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 dark:text-gray-500 mr-2">
                            <button onClick={handleCopy} className="p-1 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors" title="複製">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setEditContent(message.content); setIsEditing(true); }} className="p-1 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors" title="編輯">
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // AI 訊息：無背景框，流暢文字排版，包含頭像，靠左
                <div className="w-full flex items-start gap-3">
                    {/* 頭像固定靠左，與文字首段齊平 */}
                    <div className="flex-shrink-0">
                        <AIAvatar isStreaming={isStreaming && !message.content} />
                    </div>

                    {/* 內容區塊 */}
                    <div className="flex-1 min-w-0 text-gray-900 dark:text-gray-100 text-[15.5px] leading-relaxed pb-4">
                        {message.content ? (
                            <div className="prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-ios-dark-gray6 prose-pre:rounded-[12px] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/5 max-w-none [&_.markdown-body>*:first-child]:!mt-0">
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
