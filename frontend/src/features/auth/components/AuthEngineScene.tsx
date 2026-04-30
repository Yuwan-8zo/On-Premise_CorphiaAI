import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

interface AuthEngineSceneProps {
    className?: string
    /**
     * 設為 true 表示此場景作為背景裝飾使用，會隱藏右下角文字
     * 並對 SVG 加上漸層遮罩，避免與前景 feature 文字打架
     */
    decorative?: boolean
}

const nodes = [
    { id: 'docs', x: 145, y: 155, label: 'DOCS' },
    { id: 'rag', x: 325, y: 95, label: 'RAG' },
    { id: 'llm', x: 505, y: 155, label: 'LLM' },
    { id: 'audit', x: 475, y: 330, label: 'AUDIT' },
    { id: 'vector', x: 245, y: 365, label: 'VECTOR' },
    { id: 'core', x: 325, y: 245, label: 'CORE' },
]

export default function AuthEngineScene({ className = '', decorative = false }: AuthEngineSceneProps) {
    const sceneRef = useRef<HTMLDivElement | null>(null)

    useGSAP(
        () => {
            const scope = sceneRef.current
            if (!scope) return

            const paths = gsap.utils.toArray<SVGPathElement>('.engine-flow', scope)
            paths.forEach((path) => {
                const length = path.getTotalLength()
                gsap.set(path, {
                    strokeDasharray: length,
                    strokeDashoffset: length,
                    opacity: 0.24,
                })
            })

            gsap.timeline({ defaults: { ease: 'power2.out' } })
                .from('.engine-shell', { opacity: 0, scale: 0.94, duration: 0.6 })
                .from('.engine-node', { opacity: 0, scale: 0.78, stagger: 0.06, duration: 0.42 }, '-=0.24')
                .to(paths, { strokeDashoffset: 0, stagger: 0.07, duration: 0.9 }, '-=0.25')
                .from('.engine-copy', { opacity: 0, y: 12, stagger: 0.07, duration: 0.45 }, '-=0.3')

            gsap.to('.engine-ring', {
                rotate: 360,
                transformOrigin: '50% 50%',
                duration: 26,
                repeat: -1,
                ease: 'none',
            })

            gsap.to('.engine-pulse', {
                scale: 1.18,
                opacity: 0.22,
                transformOrigin: '50% 50%',
                repeat: -1,
                yoyo: true,
                duration: 1.8,
                stagger: 0.18,
                ease: 'sine.inOut',
            })

            gsap.to('.engine-packet', {
                x: '+=22',
                y: '-=10',
                opacity: 0.35,
                duration: 2.6,
                repeat: -1,
                yoyo: true,
                stagger: 0.35,
                ease: 'sine.inOut',
            })

            const onPointerMove = (event: PointerEvent) => {
                const rect = scope.getBoundingClientRect()
                const relX = (event.clientX - rect.left) / rect.width - 0.5
                const relY = (event.clientY - rect.top) / rect.height - 0.5
                gsap.to('.engine-parallax', {
                    x: relX * 18,
                    y: relY * 14,
                    duration: 0.45,
                    ease: 'power2.out',
                })
                gsap.to('.engine-ring', {
                    x: relX * -10,
                    y: relY * -8,
                    duration: 0.6,
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
            className={`relative min-h-[420px] w-full overflow-hidden ${className}`}
            style={
                decorative
                    ? {
                          // 由中央往邊緣淡出，讓前景 feature 文字維持高對比可讀性
                          // 較小的可見半徑 + 較早的淡出，避免細節打架
                          WebkitMaskImage:
                              'radial-gradient(ellipse 45% 45% at 50% 50%, black 0%, transparent 70%)',
                          maskImage:
                              'radial-gradient(ellipse 45% 45% at 50% 50%, black 0%, transparent 70%)',
                          pointerEvents: 'none',
                      }
                    : undefined
            }
        >
            <div className="absolute inset-0 engine-shell">
                <svg
                    className="h-full w-full text-accent"
                    viewBox="0 0 650 470"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="Corphia AI knowledge engine animation"
                >
                    <defs>
                        <radialGradient id="engineGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
                            <stop offset="65%" stopColor="currentColor" stopOpacity="0.08" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    <circle cx="325" cy="245" r="206" fill="url(#engineGlow)" />
                    <g className="engine-ring opacity-80">
                        <circle cx="325" cy="245" r="152" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                        <circle cx="325" cy="245" r="98" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="8 12" />
                    </g>

                    <g className="engine-parallax">
                        <path className="engine-flow" d="M145 155 C215 110 262 88 325 95" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M325 95 C390 86 448 110 505 155" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M505 155 C522 238 510 286 475 330" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M475 330 C392 365 324 380 245 365" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M245 365 C171 318 128 246 145 155" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M145 155 C221 192 263 214 325 245" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M505 155 C427 198 376 222 325 245" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M245 365 C281 313 303 279 325 245" stroke="currentColor" strokeWidth="2" />
                        <path className="engine-flow" d="M475 330 C417 290 372 266 325 245" stroke="currentColor" strokeWidth="2" />

                        <circle className="engine-packet" cx="200" cy="134" r="3" fill="currentColor" opacity="0" />
                        <circle className="engine-packet" cx="446" cy="132" r="3" fill="currentColor" opacity="0" />
                        <circle className="engine-packet" cx="401" cy="334" r="3" fill="currentColor" opacity="0" />

                        {nodes.map((node) => (
                            <g key={node.id} className="engine-node">
                                <circle className="engine-pulse" cx={node.x} cy={node.y} r={node.id === 'core' ? 48 : 34} fill="currentColor" opacity="0.08" />
                                <circle cx={node.x} cy={node.y} r={node.id === 'core' ? 36 : 25} fill="rgb(var(--bg-base) / 0.82)" stroke="currentColor" strokeOpacity="0.34" strokeWidth="1.5" />
                                {/* 背景裝飾模式不渲染標籤文字，避免畫面雜亂 */}
                                {!decorative && (
                                    <text
                                        x={node.x}
                                        y={node.y + 4}
                                        textAnchor="middle"
                                        className="fill-current text-[11px] font-bold tracking-[0.22em]"
                                    >
                                        {node.label}
                                    </text>
                                )}
                            </g>
                        ))}
                    </g>
                </svg>
            </div>

            {!decorative && (
                <div className="absolute bottom-8 left-8 right-8 engine-copy">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Enterprise Knowledge Engine</p>
                    <p className="mt-3 max-w-[420px] text-sm leading-6 text-text-secondary">
                        將文件、向量檢索、模型推理與稽核流程連成一個可觀察的企業知識引擎。
                    </p>
                </div>
            )}
        </div>
    )
}
