/**
 * Chat 頁面專用圖示元件
 *
 * 從 Chat.tsx 拆出的自訂 SVG Icon 元件，
 * 減少主檔案行數，提高可維護性。
 */

import React from 'react'

/** + 號 Icon */
export const PlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
)

/** 發送按鈕（藍色圓形 + 向上箭頭） */
export const SendDotBtn = ({ disabled }: { disabled?: boolean }) => (
    <div className={`w-[32px] h-[32px] rounded-full flex items-center justify-center transition-colors shadow-sm ${disabled ? 'bg-bg-surface ' : 'bg-accent bg-accent  /90'}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${disabled ? 'opacity-30' : 'opacity-100'}`}>
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    </div>
)

/** 停止生成按鈕（紅色圓形 + 方塊） */
export const StopIcon = () => (
    <div className="w-[32px] h-[32px] rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <rect x="5" y="5" width="14" height="14" rx="2" />
        </svg>
    </div>
)

/** 側邊欄收合 Icon */
export const SidebarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted hover:text-text-secondary transition-colors" {...props}>
        <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
    </svg>
)
