/**
 * Mock Documents API — 修正版
 * 完全符合 DocumentsPage.tsx 期望的介面
 */

import { DEMO_DOCUMENTS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Mock Document 資料型別（snake_case，與後端 API response 一致）
type MockDocRaw = {
    id: string
    filename: string
    original_filename: string
    file_type: string
    file_size: number
    size_bytes: number
    status: 'completed' | 'pending' | 'failed' | 'processing'
    chunk_count: number
    error_message?: string
    created_at: string
    processed_at: string
    doc_metadata: Record<string, unknown>
}

let documents: MockDocRaw[] = DEMO_DOCUMENTS.map((d) => ({
    ...d,
    status: 'completed' as const,
    error_message: undefined,
}))

export const documentsApi = {
    list: async () => {
        await sleep(200)
        return { data: documents, total: documents.length }
    },

    /**
     * upload(file, folderName?, onProgress?)
     * onProgress callback 格式：{ loaded: number, total: number }
     */
    upload: async (
        file: File,
        folderName?: string,
        onProgress?: (e: { loaded: number; total: number }) => void,
    ) => {
        // 5 段式進度模擬
        const stages = [
            { pct: 12, ms: 350 },
            { pct: 30, ms: 500 },
            { pct: 58, ms: 650 },
            { pct: 82, ms: 750 },
            { pct: 98, ms: 400 },
        ]

        for (const stage of stages) {
            await sleep(stage.ms)
            onProgress?.({
                loaded: Math.floor((file.size * stage.pct) / 100),
                total: file.size,
            })
        }
        await sleep(300)

        const newDoc: MockDocRaw = {
            id: `demo-doc-${Date.now()}`,
            filename: file.name,
            original_filename: file.name,
            file_type: file.name.split('.').pop() || 'pdf',
            file_size: file.size,
            size_bytes: file.size,
            status: 'completed',
            chunk_count: Math.max(Math.floor(file.size / 5000), 1),
            error_message: undefined,
            created_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            doc_metadata: { folderName: folderName ?? '預設', isActive: true },
        }
        documents = [newDoc, ...documents]

        onProgress?.({ loaded: file.size, total: file.size })
        return newDoc
    },

    delete: async (id: string) => {
        await sleep(200)
        documents = documents.filter((d) => d.id !== id)
        return { success: true }
    },

    updateMetadata: async (id: string, metadata: Record<string, unknown>) => {
        await sleep(150)
        documents = documents.map((d) =>
            d.id === id ? { ...d, doc_metadata: { ...d.doc_metadata, ...metadata } } : d
        )
        return documents.find((d) => d.id === id)
    },
}
