/**
 * LLM 健康度面板
 * 顯示模型名稱、實時 tokens/sec、24h 推論次數
 */

import { Cpu, Zap } from 'lucide-react'
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
}

export default function LLMHealthPanel({ className }: LLMHealthPanelProps) {
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

    return (
        <Panel className={`overflow-hidden flex flex-col min-h-[160px] lg:min-h-0 ${className || ''}`}>
            <SectionHeader
                title={t('admin.overview.llmHealth', 'LLM 即時狀態')}
                eyebrow="LLM Health"
            />
            <div className="flex-1 min-h-0 p-2.5">
                <div className="flex flex-col gap-2 h-full">
                    {/* 模型名稱行 */}
                    <div className="px-2 py-1.5 rounded-cv-sm bg-bg-secondary/50 border border-border/30">
                        <p className="text-[8px] font-medium uppercase tracking-[0.1em] text-text-muted mb-0.5">
                            {t('admin.overview.modelLoaded', '已載入')}
                        </p>
                        <p className="text-sm font-medium text-text-primary truncate">
                            {modelName}
                        </p>
                    </div>

                    {/* 兩個小卡網格 */}
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        {/* Tokens/sec */}
                        <div className="flex flex-col items-start justify-between p-2 rounded-cv-sm bg-bg-secondary/50 border border-border/30 hover:border-border/60 transition-colors">
                            <div className="flex items-center gap-1.5 w-full mb-1">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent/10 text-accent">
                                    <Zap className="h-2.5 w-2.5" />
                                </span>
                                <p className="text-[7px] font-medium uppercase tracking-[0.1em] text-text-muted truncate">
                                    {t('admin.overview.tokensPerSec', 'Tokens/秒')}
                                </p>
                            </div>
                            <p className="text-base font-semibold tabular-nums text-text-primary">
                                {tokensPerSec.toFixed(1)}
                            </p>
                        </div>

                        {/* Total Generations */}
                        <div className="flex flex-col items-start justify-between p-2 rounded-cv-sm bg-bg-secondary/50 border border-border/30 hover:border-border/60 transition-colors">
                            <div className="flex items-center gap-1.5 w-full mb-1">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent/10 text-accent">
                                    <Cpu className="h-2.5 w-2.5" />
                                </span>
                                <p className="text-[7px] font-medium uppercase tracking-[0.1em] text-text-muted truncate">
                                    {t('admin.overview.totalGenerations', '推論次數')}
                                </p>
                            </div>
                            <p className="text-base font-semibold tabular-nums text-text-primary">
                                {totalGenerations.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
