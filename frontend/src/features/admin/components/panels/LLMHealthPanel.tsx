/**
 * LLM 健康度面板
 * 顯示模型名稱、實時 tokens/sec、24h 推論次數
 */

import { Cpu, Zap } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'

import { Panel, SectionHeader } from '@/features/admin/components/AdminPrimitives'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { systemApi } from '@/api/system'

interface LLMStats {
    model_loaded: boolean
    provider: string
    model_path: string
    throughput?: {
        last_tokens_per_sec: number
        total_generations: number
    }
}

interface DetailedHealthData {
    llm: LLMStats
}

export interface LLMHealthPanelProps {
    className?: string
    aiBoot?: { llm: string; rag: string } | null
}


export default function LLMHealthPanel({ className, aiBoot }: LLMHealthPanelProps) {
    const { t } = useTranslation()

    const { data } = usePolling(
        async () => {
            const result = await systemApi.getHealthDetailed()
            return result as DetailedHealthData
        },
        5000,
        true,
    )

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
        <Panel className={`flex flex-col min-h-[var(--sz-200)] lg:min-h-0 ${className || ''}`}>
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
            <div className="flex-1 min-h-0 flex flex-col gap-[var(--space)] px-[var(--space)] pb-[var(--space)]">
                {/* 模型名稱 — 主要資訊 */}
                <div className="flex items-center gap-[var(--sp-10)] p-[var(--sp-10)] rounded-[var(--r-21)] bg-[var(--chip)]">
                    <span className="flex h-[var(--sz-32)] w-[var(--sz-32)] shrink-0 items-center justify-center rounded-[var(--r-11)] bg-[color-mix(in_srgb,var(--sys-blue)_20%,transparent)] text-[var(--sys-blue)]">
                        <Cpu className="h-[var(--sz-16)] w-[var(--sz-16)]" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[length:var(--fs-12)] leading-[var(--lh-16)] font-medium text-text-secondary">
                            {t('admin.overview.modelLoaded', '當前模型')}
                        </p>
                        <p className="text-[length:var(--fs-15)] leading-[var(--lh-20)] font-semibold text-text-primary truncate">
                            {modelName}
                        </p>
                    </div>
                </div>

                {/* 兩個指標卡 */}
                {/* 兩個指標撐滿剩下的高度，貼齊卡片底部（下方兩角也同心），跟左邊資安事件同樣填滿 */}
                <div className="grid flex-1 min-h-0 grid-cols-2 gap-[var(--space)]">
                    <div className="flex min-h-0 flex-col justify-center gap-[var(--sp-2)] overflow-hidden px-[var(--sp-16)] py-[var(--sp-10)] rounded-[var(--r-21)] bg-[var(--chip)]">
                        <div className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-[var(--sys-orange)]" />
                            <p className="text-[length:var(--fs-12)] font-medium text-text-secondary">
                                {t('admin.overview.tokensPerSec', 'Tokens/秒')}
                            </p>
                        </div>
                        <p className="text-[length:var(--fs-28)] leading-[var(--lh-30)] font-semibold tabular-nums text-text-primary">
                            {tokensPerSec.toFixed(1)}
                        </p>
                    </div>

                    <div className="flex min-h-0 flex-col justify-center gap-[var(--sp-2)] overflow-hidden px-[var(--sp-16)] py-[var(--sp-10)] rounded-[var(--r-21)] bg-[var(--chip)]">
                        <div className="flex items-center gap-1.5">
                            <Cpu className="h-3 w-3 text-[var(--sys-purple)]" />
                            <p className="text-[length:var(--fs-12)] font-medium text-text-secondary">
                                {t('admin.overview.totalGenerations', '推論次數')}
                            </p>
                        </div>
                        <p className="text-[length:var(--fs-28)] leading-[var(--lh-30)] font-semibold tabular-nums text-text-primary">
                            {totalGenerations.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
