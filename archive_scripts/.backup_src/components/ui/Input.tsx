/**
 * Input 輸入框元件
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, error, ...props }, ref) => {
        return (
            <div className="w-full">
                <input
                    type={type}
                    className={cn(
                        'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors',
                        'border-slate-300 dark:border-slate-600',
                        'dark:bg-slate-800 dark:text-slate-100',
                        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                        'focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {error && (
                    <p className="mt-1 text-sm text-red-500">{error}</p>
                )}
            </div>
        )
    }
)
Input.displayName = 'Input'

export { Input }
