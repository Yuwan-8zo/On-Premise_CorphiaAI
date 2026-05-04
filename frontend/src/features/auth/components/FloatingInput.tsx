import { InputHTMLAttributes, useState } from 'react'
import { motion, AnimatePresence } from '@/lib/gsapMotion'

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string
    delayClass?: string
    error?: string
}

export default function FloatingInput({
    label,
    delayClass,
    id,
    value,
    className,
    type = 'text',
    error,
    onFocus,
    onBlur,
    ...props
}: FloatingInputProps) {
    const isFilled = Boolean(value && value.toString().length > 0)
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const isPasswordType = type === 'password'
    const isFloating = isFilled || isFocused
    const inputType = isPasswordType ? (isPasswordVisible ? 'text' : 'password') : type

    return (
        <div className={`relative w-full shrink-0 ${delayClass || ''}`}>
            <input
                id={id}
                type={inputType}
                value={value}
                onFocus={(event) => {
                    setIsFocused(true)
                    onFocus?.(event)
                }}
                onBlur={(event) => {
                    setIsFocused(false)
                    onBlur?.(event)
                }}
                className={`w-full px-5 py-3.5 rounded-full bg-bg-surface border text-text-primary text-[15px] outline-none transition-all placeholder:text-transparent ${isPasswordType && isFilled ? 'pr-12' : ''} ${
                    error ? 'border-red-500 focus:border-red-500' : 'border-border-subtle focus:border-corphia-bronze focus:shadow-md focus:ring-0'
                } ${className || ''}`}
                placeholder={label}
                {...props}
            />

            {/*
              Floating label (notched-pill design):
                - Unfocused/empty: label sits at input vertical center, looks like a placeholder
                - Focused or filled: label floats to the input's top border line, with a
                  pill-shaped background that "notches out" the border behind it
              The pill bg uses the same color as the input itself (bg-bg-surface), so the
              notch reads as "the label sits inside the input" — works regardless of what's
              behind the form (translucent / blurred / colored). This keeps the input's
              rounded-full shape intact and the floating label clearly visible even when
              its parent has overflow-hidden.
            */}
            {/*
              Floating label with pill background:

              Why a separate <span> for the pill bg instead of animating
              backgroundColor directly?

              GSAP/framer interpolates `rgba(0,0,0,0) → rgb(40,40,42)` by walking
              through (10,10,10.5,0.25) → (20,20,21,0.5) ... so at t=0.5 the bg
              is "half-transparent dark", which against the form's already-dark
              translucent bg is essentially invisible. Result: the pill only
              becomes perceivable around t=0.75, AFTER the label has visually
              arrived at the top — looks like "label moves first, pill catches up".

              Splitting the pill into a child element and animating only its
              opacity (0 → 1) via CSS keeps RGB constant and only ramps alpha,
              so it's visible mid-animation. Same duration + ease as the motion
              transform => label move and pill fade-in stay in lock-step.
            */}
            {/*
              Animation timings are intentionally split:
                - position (top) + scale → 250ms (handled by GSAP via motion.label)
                - pill bg opacity         → 250ms via CSS (in lock-step with position)
                - text color              → 160ms via CSS (faster, kicks in earlier so the
                                            color shift feels "snappy" while the label still
                                            has room to ride out the position arc)
              Color is moved out of motion's animate object and onto inline `style.color`,
              which the splitStyle util in gsapMotion treats as DOM style (not motion var),
              so a normal CSS transition applies.
            */}
            <motion.label
                htmlFor={id}
                animate={
                    isFloating
                        ? { top: 0, scale: 0.82 }
                        : { top: '50%', scale: 1 }
                }
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="absolute left-4 pointer-events-none px-2.5 py-0.5 origin-left whitespace-nowrap text-[15px] font-medium tracking-tight"
                style={{
                    y: '-50%',
                    color: isFloating
                        ? (error ? '#ef4444' : 'rgb(var(--accent))')
                        : (error ? '#ef4444' : 'rgb(var(--text-secondary))'),
                    transition: 'color 160ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-bg-surface"
                    style={{
                        opacity: isFloating ? 1 : 0,
                        transition: 'opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
                <span className="relative">{label}</span>
            </motion.label>

            {error && (
                <div className={`absolute top-[2px] bottom-[2px] flex items-center pointer-events-none z-10 ${isPasswordType && isFilled ? 'right-10' : 'right-[2px]'}`}>
                    <div className="w-8 h-full bg-gradient-to-r from-transparent to-bg-surface" />
                    <div className="bg-bg-surface h-full flex items-center pr-4 pl-1 rounded-r-full">
                        <span className="text-xs font-semibold text-red-500 whitespace-nowrap">{error}</span>
                    </div>
                </div>
            )}

            {isPasswordType && (
                <AnimatePresence>
                    {isFilled && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8, y: '-50%' }}
                            animate={{ opacity: 1, scale: 1, y: '-50%' }}
                            exit={{ opacity: 0, scale: 0.8, y: '-50%' }}
                            transition={{ duration: 0.2 }}
                            type="button"
                            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            className="absolute right-4 top-1/2 p-2 text-text-muted hover:text-text-secondary transition-colors focus:outline-none"
                            tabIndex={-1}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={isPasswordVisible ? 'visible' : 'hidden'}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 0.5, rotate: 20 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {isPasswordVisible ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </motion.button>
                    )}
                </AnimatePresence>
            )}
        </div>
    )
}
