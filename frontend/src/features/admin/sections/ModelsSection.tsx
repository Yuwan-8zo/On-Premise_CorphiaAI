/**
 * Admin > Models tab（重寫版本）
 * ----------------------------------
 * 展示本機 GGUF 模型，加入：
 * - SHA256 完整性檢查（hover tooltip）
 * - 推論統計（24h throughput）
 * - 30s 輪詢更新
 * - 路徑隱藏於 tooltip
 */

import { HardDrive, RefreshCw, Copy } from '@/components/snow/icons'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { ModelItem } from '@/api/models'
import {
    Panel,
    SectionHeader,
    ActionButton,
} from '@/features/admin/components/AdminPrimitives'
import Tooltip from '@/components/ui/Tooltip'
import { adminApi, type ModelIntegrityInfo } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelCards } from '@/components/ui/Skeleton'

export interface ModelsSectionProps {
    models: ModelItem[]
    modelsDir: string
    isLoadingModels: boolean
    sanitizePath: (path: string) => string
    onRefreshModels: () => void
    onSelectModel: (name: string) => void
}

/**
 * 複製到剪貼簿的小工具函式
 */
function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
        /* 無聲失敗 */
    })
}

export default function ModelsSection({
    models,
    modelsDir,
    isLoadingModels,
    sanitizePath,
    onRefreshModels,
    onSelectModel,
}: ModelsSectionProps) {
    const { t } = useTranslation()
    const [integrityData, setIntegrityData] = useState<{ models: ModelIntegrityInfo[]; throughput: Record<string, any> } | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

    // 每 30s 輪詢一次模型完整性資訊
    const { data: integrity } = usePolling(adminApi.getModelsIntegrity, 30000)

    useEffect(() => {
        if (integrity) {
            setIntegrityData(integrity)
        }
    }, [integrity])

    // 5s 後隱藏「已複製」提示
    useEffect(() => {
        if (copied) {
            const timer = setTimeout(() => setCopied(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [copied])

    // 根據 name 查詢完整性資訊
    function getIntegrityInfo(modelName: string): ModelIntegrityInfo | undefined {
        return integrityData?.models.find((m) => m.name === modelName)
    }

    return (
        <div className="space-y-5">
            <Panel>
                <SectionHeader
                    title={t('admin.models.title', '模型')}
                    eyebrow={`${t('admin.models.folder', '模型資料夾')}：${sanitizePath(modelsDir)?.split('\\').pop() || 'ai_model'}`}
                    action={
                        <ActionButton onClick={onRefreshModels} disabled={isLoadingModels}>
                            <RefreshCw className="h-4 w-4" />
                            {t('admin.models.rescan', '重新掃描')}
                        </ActionButton>
                    }
                />
                <div className="grid gap-[12px] px-[12px] pb-[12px]">
                    {isLoadingModels ? (
                        <SkelCards count={3} className="h-[86px]" />
                    ) : models.length === 0 ? (
                        <div className="py-10 text-center text-text-secondary">
                            {t('admin.models.noModels', '暫無模型')}
                        </div>
                    ) : (
                        models.map((model) => {
                            const integrity = getIntegrityInfo(model.name)
                            const sha256Short = integrity?.sha256 ? integrity.sha256.slice(0, 12) : '--'
                            const isCopied = copied === model.name

                            return (
                                <div
                                    key={model.name}
                                    className={`flex flex-col gap-4 rounded-[21px] border p-5 md:flex-row md:items-center md:justify-between ${
                                        model.is_current
                                            ? 'border-accent/40 bg-accent/5 dark:bg-accent/10'
                                            : 'border-[var(--paper-line)] bg-[var(--chip)]'
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <p className="truncate text-lg font-semibold text-text-primary">
                                                {model.name}
                                            </p>
                                            {model.is_current && (
                                                <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
                                                    {t('admin.models.current', '當前')}
                                                </span>
                                            )}
                                            {model.quantization && (
                                                <span className="rounded-full snow-well px-3 py-1 text-xs tabular-nums text-text-secondary">
                                                    {model.quantization}
                                                </span>
                                            )}
                                        </div>

                                        {/* 主要資訊列 */}
                                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
                                            <span className="inline-flex items-center gap-2">
                                                <HardDrive className="h-4 w-4" />
                                                {model.size_gb} GB
                                            </span>
                                        </div>

                                        {/* Hash 和效能統計 */}
                                        <div className="mt-3 flex flex-wrap gap-4 text-xs">
                                            {/* SHA256 */}
                                            <div className="flex items-center gap-2 tabular-nums">
                                                <span className="text-text-muted">Hash:</span>
                                                <Tooltip label={integrity?.sha256 || '計算中'}>
                                                    <span className="text-text-secondary">
                                                        {sha256Short}
                                                    </span>
                                                </Tooltip>
                                                {integrity?.sha256 && (
                                                    <Tooltip label={isCopied ? '已複製' : '複製 Hash'}>
                                                        <button
                                                            onClick={() => {
                                                                // narrow null：上面 `integrity?.sha256 &&` 已保證不為 null，
                                                                // 但 TS 不會跨 callback 推斷，所以這裡用 non-null assertion
                                                                copyToClipboard(integrity.sha256!)
                                                                setCopied(model.name)
                                                            }}
                                                            className="text-text-muted "
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>

                                            {/* 推論統計（僅當前模型） */}
                                            {model.is_current && integrityData?.throughput && (
                                                <div className="text-text-muted">
                                                    {`推論：${(integrityData.throughput.last_tokens_per_sec || 0).toFixed(1)} tokens/s`}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {!model.is_current && (
                                        <ActionButton variant="secondary" onClick={() => onSelectModel(model.name)}>
                                            {t('admin.models.select', '選擇')}
                                        </ActionButton>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </Panel>
        </div>
    )
}
