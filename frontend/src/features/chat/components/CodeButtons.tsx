/**
 * 程式碼區塊上的小按鈕：複製、存檔、在旁邊開啟（程式碼區塊和旁邊的顯示面板共用）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/components/icons/MaterialIcon'
import { PanelLeft } from '@/components/snow/icons'
import { copyText } from '@/lib/clipboard'
import { useDesktop } from '@/lib/desktop'
import { saveTextFile, suggestFilename } from '@/lib/saveTextFile'

/** 程式碼區塊上的小按鈕（疊在深色程式碼上，刻意做小） */
export const CODE_BUTTON = 'inline-flex items-center gap-1 px-2 py-1 text-xs text-text-secondary bg-[var(--chip)] rounded transition-colors disabled:opacity-50'

/** 面板標題列的按鈕：照《Liquid Glass 元件規範》的小型次要按鈕（膠囊、玻璃材質） */
export const PANEL_BUTTON = 'btn btn-sm btn-secondary'

interface ButtonLook {
    /** 按鈕樣式；不給＝程式碼區塊上的小按鈕 */
    className?: string
    iconSize?: number
}
/** 小按鈕的圖示大小；規範按鈕用大一級 */
const ICON_SM = 14
export const PANEL_ICON = 16

/** 複製後「已複製」顯示多久（毫秒） */
const COPIED_MS = 2000

export const CopyButton = ({ code, className = CODE_BUTTON, iconSize = ICON_SM }: { code: string } & ButtonLook) => {
    const { t } = useTranslation()
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        if (await copyText(code)) {
            setCopied(true)
            setTimeout(() => setCopied(false), COPIED_MS)
        }
    }

    return (
        <button type="button" onClick={handleCopy} className={className}>
            <MaterialIcon name={copied ? 'check' : 'content_copy'} size={iconSize} aria-hidden />
            {copied ? t('ui.message.copied') : t('ui.message.copy')}
        </button>
    )
}

/** 存成檔案：桌面版跳出另存新檔、寫到這台電腦；瀏覽器是一般下載 */
export const SaveButton = ({ code, language, className = CODE_BUTTON, iconSize = ICON_SM }: { code: string; language: string } & ButtonLook) => {
    const { t } = useTranslation()
    const isDesktop = useDesktop()
    return (
        <button type="button" onClick={() => void saveTextFile(suggestFilename(language), code, isDesktop)} className={className}>
            <MaterialIcon name="download" size={iconSize} aria-hidden />
            {t(isDesktop ? 'ui.chat.codeFile.save' : 'ui.chat.codeFile.download')}
        </button>
    )
}

/** 在旁邊的顯示面板開啟（已經開著的那一個會標成按下的狀態） */
export const OpenInPanelButton = ({ onOpen, shown }: { onOpen: () => void; shown: boolean }) => {
    const { t } = useTranslation()
    return (
        <button type="button" aria-pressed={shown} onClick={onOpen} className={`${CODE_BUTTON} ${shown ? '!text-accent' : ''}`}>
            {/* 圖示左右翻轉：面板在右邊 */}
            <PanelLeft className="w-3.5 h-3.5 -scale-x-100" aria-hidden />
            {t('ui.chat.sidePanel.open')}
        </button>
    )
}
