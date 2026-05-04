/**
 * Admin > Models tab
 * ------------------
 * List of GGUF models discovered in the ai_model directory. Shows current
 * model with a highlight, lets user switch to another, and offers a rescan.
 */

import { HardDrive, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ModelItem } from '@/api/models'
import {
    Panel,
    SectionHeader,
    ActionButton,
} from '@/features/admin/components/AdminPrimitives'

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

    return (
        <div className="space-y-5">
            <Panel>
                {/*
                  Eyebrow used to be the raw modelsDir path, but SectionHeader
                  uppercases its eyebrow (`text-transform: uppercase`) which made
                  paths like "D:\Antigravity\..." render as
                  "D:\ANTIGRAVITY\..." — distracting and not what eyebrows are
                  meant to convey. The path is now displayed in a small
                  description row under the title (still readable, no uppercase).
                */}
                <SectionHeader
                    title={t('admin.models.title')}
                    eyebrow="Model Directory"
                    action={
                        <ActionButton onClick={onRefreshModels} disabled={isLoadingModels}>
                            <RefreshCw className="h-4 w-4" />
                            {t('admin.models.rescan')}
                        </ActionButton>
                    }
                />
                {/* The actual filesystem path: muted, monospace, not uppercased */}
                <div className="border-b border-border-subtle px-5 py-2 font-mono text-[11px] text-text-muted truncate">
                    {sanitizePath(modelsDir) || 'ai_model'}
                </div>
                <div className="grid gap-4 p-5">
                    {isLoadingModels ? (
                        <div className="py-10 text-center text-text-secondary">
                            {t('common.loading')}
                        </div>
                    ) : (
                        models.map((model) => (
                            <div
                                key={model.name}
                                className="flex flex-col gap-4 rounded-[22px] border border-border-strong bg-bg-elevated/72 p-5 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <p className="truncate text-lg font-semibold text-text-primary">
                                            {model.name}
                                        </p>
                                        {model.is_current && (
                                            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                                                {t('admin.models.current')}
                                            </span>
                                        )}
                                        {model.quantization && (
                                            <span className="rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs font-mono text-text-secondary">
                                                {model.quantization}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
                                        <span className="inline-flex items-center gap-2">
                                            <HardDrive className="h-4 w-4" />
                                            {model.size_gb} GB
                                        </span>
                                        <span className="truncate">{model.filename}</span>
                                    </div>
                                </div>
                                {!model.is_current && (
                                    <ActionButton variant="secondary" onClick={() => onSelectModel(model.name)}>
                                        {t('admin.models.select')}
                                    </ActionButton>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </Panel>
        </div>
    )
}
