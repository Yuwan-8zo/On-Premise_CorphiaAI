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
    aiBoot?: { llm: string; rag: string } | null
}

const bootLabel: Record<string, string> = {
    loading: '載入中',
    ready: '就緒',
    unavailable: '未掛載',
    error: '錯誤',
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
        <Panel className={`flex flex-col min-h-[200px] lg:min-h-0 ${className || ''}`}>
            {/* 標題列：eyebrow + LLM/RAG 狀態 badge 並排 */}
            <div className="flex items-start justify-between px-5 py-3 border-b border-white/[0.06]">
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">LLM Health</p>
                    <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">
                        {t('admin.overview.llmHealth', 'LLM 即時狀態')}
                    </h2>
                </div>
                {aiBoot && (
                    <div className="flex gap-1.5 mt-0.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide border ${llmReady ? 'bg-emerald-950/70 text-emerald-400 border-emerald-500/30' : 'bg-white/[0.05] text-text-muted border-white/[0.08]'}`}>
                            <span className={`h-1 w-1 rounded-full ${llmReady ? 'bg-emerald-400' : 'bg-text-muted'}`} />
                            LLM
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide border ${ragReady ? 'bg-blue-950/70 text-blue-400 border-blue-500/30' : 'bg-white/[0.05] text-text-muted border-white/[0.08]'}`}>
                            <span className={`h-1 w-1 rounded-full ${ragReady ? 'bg-blue-400' : 'bg-text-muted'}`} />
                            RAG
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-2 p-2.5">
                {/* 模型名稱 — 主要資訊 */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-cv-sm bg-white/[0.05] border border-white/[0.07]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                        <Cpu className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-text-muted">
                            {t('admin.overview.modelLoaded', '當前模型')}
                        </p>
                        <p className="text-[13px] font-medium text-text-primary truncate leading-tight">
                            {modelName}
                        </p>
                    </div>
                </div>

                {/* 兩個指標卡 */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1 px-3 py-2.5 rounded-cv-sm bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] transition-colors">
                        <div className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-amber-400" />
                            <p className="text-[8px] font-medium uppercase tracking-[0.1em] text-text-muted">
                                {t('admin.overview.tokensPerSec', 'Tokens/秒')}
                            </p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-text-primary">
                            {tokensPerSec.toFixed(1)}
                        </p>
                    </div>

                    <div className="flex flex-col gap-1 px-3 py-2.5 rounded-cv-sm bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] transition-colors">
                        <div className="flex items-center gap-1.5">
                            <Cpu className="h-3 w-3 text-violet-400" />
                            <p className="text-[8px] font-medium uppercase tracking-[0.1em] text-text-muted">
                                {t('admin.overview.totalGenerations', '推論次數')}
                            </p>
                        </div>
                        <p className="text-xl font-semibold tabular-nums text-text-primary">
                            {totalGenerations.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </Panel>
    )
}
