/**
 * LLM 健康度面板
 * 顯示模型名稱、實時 tokens/sec、24h 推論次數
 */

import { Cpu, Zap } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'

import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { useHealthDetailed } from '@/features/admin/hooks/useHealthDetailed'
import { SkelText } from '@/components/ui/Skeleton'

export interface LLMHealthPanelProps {
    className?: string
    aiBoot?: { llm: string; rag: string } | null
}


export default function LLMHealthPanel({ className, aiBoot }: LLMHealthPanelProps) {
    const { t } = useTranslation()

    const data = useHealthDetailed()

    // 從 model_path 抽出檔名（去掉路徑）
    const getModelName = (path: string | undefined): string => {
        if (!path) return t('admin.overview.modelStandby', '未載入')
        const parts = path.split(/[\\/]/)
        return parts[parts.length - 1] || t('admin.overview.modelStandby', '未載入')
    }

    const llm = data?.llm
    const modelName = getModelName(llm?.model_path)
    const tokensPerSec = llm?.throughput?.last_tokens_per_sec ?? 0
    const totalGenerations = llm?.throughput?.total_generations ?? 0

    const llmReady = aiBoot?.llm === 'ready'
    const ragReady = aiBoot?.rag === 'ready'

    return (
        <Panel className={`flex flex-col min-h-[var(--sz-200)] ${className || ''}`}>
            {/* 標題列：和其他卡片同一個共用標題（17／22 半粗、左右 26）；右邊放 LLM／RAG 狀態標籤 */}
            <SectionHeader
                title={t('admin.overview.llmHealth', 'LLM 即時狀態')}
                action={aiBoot && (
                    <div className="flex gap-1.5">
                        <span className={`tag ${llmReady ? 'tag-green' : ''}`}>LLM</span>
                        <span className={`tag ${ragReady ? 'tag-accent' : ''}`}>RAG</span>
                    </div>
                )}
            />

            {/* 內部區塊離卡片左右下 12，圓角 21（＝卡片 33 − 12，同心） */}
            <div className="flex-1 flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                {/* 模型名稱 — 主要資訊 */}
                <div className="flex items-center gap-[var(--sp-10)] p-[var(--sp-10)] rounded-[var(--admin-in)] bg-[var(--chip)]">
                    <span className="flex h-[var(--sz-32)] w-[var(--sz-32)] shrink-0 items-center justify-center rounded-[var(--r-11)] bg-[color-mix(in_srgb,var(--sys-blue)_20%,transparent)] text-[var(--ink-blue)]">
                        <Cpu className="h-[var(--sz-16)] w-[var(--sz-16)]" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium text-text-secondary">
                            {t('admin.overview.modelLoaded', '當前模型')}
                        </p>
                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary truncate">
                            {data ? modelName : <SkelText>Qwen2.5-7B-Instruct</SkelText>}
                        </p>
                    </div>
                </div>

                {/* 兩個指標卡 */}
                {/* 兩個指標撐滿剩下的高度，貼齊卡片底部（下方兩角也同心），跟左邊資安事件同樣填滿 */}
                <div className="grid flex-1 grid-cols-2 gap-[var(--space)]">
                    <div className="flex flex-col justify-center gap-[var(--sp-2)] px-[var(--sp-16)] py-[var(--sp-10)] rounded-[var(--admin-in)] bg-[var(--chip)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Zap className="h-3 w-3 text-[var(--ink-orange)]" />
                            <p className="whitespace-nowrap text-[length:var(--fs-12)] font-medium text-text-secondary">
                                {t('admin.overview.tokensPerSec', 'Tokens/秒')}
                            </p>
                        </div>
                        <p className="text-[length:var(--fs-28)] leading-[var(--lh-30)] font-semibold tabular-nums whitespace-nowrap text-text-primary">
                            {data ? tokensPerSec.toFixed(1) : <SkelText>0.0</SkelText>}
                        </p>
                    </div>

                    <div className="flex flex-col justify-center gap-[var(--sp-2)] px-[var(--sp-16)] py-[var(--sp-10)] rounded-[var(--admin-in)] bg-[var(--chip)]">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Cpu className="h-3 w-3 text-[var(--ink-purple)]" />
                            <p className="whitespace-nowrap text-[length:var(--fs-12)] font-medium text-text-secondary">
                                {t('admin.overview.totalGenerations', '推論次數')}
                            </p>
                        </div>
                        <p className="text-[length:var(--fs-28)] leading-[var(--lh-30)] font-semibold tabular-nums whitespace-nowrap text-text-primary">
                            {data ? totalGenerations.toLocaleString() : <SkelText>00</SkelText>}
                        </p>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
