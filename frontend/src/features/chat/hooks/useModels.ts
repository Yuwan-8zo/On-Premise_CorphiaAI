/**
 * 聊天頁頂端的模型選單：可用模型清單、目前選用的模型、下拉與選項選單的開關
 */
import { useCallback, useEffect, useState } from 'react'
import modelsApi, { type ModelItem } from '@/api/models'

export function useModels() {
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
    const [availableModels, setAvailableModels] = useState<ModelItem[]>([])
    const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null)
    const [isModelLoading, setIsModelLoading] = useState(false)
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

    const loadModels = useCallback(async () => {
        try {
            const res = await modelsApi.getModels()
            setAvailableModels(res.models)
            // 後端有回報目前模型就選它，否則選第一個
            const current = res.current_model ? res.models.find((m) => m.name === res.current_model) : undefined
            if (current) setSelectedModel(current)
            else if (res.models.length > 0) setSelectedModel(res.models[0])
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }, [])

    useEffect(() => {
        loadModels()
    }, [loadModels])

    return {
        modelDropdownOpen, setModelDropdownOpen,
        availableModels, setAvailableModels,
        selectedModel, setSelectedModel,
        isModelLoading, setIsModelLoading,
        headerMenuOpen, setHeaderMenuOpen,
    }
}
