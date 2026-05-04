/**
 * MaterialIcon - 全站統一圖示元件，使用 Google Material Symbols Outlined。
 *
 * 用法：
 *   <MaterialIcon name="attach_file" />
 *   <MaterialIcon name="check_circle" className="text-green-500" />
 *   <MaterialIcon name="warning" filled size={20} />
 *
 * 為什麼用 Material Symbols 而不是 emoji：
 *   1. emoji 不同 OS 樣式不一，視覺一致性差。
 *   2. emoji 顏色不可控，無法跟隨主題色（強調色 / 警示色）。
 *   3. Material Symbols 用 font ligature，可隨意調整大小、粗細、填充、顏色。
 *
 * 圖示名稱清單：https://fonts.google.com/icons
 */

import { CSSProperties } from 'react'

interface MaterialIconProps {
    /** Icon 名稱（snake_case），來自 https://fonts.google.com/icons */
    name: string
    /** 額外 className（可控顏色等） */
    className?: string
    /** 字體大小（px），預設 20 */
    size?: number
    /** 是否填充（預設 outlined） */
    filled?: boolean
    /** 視覺粗細，100~700，預設 400 */
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
    /** 額外 inline style */
    style?: CSSProperties
    /** 標題（無障礙） */
    title?: string
    /** 點擊事件 */
    onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void
    /** aria-hidden（裝飾性圖示用） */
    'aria-hidden'?: boolean
}

export default function MaterialIcon({
    name,
    className = '',
    size = 20,
    filled = false,
    weight = 400,
    style,
    title,
    onClick,
    'aria-hidden': ariaHidden,
}: MaterialIconProps) {
    const fontVariationSettings = `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`

    return (
        <span
            className={`material-symbols-outlined select-none align-middle leading-none ${className}`}
            style={{
                fontSize: `${size}px`,
                lineHeight: 1,
                fontVariationSettings,
                ...style,
            }}
            title={title}
            onClick={onClick}
            aria-hidden={ariaHidden}
            role={onClick ? 'button' : undefined}
        >
            {name}
        </span>
    )
}
