/**
 * 側欄的一列對話（一般聊天、專案資料夾內共用）
 */

import type { HTMLAttributes, PointerEvent } from 'react'
import { MoreHorizontal } from '@/components/snow/icons'
import Tooltip from '@/components/ui/Tooltip'
import type { Conversation } from '@/types/chat'

interface ConversationRowProps {
    conv: Conversation
    isCurrent: boolean
    isMenuOpen: boolean
    /** 這個對話正在生成回答（可能在背景） */
    isBusy?: boolean
    rowRef: (el: HTMLDivElement | null) => void
    /** 長按開選單的事件 */
    pressProps: HTMLAttributes<HTMLDivElement>
    onSelect: () => void
    onMenuPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
}

export default function ConversationRow({ conv, isCurrent, isMenuOpen, isBusy = false, rowRef, pressProps, onSelect, onMenuPointerDown }: ConversationRowProps) {
    return (
        <div
            ref={rowRef}
            {...pressProps}
            onClick={onSelect}
            className={`side-item group ${isCurrent ? 'is-current' : ''}`}
        >
            <span className="flex-1 min-w-0 truncate">{conv.title}</span>
            {isBusy && <span className="conv-busy" role="status" aria-label="正在回答" />}
            <div className={`side-actions transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                <Tooltip label="選項">
                    <button onPointerDown={onMenuPointerDown} onClick={(e) => e.stopPropagation()}
                        aria-label="選項" className={`p-1.5 rounded-full ${isMenuOpen ? 'bg-[var(--chip)] text-text-primary' : 'text-text-secondary'}`}>
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>
        </div>
    )
}
