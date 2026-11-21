/**
 * 側欄的一列對話（一般聊天、專案資料夾內共用）
 *
 *   手機：往左滑露出「重新命名」「刪除」（lib/useSwipeReveal）；電腦用「⋯」和長按
 */

import { useCallback, useRef, type HTMLAttributes, type MouseEvent, type PointerEvent } from 'react'
import { Edit2, MoreHorizontal, Trash2 } from '@/components/snow/icons'
import { useSwipeReveal } from '@/lib/useSwipeReveal'
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
    /** 手機往左滑露出的動作；沒給（電腦）就不能滑 */
    swipe?: { onRename: () => void; onDelete: (e: MouseEvent) => void }
}

export default function ConversationRow({ conv, isCurrent, isMenuOpen, isBusy = false, rowRef, pressProps, onSelect, menuButtonProps, swipe }: Readonly<ConversationRowProps>) {
    const { t } = useTranslation()
    const swipeRef = useSwipeReveal(Boolean(swipe))
    // rowRef 每次重畫都是新的函式：存起來，ref 本身保持不變（不然滑開的狀態會在重畫時被清掉）
    const rowRefLatest = useRef(rowRef)
    rowRefLatest.current = rowRef
    const ref = useCallback((el: HTMLDivElement | null) => { rowRefLatest.current(el); swipeRef(el) }, [swipeRef])
    // 滑出來的按鈕：不要觸發整列的長按、點擊
    const stop = { onPointerDown: (e: PointerEvent) => e.stopPropagation() }
    return (
        <div
            ref={ref}
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
            {swipe && (
                <div className="swipe-actions" {...stop}>
                    <button type="button" className="swipe-btn" aria-label={t('chat.renameChat')} title={t('chat.renameChat')} onClick={(e) => { e.stopPropagation(); swipe.onRename() }}>
                        <Edit2 aria-hidden />
                    </button>
                    <button type="button" className="swipe-btn is-danger" aria-label={t('common.delete')} title={t('common.delete')} onClick={(e) => { e.stopPropagation(); swipe.onDelete(e) }}>
                        <Trash2 aria-hidden />
                    </button>
                </div>
            )}
        </div>
    )
}
