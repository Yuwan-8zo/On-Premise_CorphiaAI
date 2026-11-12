/**
 * 側欄的一列對話（一般聊天、專案資料夾內共用）
 */

import type { HTMLAttributes, PointerEvent } from 'react'
import { MoreHorizontal } from '@/components/snow/icons'
import Tooltip from '@/components/ui/Tooltip'
import type { Conversation } from '@/types/chat'
import { useTranslation } from 'react-i18next'
import { displayTitle } from '@/lib/conversationTitle'

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
    const { t } = useTranslation()
    return (
        <div
            ref={rowRef}
            {...pressProps}
            onClick={onSelect}
            className={`side-item group ${isCurrent ? 'is-current' : ''}`}
        >
            <span className="flex-1 min-w-0 truncate">{displayTitle(conv.title)}</span>
            {isBusy && <span className="conv-busy" role="status" aria-label={t('ui.sidebar.answering')} />}
            <div className={`side-actions transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                <Tooltip label={t('ui.sidebar.options')}>
                    <button onPointerDown={onMenuPointerDown} onClick={(e) => e.stopPropagation()}
                        data-conv-menu aria-label={t('ui.sidebar.options')} className={`icon-tap ${isMenuOpen ? 'bg-[var(--chip)] text-text-primary' : 'text-text-secondary'}`}>
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>
        </div>
    )
}
