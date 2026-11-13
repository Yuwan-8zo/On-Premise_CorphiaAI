/**
 * 對話分支的版本切換：「‹ 2/3 ›」
 *
 * 修改問題重送、或請 AI 重答之後，舊的那一版還留著；這裡讓使用者切回去看、或接著那一版繼續聊。
 * 只有一版時不顯示。一直看得到（不是滑鼠移上去才出現），不然使用者不會知道還有別的版本。
 */
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from '@/components/snow/icons'

interface VersionSwitcherProps {
    /** 這個位置的所有版本（照建立順序） */
    ids: string[]
    currentId: string
    onSwitch: (messageId: string) => void
    /** 正在生成時不能切換 */
    disabled?: boolean
}

export default function VersionSwitcher({ ids, currentId, onSwitch, disabled = false }: VersionSwitcherProps) {
    const { t } = useTranslation()
    const index = ids.indexOf(currentId)
    if (ids.length < 2 || index < 0) return null
    const button = 'btn-icon btn-icon-plain msg-act !w-[var(--tap-msg)] !h-[var(--tap-msg)] text-text-muted disabled:opacity-30'
    return (
        <div className="inline-flex items-center gap-0.5 text-text-muted text-[length:var(--fs-13)] select-none" role="group" aria-label={t('ui.message.versions')}>
            <button type="button" className={button} disabled={disabled || index === 0} aria-label={t('ui.message.prevVersion')} onClick={() => onSwitch(ids[index - 1])}>
                <ChevronLeft />
            </button>
            <span className="tabular-nums" aria-live="polite">{index + 1}/{ids.length}</span>
            <button type="button" className={button} disabled={disabled || index === ids.length - 1} aria-label={t('ui.message.nextVersion')} onClick={() => onSwitch(ids[index + 1])}>
                <ChevronRight />
            </button>
        </div>
    )
}
