/**
 * 模型管理 API
 */

import apiClient from './client'

// Types
export interface ModelItem {
    name: string
    filename: string
    size_gb: number
    quantization: string | null
    last_modified: string
    is_current: boolean
}

export interface ModelListResponse {
    models_dir: string
    current_model: string | null
    models: ModelItem[]
}

export interface ModelStatusResponse {
    loaded: boolean
    current_model: string | null
    model_path: string | null
}

/**
 * 取得模型列表
 */
export async function getModels(): Promise<ModelListResponse> {
    const response = await apiClient.get<ModelListResponse>('/models')
    return response.data
}

/**
 * 重新掃描模型目錄
 */
export async function refreshModels(): Promise<ModelListResponse> {
    const response = await apiClient.post<ModelListResponse>('/models/refresh')
    return response.data
}

/**
 * 選擇模型
 */
export async function selectModel(name: string): Promise<{ message: string; current_model: string }> {
    const response = await apiClient.post('/models/select', { name })
    return response.data
}

/**
 * 取得模型狀態
 */
export async function getModelStatus(): Promise<ModelStatusResponse> {
    const response = await apiClient.get<ModelStatusResponse>('/models/status')
    return response.data
}

export default {
    getModels,
    refreshModels,
    selectModel,
    getModelStatus,
}
