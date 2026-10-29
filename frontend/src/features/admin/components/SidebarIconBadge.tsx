import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SidebarIconBadgeVariant = 'accent' | 'warning'

const VARIANT_CLASS: Record<SidebarIconBadgeVariant, string> = {
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-amber-500/15 text-amber-500 dark:text-amber-400',
}

interface SidebarIconBadgeProps {
    variant?: SidebarIconBadgeVariant
    children: ReactNode
}

export default function SidebarIconBadge({ variant = 'accent', children }: SidebarIconBadgeProps) {
    return (
        <span
            className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-cv-sm',
                VARIANT_CLASS[variant],
            )}
        >
            {children}
        </span>
    )
}
