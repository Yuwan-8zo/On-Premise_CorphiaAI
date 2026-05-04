/**
 * NgrokSidebarWidget — Admin sidebar 底部的 ngrok 控制（按鈕版）
 * -------------------------------------------------------------
 * 不再內嵌 QR；改成「點 QR 按鈕彈出大 modal」的設計。
 * 整個 widget 是窄的一條，只有：
 *
 *   ON 時：
 *     ┌────────────────────┐
 *     │ [globe] 公開網址  [QR] [Copy] │
 *     │ ─────────────────── │
 *     │ 已啟動    [toggle on] │
 *     └────────────────────┘
 *
 *   OFF 時（更精簡）：
 *     ┌────────────────────┐
 *     │ [globe] 未啟動  [toggle off] │
 *     └────────────────────┘
 *
 *   離線時（isOffline=true）：
 *     ┌────────────────────┐
 *     │ [wifi-off] 離線  [toggle 仍可點] │
 *     └────────────────────┘
 *   點下去仍會走 onStart，但 AdminPage 會攔下並顯示 toast，
 *   不靜默 disable，讓使用者明確知道為什麼按了沒反應。
 *
 * QR / Copy 按鈕只在 ON 時出現；點 QR 觸發 onShowQr 開大 modal。
 */

import { Clipboard, ClipboardCheck, Globe, QrCode, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import ToggleSwitch from './ToggleSwitch'

interface NgrokInfo {
    active: boolean
    url?: string | null
    api_url?: string | null
    ws_url?: string | null
}

export interface NgrokSidebarWidgetProps {
    info: NgrokInfo | null
    isLoading: boolean
    copied: boolean
    /**
     * 使用者目前是否離線（navigator.onLine === false）。
     * Corphia AI 主體 100% 地端可用，這旗標只影響「公開網址」這項功能。
     * 離線時 widget 改顯示警告色與離線 icon，並把 ngrok 啟動視為無效操作；
     * 點下去仍會觸發 onStart（在父層被攔截後 toast 提示），不靜默 disable。
     */
    isOffline?: boolean
    onCopyUrl: () => void
    onShowQr: () => void
    onStart: () => void
    onStop: () => void
}

export default function NgrokSidebarWidget({
    info,
    isLoading,
    copied,
    isOffline = false,
    onCopyUrl,
    onShowQr,
    onStart,
    onStop,
}: NgrokSidebarWidgetProps) {
    const { t } = useTranslation()
    const isActive = Boolean(info?.active && info?.url)

    // 離線且尚未啟動時，整個 widget 的 icon / 文字改用警告色語意。
    // 已啟動的情況（isActive）即便瀏覽器報離線也保持原樣，因為通道狀態
    // 是後端在管的，前端的 navigator.onLine 不是判斷依據。
    const showOfflineState = isOffline && !isActive

    // 主 icon：離線時換成 WifiOff，已啟動或正常時都用 Globe
    const MainIcon = showOfflineState ? WifiOff : Globe

    // icon 容器配色：離線用 amber 警告色，否則維持 accent
    const iconWrapClass = showOfflineState
        ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-cv-sm bg-amber-500/15 text-amber-500 dark:text-amber-400'
        : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-cv-sm bg-accent/10 text-accent'

    // 狀態文字：離線優先；其次依 isActive / isLoading
    const statusText = showOfflineState
        ? t('admin.ngrok.offlineBadge', '離線')
        : isActive
            ? t('admin.ngrok.activeStatus', '已啟動')
            : isLoading
                ? t('admin.ngrok.starting', '啟動中…')
                : t('admin.ngrok.inactive', '未啟動')

    const statusTextClass = showOfflineState
        ? 'text-[10px] text-amber-600 dark:text-amber-400 leading-tight mt-0.5'
        : 'text-[10px] text-text-secondary leading-tight mt-0.5'

    return (
        // pt-3 給跟上方 nav 的視覺間距。
        // 推到 sidebar 底的 mt-auto 由外層 wrapper（AdminPage 的 .hidden.lg:block.mt-auto）負責，
        // 避免 wrapper / widget 兩層 mt-auto 互相干擾。
        <div className="pt-3">
            <div className="rounded-cv-md border border-white/50 dark:border-white/20 bg-bg-surface/60 supports-[backdrop-filter]:bg-bg-surface/45 backdrop-blur-xl p-2 shrink-0">
                {/* 主資訊行：icon + 狀態文字 + 操作按鈕 */}
                <div className="flex items-center gap-1.5">
                    <span className={iconWrapClass}>
                        <MainIcon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-medium uppercase tracking-[0.16em] text-text-muted leading-none">
                            Remote
                        </p>
                        <p className={statusTextClass}>
                            {statusText}
                        </p>
                    </div>

                    {/* 啟動時才顯示的 QR + 複製按鈕 */}
                    {isActive && (
                        <>
                            <button
                                onClick={onShowQr}
                                title={t('admin.ngrok.showQr', '顯示 QR Code')}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition hover:bg-accent/20"
                            >
                                <QrCode className="h-3 w-3" />
                            </button>
                            <button
                                onClick={onCopyUrl}
                                title={info?.url ?? undefined}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-accent transition hover:bg-accent/20"
                            >
                                {copied ? (
                                    <ClipboardCheck className="h-3 w-3" />
                                ) : (
                                    <Clipboard className="h-3 w-3" />
                                )}
                            </button>
                        </>
                    )}
                </div>

                {/* 啟用 toggle（一律顯示，跟主資訊行隔一條細分隔線） */}
                <div className="mt-1.5 flex items-center justify-between border-t border-border-subtle pt-1.5">
                    <span className="text-[10px] font-medium text-text-secondary">
                        {isActive
                            ? t('admin.ngrok.toggleOnLabel', '啟用')
                            : t('admin.ngrok.toggleOffLabel', '啟用')}
                    </span>
                    <ToggleSwitch
                        checked={isActive}
                        loading={isLoading}
                        onChange={() => {
                            if (isActive) onStop()
                            else onStart()
                        }}
                        aria-label={
                            isActive
                                ? t('admin.ngrok.toggleOff', '關閉公開隧道')
                                : showOfflineState
                                    ? t('admin.ngrok.offlineDisabledTooltip', '目前離線中，無法啟用公開網址')
                                    : t('admin.ngrok.toggleOn', '啟動公開隧道')
                        }
                        size="sm"
                    />
                </div>
            </div>
        </div>
    )
}
