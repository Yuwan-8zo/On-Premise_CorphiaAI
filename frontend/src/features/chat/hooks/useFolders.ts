/**
 * 專案資料夾：已建立的資料夾清單、目前選取的資料夾與它的文件、側欄展開狀態
 */
import { useCallback, useEffect, useState } from 'react'
import { documentsApi, type DocumentResponse } from '@/api/documents'
import { foldersApi } from '@/api/folders'
import { listFolderDocs } from './chatHelpers'

export function useFolders() {
    const [savedFolders, setSavedFolders] = useState<string[]>([])
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [folderDocuments, setFolderDocuments] = useState<DocumentResponse[]>([])

    const loadFolders = useCallback(async () => {
        try {
            const data = await foldersApi.list()
            setSavedFolders(data.map((f) => f.name))
        } catch (error) {
            console.error('Failed to load folders:', error)
        }
    }, [])

    useEffect(() => {
        loadFolders()
    }, [loadFolders])

    const loadFolderDocuments = useCallback(async (folderName: string) => {
        try {
            setFolderDocuments(await listFolderDocs(folderName))
        } catch (error) {
            console.error('Failed to load documents:', error)
        }
    }, [])

    useEffect(() => {
        if (selectedFolder) loadFolderDocuments(selectedFolder)
    }, [selectedFolder, loadFolderDocuments])

    // 有文件還在「處理中」時每 3 秒重新讀一次，處理完自動變成「可讀取」，不必手動重新整理
    const hasProcessingDocs = folderDocuments.some((d) => d.status !== 'completed' && d.status !== 'failed')
    useEffect(() => {
        if (!selectedFolder || !hasProcessingDocs) return
        const id = setInterval(() => loadFolderDocuments(selectedFolder), 3000)
        return () => clearInterval(id)
    }, [selectedFolder, hasProcessingDocs, loadFolderDocuments])

    /** 啟用／停用一份文件（停用後 AI 不會參考它） */
    const handleToggleDocActive = async (doc: DocumentResponse) => {
        const isActive = doc.doc_metadata?.isActive ?? true
        try {
            await documentsApi.updateMetadata(doc.id, { ...doc.doc_metadata, isActive: !isActive })
            if (selectedFolder) loadFolderDocuments(selectedFolder)
        } catch (e) {
            console.error('Failed to toggle doc metadata:', e)
        }
    }

    /** 一次只展開一個資料夾：已展開就收合；展開時其他的自動收起 */
    const toggleFolderExpand = (folder: string) => {
        setExpandedFolders((prev) => (prev.has(folder) ? new Set() : new Set([folder])))
    }

    return {
        savedFolders, loadFolders,
        selectedFolder, setSelectedFolder,
        expandedFolders, setExpandedFolders, toggleFolderExpand,
        folderDocuments, setFolderDocuments, loadFolderDocuments,
        handleToggleDocActive,
    }
}
