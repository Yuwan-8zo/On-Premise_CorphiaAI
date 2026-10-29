import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'

import type { AnimatedIconProps } from './types'

export type ItshoverIconComponent = ComponentType<AnimatedIconProps>

export interface ItshoverIconProps extends AnimatedIconProps {
    icon: ItshoverIconComponent
    /** 按鈕內等可 hover 觸發動畫；預設 false（狀態顯示，不搶游標） */
    interactive?: boolean
}

/**
 * Its Hover 圖示統一包裝：覆寫上游預設的 cursor-pointer，避免在側欄/KPI 誤顯示手型。
 */
export function ItshoverIcon({
    icon: Icon,
    interactive = false,
    className,
    size = 24,
    ...rest
}: ItshoverIconProps) {
    return (
        <Icon
            size={size}
            className={cn(
                'shrink-0',
                interactive ? 'cursor-pointer' : 'pointer-events-none !cursor-default',
                className,
            )}
            {...rest}
        />
    )
}
