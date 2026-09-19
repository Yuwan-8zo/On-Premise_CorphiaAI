/**
 * Mock Documents API — Demo 版（模擬多段式上傳進度）
 */

import { DEMO_DOCUMENTS } from '../demo/mockData'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

type MockDoc = (typeof DEMO_DOCUMENTS)[number]
let documents: MockDoc[] = [...DEMO_DOCUMENTS]

export type DocumentResponse = MockDoc

export const documentsApi = {
    list: async () => {
        await sleep(200)
        return { data: documents, total: documents.length }
    },

    upload: async (
        file: File,
        folderName: string,
        onProgress?: (e: { loaded: number }) => void
    ) => {
        // 模擬 5 個上傳階段（接收 → 解析 → Chunking → 向量化 → 完成）
        const stages = [
            { pct: 15, label: '上傳中', ms: 400 },
            { pct: 35, label: '解析文件', ms: 500 },
            { pct: 60, label: 'Chunking', ms: 600 },
            { pct: 85, label: '向量化', ms: 700 },
            { pct: 99, label: '儲存索引', ms: 400 },
        ]
        for (const stage of stages) {
            await sleep(stage.ms)
            onProgress?.({ loaded: Math.floor((file.size * stage.pct) / 100) })
        }
        await sleep(300)

        const newDoc: MockDoc = {
            id: `demo-doc-${Date.now()}`,
            filename: file.name,
            original_filename: file.name,
            file_type: file.name.split('.').pop() || 'pdf',
            file_size: file.size,
            size_bytes: file.size,
            status: 'completed',
            chunk_count: Math.max(Math.floor(file.size / 5000), 1),
            created_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            doc_metadata: { folderName, isActive: true },
        }
        documents = [newDoc, ...documents]
        onProgress?.({ loaded: file.size })
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
