/**
 * Chat 頁面專用圖示元件
 *
 * 從 Chat.tsx 拆出的自訂 SVG Icon 元件，
 * 減少主檔案行數，提高可維護性。
 */

import { ArrowUp, PanelLeft, Plus } from '@/components/snow/icons'
import React from 'react'

/** + 號 Icon */
export const PlusIcon = () => (
    <Plus className="w-5 h-5" />
)

/** 發送按鈕（藍色圓形 + 向上箭頭） */
export const SendDotBtn = ({ disabled }: { disabled?: boolean }) => (
    <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center transition-[background-color,transform] duration-200 ${disabled ? 'bg-[var(--chip)] text-text-secondary' : 'bg-accent-fill text-text-on-accent'}`}>
        <ArrowUp className="w-[18px] h-[18px]" />
    </div>
)

/** 停止生成按鈕（Apple 樣式：灰色毛玻璃圓＋實心方塊） */
export const StopIcon = () => (
    <div className="w-[38px] h-[38px] rounded-full bg-[var(--glass-ctl)] text-text-primary flex items-center justify-center transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="3" />
        </svg>
    </div>
)

/** 側邊欄收合 Icon */
export const SidebarIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <PanelLeft className="text-text-muted  transition-colors" />
)
