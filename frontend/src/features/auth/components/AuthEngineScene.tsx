import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

interface AuthEngineSceneProps {
    className?: string
    showCopy?: boolean
    decorative?: boolean
}

const sourceChips = ['Policy.pdf', 'Handbook.docx', 'Finance.xlsx']

export default function AuthEngineScene({ className = '', showCopy = true, decorative = false }: AuthEngineSceneProps) {
    const sceneRef = useRef<HTMLDivElement | null>(null)

    useGSAP(
        () => {
            const scope = sceneRef.current
            if (!scope) return

            const lines = gsap.utils.toArray<SVGPathElement>('.console-line', scope)
            lines.forEach((line) => {
                const length = line.getTotalLength()
                gsap.set(line, {
                    strokeDasharray: length,
                    strokeDashoffset: length,
                    opacity: 0.52,
                })
            })

            gsap.timeline({ defaults: { ease: 'power3.out' } })
                .from('.console-shell', { opacity: 0, y: 18, scale: 0.97, duration: 0.55 })
                .from('.console-layer', { opacity: 0, y: 18, scale: 0.97, stagger: 0.08, duration: 0.46 }, '-=0.25')
                .to(lines, { strokeDashoffset: 0, stagger: 0.1, duration: 1.05 }, '-=0.28')
                .from('.console-item', { opacity: 0, y: 12, stagger: 0.055, duration: 0.38 }, '-=0.35')
                .from('.console-copy', { opacity: 0, y: 10, duration: 0.34 }, '-=0.18')

            gsap.to('.console-line', {
                strokeDashoffset: '-=34',
                duration: 3.4,
                repeat: -1,
                ease: 'none',
            })

            gsap.to('.console-sheen', {
                xPercent: 150,
                duration: 4.6,
                repeat: -1,
                repeatDelay: 1.4,
                ease: 'power2.inOut',
            })

            gsap.to('.console-cursor', {
                opacity: 0.18,
                duration: 0.76,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
            })

            const onPointerMove = (event: PointerEvent) => {
                const rect = scope.getBoundingClientRect()
                const relX = (event.clientX - rect.left) / rect.width - 0.5
                const relY = (event.clientY - rect.top) / rect.height - 0.5

                gsap.to('.console-parallax', {
                    x: relX * 10,
                    y: relY * 8,
                    duration: 0.48,
                    ease: 'power2.out',
                })
                gsap.to('.console-float', {
                    x: relX * -8,
                    y: relY * -7,
                    duration: 0.58,
                    ease: 'power2.out',
                })
            }

            scope.addEventListener('pointermove', onPointerMove)
            return () => scope.removeEventListener('pointermove', onPointerMove)
        },
        { scope: sceneRef }
    )

    return (
        <div
            ref={sceneRef}
            aria-hidden={decorative ? true : undefined}
            className={`relative min-h-0 w-full overflow-hidden ${className}`}
            style={
                decorative
                    ? {
                          WebkitMaskImage:
                              'radial-gradient(ellipse 50% 48% at 50% 50%, black 0%, transparent 76%)',
                          maskImage:
                              'radial-gradient(ellipse 50% 48% at 50% 50%, black 0%, transparent 76%)',
                          pointerEvents: 'none',
                      }
                    : undefined
            }
        >
            <div className="console-shell absolute inset-0">
                <div className="absolute left-[8%] right-[8%] top-[8%] h-[78%] rounded-[36px] border border-white/10 bg-white/[0.035] shadow-[0_36px_120px_rgba(0,0,0,0.32)] backdrop-blur-2xl" />
                <div className="console-layer absolute left-[13%] right-[13%] top-[17%] h-[66%] rounded-[30px] border border-border-subtle/55 bg-bg-base/35 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl" />
                <div className="console-layer absolute left-[17%] right-[17%] top-[22%] h-[58%] overflow-hidden rounded-[26px] border border-white/10 bg-bg-elevated/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="console-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/[0.075] to-transparent" />
                </div>

                <svg
                    className="console-parallax absolute inset-0 h-full w-full text-corphia-bronze"
                    viewBox="0 0 640 410"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="Corphia private knowledge workspace"
                >
                    <path
                        className="console-line"
                        d="M116 282 C190 230 230 206 320 206 C420 206 474 174 540 122"
                        stroke="currentColor"
                        strokeOpacity="0.44"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                    />
                    <path
                        className="console-line"
                        d="M124 132 C198 178 252 194 320 194 C398 194 450 230 518 286"
                        stroke="currentColor"
                        strokeOpacity="0.28"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                    />
                    <path
                        d="M102 204 H538"
                        stroke="currentColor"
                        strokeOpacity="0.08"
                        strokeWidth="1"
                        strokeLinecap="round"
                    />
                </svg>

                {!decorative && (
                    <div className="console-float absolute left-[18.5%] right-[18.5%] top-[23.5%] h-[55%] rounded-[24px] border border-white/10 bg-[#151515]/45 p-4 text-text-primary shadow-[0_28px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                        <div className="console-item flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="h-2 w-2 rounded-full bg-corphia-bronze" />
                                <span className="text-[12px] font-semibold tracking-[0.02em]">Corphia Workspace</span>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-semibold text-text-secondary">
                                Local
                            </span>
                        </div>

                        <div className="console-item mt-4 rounded-[18px] border border-white/[0.08] bg-white/[0.045] p-3.5">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Ask</p>
                            <p className="mt-2 text-[14px] font-medium leading-5 text-text-primary">
                                彙整內部文件，產生可追溯的回答
                                <span className="console-cursor ml-1 inline-block h-4 w-[2px] translate-y-0.5 rounded-full bg-corphia-bronze" />
                            </p>
                        </div>

                        <div className="console-item mt-3 rounded-[20px] border border-corphia-bronze/18 bg-corphia-bronze/[0.075] p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-corphia-bronze">Answer</span>
                                <span className="text-[11px] text-text-muted">3 sources</span>
                            </div>
                            <div className="space-y-2">
                                <span className="block h-2 rounded-full bg-white/[0.28]" />
                                <span className="block h-2 w-[88%] rounded-full bg-white/[0.18]" />
                                <span className="block h-2 w-[64%] rounded-full bg-white/[0.14]" />
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {sourceChips.map((source) => (
                                    <span
                                        key={source}
                                        className="rounded-full border border-white/10 bg-black/[0.16] px-2.5 py-1 text-[10px] font-medium text-text-secondary"
                                    >
                                        {source}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {!decorative && showCopy && (
                <div className="absolute bottom-8 left-8 right-8 console-copy">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Private Knowledge Workspace</p>
                    <p className="mt-3 max-w-[420px] text-sm leading-6 text-text-secondary">
                        Calm, local, and traceable. Designed for private enterprise knowledge.
                    </p>
                </div>
            )}
        </div>
    )
}
