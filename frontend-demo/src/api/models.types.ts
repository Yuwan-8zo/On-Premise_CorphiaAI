/** ModelItem type — 從 frontend/src/api/models.ts 摘出 */
export interface ModelItem {
    name: string
    display_name?: string
    filename?: string
    size_gb: number
    is_loaded?: boolean
    is_current?: boolean
    quantization?: string | null
    last_modified?: string
    context_length?: number
    description?: string
}

export interface ModelListResponse {
    models_dir?: string
    current_model: string | null
    models: ModelItem[]
}
