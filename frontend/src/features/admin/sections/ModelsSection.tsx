/**
 * Admin > Models tab（重寫版本）
 * ----------------------------------
 * 展示本機 GGUF 模型，加入：
 * - SHA256 完整性檢查（hover tooltip）
 * - 推論統計（24h throughput）
 * - 30s 輪詢更新
 * - 路徑隱藏於 tooltip
 */

import { HardDrive, RefreshCw, Copy } from 'lucide-react'
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
                    eyebrow={t('admin.models.modelDirectory', '模型目錄')}
                    action={
                        <ActionButton onClick={onRefreshModels} disabled={isLoadingModels}>
                            <RefreshCw className="h-4 w-4" />
                            {t('admin.models.rescan', '重新掃描')}
                        </ActionButton>
                    }
                />
                {/* 路徑在 hover tooltip 顯示 */}
                <Tooltip label={sanitizePath(modelsDir) || 'ai_model'}>
                    <div className="border-b border-border-subtle px-5 py-2 font-mono text-[11px] text-text-muted truncate">
                        {sanitizePath(modelsDir)?.split('\\').pop() || 'ai_model'}
                    </div>
                </Tooltip>
                <div className="grid gap-4 p-5">
                    {isLoadingModels ? (
                        <div className="py-10 text-center text-text-secondary">
                            {t('common.loading', '載入中')}
                        </div>
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
                                    className={`flex flex-col gap-4 rounded-[22px] border p-5 md:flex-row md:items-center md:justify-between ${
                                        model.is_current
                                            ? 'border-accent/40 bg-accent/5 dark:bg-accent/10'
                                            : 'border-border-strong bg-bg-elevated/72'
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
                                                <span className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs font-mono text-text-secondary">
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
                                            <div className="flex items-center gap-2 font-mono">
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
                                                            className="text-text-muted hover:text-text-primary"
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
