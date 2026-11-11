import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SidebarIconBadgeVariant = 'accent' | 'warning'

const VARIANT_CLASS: Record<SidebarIconBadgeVariant, string> = {
    accent: 'bg-accent/10 text-accent',
    warning: 'bg-[color-mix(in_srgb,var(--sys-orange)_15%,transparent)] text-[var(--ink-orange)] dark:text-[var(--ink-orange)]',
}

interface SidebarIconBadgeProps {
    variant?: SidebarIconBadgeVariant
    children: ReactNode
}

export default function SidebarIconBadge({ variant = 'accent', children }: SidebarIconBadgeProps) {
    return (
        <span
            className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--r-10)]',
                VARIANT_CLASS[variant],
            )}
        >
            {children}
        </span>
    )
}
