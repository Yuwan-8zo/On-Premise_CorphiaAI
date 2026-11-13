/**
 * 每則回答下面的連網標示：這一則有沒有連外網。
 *
 *   - 已連外網：顯示送出去的關鍵字（只有這幾個詞離開這台主機）和查到幾筆；點開看每一筆的標題與網址
 *   - 未連外網：一行小字；可以連網時（管理者沒有關掉）旁邊有「連網重答」，同一題這次連外網查了再答
 *   - 被擋下來：說明原因（列管字詞、搜尋服務連不上），當成未連外網
 *
 * 資料來自後端存在這則訊息上的紀錄（重新整理後還在）；沒有紀錄（舊訊息、系統沒開對外搜尋）就不顯示。
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Globe, Lock } from '@/components/snow/icons'
import type { MessageWebSearch } from '@/types/chat'

interface WebSearchNoteProps {
    info: MessageWebSearch
    /** 連網重答；沒給（政策是完全不連外網、或正在生成）就不顯示那顆按鈕 */
    onSearchAgain?: () => void
}

export default function WebSearchNote({ info, onSearchAgain }: WebSearchNoteProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const sources = info.sources ?? []
    const rowClass = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--fs-13)] text-text-muted'

    if (!info.used) {
        return (
            <div className={`mt-3 ${rowClass}`} data-testid="web-search-note">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>
                    {info.blocked
                        ? t('chat.webNote.blocked', { reason: info.blocked })
                        : info.suggested
                          ? t('chat.webNote.suggested')
                          : t('chat.webNote.offline')}
                </span>
                {onSearchAgain && !info.blocked && (
                    <button type="button" onClick={onSearchAgain} className="text-accent hover:underline select-none">
                        {t('chat.webNote.searchAgain')}
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="mt-3" data-testid="web-search-note">
            <button
                type="button"
                aria-expanded={open}
                disabled={sources.length === 0}
                onClick={() => setOpen((v) => !v)}
                className={`${rowClass} text-left enabled:hover:text-text-secondary transition-colors select-none`}
            >
                <Globe className="w-4 h-4 flex-shrink-0 text-accent" />
                <span>{t('chat.webNote.online', { query: info.query ?? '', n: sources.length })}</span>
                {sources.length > 0 && <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />}
            </button>
            {open && (
                <ul className="mt-1.5 pl-3 border-l-2 border-[var(--paper-line)] flex flex-col gap-1.5 text-[length:var(--fs-13)]">
                    {sources.map((s) => (
                        <li key={s.url} className="min-w-0">
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-text-secondary hover:text-accent">
                                {s.title || s.url}
                            </a>
                            <span className="block truncate text-text-muted text-[length:var(--fs-11)] selectable-text">{s.url}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
