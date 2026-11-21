/**
 * Admin > Models tab（重寫版本）
 * ----------------------------------
 * 展示本機 GGUF 模型，加入：
 * - SHA256 完整性檢查（hover tooltip）
 * - 推論統計（24h throughput）
 * - 30s 輪詢更新
 * - 路徑隱藏於 tooltip
 */

import { RefreshCw, Copy } from '@/components/snow/icons'
import { displayModelName } from '@/lib/modelName'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { ModelItem } from '@/api/models'
import {
    Panel,
    SectionHeader,
    ActionButton,
} from '@/features/admin/components/AdminPrimitives'
import Tooltip from '@/components/ui/Tooltip'
import { adminApi, type ModelIntegrityInfo, type ModelThroughput } from '@/api/admin'
import { usePolling } from '@/features/admin/hooks/usePolling'
import { SkelText } from '@/components/ui/Skeleton'
import { copyText } from '@/lib/clipboard'

export interface ModelsSectionProps {
    models: ModelItem[]
    modelsDir: string
    isLoadingModels: boolean
    sanitizePath: (path: string) => string
    onRefreshModels: () => void
    onSelectModel: (name: string) => void
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
    const [integrityData, setIntegrityData] = useState<{ models: ModelIntegrityInfo[]; throughput: ModelThroughput } | null>(null)
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
        <div className="h-full">
            <Panel className="admin-fill is-hug">
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
                {/* 一個分組清單（像 iOS 設定）：每列＝好讀的名稱＋大小・量化格式・檔案指紋，右邊「選擇」
                    以前每個模型一張一樣大的卡片，還有一行沒算好的「Hash: --」，看起來像套版 */}
                <div className="admin-fill-body px-[var(--space)] pb-[var(--space)]">
                    <div className="model-list">
                    {isLoadingModels ? (
                        [0, 1, 2].map((i) => (
                            <div key={i} aria-hidden className="model-list-row">
                                <div className="min-w-0 flex-1">
                                    <p className="model-list-name"><SkelText>Qwen2.5 7B Instruct</SkelText></p>
                                    <p className="model-list-meta"><SkelText>0.00 GB · Q5_K_M</SkelText></p>
                                </div>
                                <span className="btn btn-secondary !h-[var(--sz-36)] !px-[var(--sp-16)] !text-[length:var(--fs-14)] shrink-0"><SkelText>{t('admin.models.select', '選擇')}</SkelText></span>
                            </div>
                        ))
                    ) : models.length === 0 ? (
                        <div className="py-10 text-center text-text-secondary">
                            {t('admin.models.noModels', '暫無模型')}
                        </div>
                    ) : (
                        models.map((model) => {
                            const integrity = getIntegrityInfo(model.name)
                            const isCopied = copied === model.name

                            return (
                                <div key={model.name} className={`model-list-row ${model.is_current ? 'is-current' : ''}`}>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-[var(--sp-8)]">
                                            <p className="model-list-name" title={model.name}>{displayModelName(model.name)}</p>
                                            {model.is_current && (
                                                <span className="tag tag-accent">{t('admin.models.current', '當前')}</span>
                                            )}
                                        </div>
                                        <p className="model-list-meta">
                                            <span className="tabular-nums">{model.size_gb} GB</span>
                                            {model.quantization && <span className="tabular-nums">{model.quantization}</span>}
                                            {/* 檔案指紋（SHA-256）：模型完整性檢查用，算好才顯示 */}
                                            {integrity?.sha256 && (
                                                <span className="inline-flex items-center gap-[var(--sp-4)] tabular-nums">
                                                    <Tooltip label={integrity.sha256}>
                                                        <span>{t('ui.models.fingerprint', { hash: integrity.sha256.slice(0, 12) })}</span>
                                                    </Tooltip>
                                                    <Tooltip label={isCopied ? t('ui.message.copied') : t('ui.models.copyHash')}>
                                                        <button
                                                            onClick={() => { void copyText(integrity.sha256!).then((ok) => { if (ok) setCopied(model.name) }) }}
                                                            aria-label={t('ui.models.copyHash')}
                                                            className="icon-tap text-text-muted"
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                    </Tooltip>
                                                </span>
                                            )}
                                            {/* 還沒量到速度（0）就不顯示，不放一個「每秒 0.0」 */}
                                            {model.is_current && (integrityData?.throughput?.last_tokens_per_sec ?? 0) > 0 && (
                                                <span>{t('ui.models.inference', { value: (integrityData?.throughput?.last_tokens_per_sec ?? 0).toFixed(1) })}</span>
                                            )}
                                        </p>
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
                </div>
            </Panel>
        </div>
    )
}
