/**
 * 系統健康監控面板 (C4 差異化功能)
 *
 * 即時顯示 CPU/GPU/VRAM 使用率、LLM 模型狀態。
 * 用於 Settings 或 Header 中的彈出面板。
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { apiClient } from '../../api/client'

interface CPUInfo {
    cpu_percent: number
    cpu_cores: number
    memory_total_gb: number
    memory_used_gb: number
    memory_percent: number
    error?: string
}

interface GPUDevice {
    index: number
    name: string
    vram_total_mb: number
    vram_used_mb: number
    vram_free_mb: number
    vram_percent: number
    gpu_utilization: number
    memory_utilization: number
}

interface GPUInfo {
    available: boolean
    type: string
    devices: GPUDevice[]
}

interface LLMStats {
    model_loaded: boolean
    model_path: string
    context_size: number
    n_gpu_layers: number
    n_vocab?: number
    n_ctx_train?: number
}

interface NetworkStatus {
    is_online: boolean
    latency_ms: number | null
    data_sovereignty: boolean
    message: string
}

interface SystemHealth {
    timestamp: string
    platform: {
        system: string
        machine: string
        python_version: string
    }
    cpu: CPUInfo
    gpu: GPUInfo
    llm: LLMStats
}

/** 使用率百分比的打條 */
function UsageBar({ percent, color }: { percent: number; color: string }) {
    return (
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
            />
        </div>
    )
}

function percentColor(val: number): string {
    if (val >= 90) return 'bg-red-500'
    if (val >= 70) return 'bg-orange-500'
    if (val >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
}

export function SystemMonitorPanel() {
    const { t } = useTranslation()
    const [health, setHealth] = useState<SystemHealth | null>(null)
    const [network, setNetwork] = useState<NetworkStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            const [healthRes, networkRes] = await Promise.all([
                apiClient.get('/system/health/detailed'),
                apiClient.get('/system/network/status'),
            ])
            setHealth(healthRes.data)
            setNetwork(networkRes.data)
            setError(null)
        } catch (err) {
            setError('無法取得系統資訊')
            console.error('System monitor fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    // 初次載入 + 每 5 秒自動刷新
    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 5000)
        return () => clearInterval(interval)
    }, [fetchData])

    if (loading) {
        return (
            <div className="p-4 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-corphia-bronze/20 border-t-ios-blue-light animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-sm text-red-500 dark:text-red-400 text-center">
                {error}
            </div>
        )
    }

    return (
        <div className="space-y-4 text-sm">
            {/* 離線 / 在線狀態 (A4) */}
            {network && (
                <div className={`rounded-xl border p-3 ${
                    network.data_sovereignty
                        ? 'border-green-300/50 dark:border-green-600/30 bg-green-50/50 dark:bg-green-900/20'
                        : 'border-yellow-300/50 dark:border-yellow-600/30 bg-yellow-50/50 dark:bg-yellow-900/20'
                }`}>
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{network.data_sovereignty ? '✅' : '⚠️'}</span>
                        <span className={`font-medium text-xs ${
                            network.data_sovereignty
                                ? 'text-green-700 dark:text-green-300'
                                : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                            {network.message}
                        </span>
                    </div>
                    {network.latency_ms && (
                        <p className="text-[10px] text-gray-400 mt-1 ml-7">
                            外部延遲: {network.latency_ms}ms
                        </p>
                    )}
                </div>
            )}

            {/* CPU / 記憶體 */}
            {health?.cpu && !health.cpu.error && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-gray-600 dark:text-gray-300">🖥️ CPU</span>
                        <span className="text-xs font-mono text-gray-500">{health.cpu.cpu_cores} 核心</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>CPU 使用率</span>
                            <span className="font-mono">{health.cpu.cpu_percent}%</span>
                        </div>
                        <UsageBar percent={health.cpu.cpu_percent} color={percentColor(health.cpu.cpu_percent)} />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>記憶體</span>
                            <span className="font-mono">{health.cpu.memory_used_gb} / {health.cpu.memory_total_gb} GB</span>
                        </div>
                        <UsageBar percent={health.cpu.memory_percent} color={percentColor(health.cpu.memory_percent)} />
                    </div>
                </div>
            )}

            {/* GPU */}
            {health?.gpu?.available && health.gpu.devices.map((gpu) => (
                <div key={gpu.index} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-gray-600 dark:text-gray-300">
                            🎮 GPU #{gpu.index}
                        </span>
                        <span className="text-xs font-mono text-gray-500 truncate max-w-[160px]">{gpu.name}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>GPU 使用率</span>
                            <span className="font-mono">{gpu.gpu_utilization}%</span>
                        </div>
                        <UsageBar percent={gpu.gpu_utilization} color={percentColor(gpu.gpu_utilization)} />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>VRAM</span>
                            <span className="font-mono">{gpu.vram_used_mb} / {gpu.vram_total_mb} MB</span>
                        </div>
                        <UsageBar percent={gpu.vram_percent} color={percentColor(gpu.vram_percent)} />
                    </div>
                </div>
            ))}

            {!health?.gpu?.available && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        未偵測到 GPU — 模型以 CPU 模式運行
                    </p>
                </div>
            )}

            {/* LLM 模型狀態 */}
            {health?.llm && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-gray-600 dark:text-gray-300">🤖 LLM 模型</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            health.llm.model_loaded
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}>
                            {health.llm.model_loaded ? '已載入' : '模擬模式'}
                        </span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5 font-mono">
                        <p>Context Size: {health.llm.context_size}</p>
                        <p>GPU Layers: {health.llm.n_gpu_layers}</p>
                        {health.llm.n_vocab && <p>Vocab Size: {health.llm.n_vocab}</p>}
                    </div>
                </div>
            )}

            {/* 平台資訊 */}
            {health?.platform && (
                <div className="text-[10px] text-gray-400 dark:text-gray-500 text-center font-mono">
                    {health.platform.system} {health.platform.machine} · Python {health.platform.python_version}
                </div>
            )}
        </div>
    )
}

export default SystemMonitorPanel
