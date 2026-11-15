/**
 * 側欄的一列對話（一般聊天、專案資料夾內共用）
 */

import type { HTMLAttributes, MouseEvent, PointerEvent } from 'react'
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
    /** 「⋯」的按下／點擊（按住可直接拖進選單，見 lib/menuDrag） */
    menuButtonProps: { onPointerDown: (e: PointerEvent<HTMLElement>) => void; onClick: (e: MouseEvent<HTMLElement>) => void; className: string }
}

export default function ConversationRow({ conv, isCurrent, isMenuOpen, isBusy = false, rowRef, pressProps, onSelect, menuButtonProps }: ConversationRowProps) {
    const { t } = useTranslation()
    return (
        <div
            ref={rowRef}
            {...pressProps}
            onClick={onSelect}
            data-lens-row
            className={`side-item group ${isCurrent ? 'is-current' : ''}`}
        >
            <span className="flex-1 min-w-0 truncate">{displayTitle(conv.title)}</span>
            {isBusy && <span className="conv-busy" role="status" aria-label={t('ui.sidebar.answering')} />}
            <div className={`side-actions hover-reveal ${isMenuOpen ? 'is-open' : ''}`}>
                <Tooltip label={t('ui.sidebar.options')}>
                    <button onPointerDown={menuButtonProps.onPointerDown} onClick={menuButtonProps.onClick}
                        data-conv-menu aria-label={t('ui.sidebar.options')} aria-haspopup="menu" aria-expanded={isMenuOpen} className={`${menuButtonProps.className} icon-tap ${isMenuOpen ? 'bg-[var(--chip)] text-text-primary' : 'text-text-secondary'}`}>
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </Tooltip>
            </div>
        </div>
    )
}
