/** 匯出對話視窗開給哪一則對話（對話選單打開、ExportDialog 讀；分開放避免兩個元件互相引用） */
import { create } from 'zustand'

export const useExportDialog = create<{ id: string | null }>(() => ({ id: null }))
export const openExportDialog = (id: string) => useExportDialog.setState({ id })
export const closeExportDialog = () => useExportDialog.setState({ id: null })
