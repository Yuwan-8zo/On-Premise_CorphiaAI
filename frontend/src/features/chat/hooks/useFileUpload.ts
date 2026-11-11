/**
 * 上傳文件到專案資料夾（檔案選擇器與拖曳放入共用）
 *   多檔依序上傳；進度條＝整批已傳的位元組／總位元組。單檔失敗不中斷整批
 */
import { useRef, useState } from 'react'
import { documentsApi } from '@/api/documents'

export function useFileUpload({
    resolveFolder,
    onUploaded,
}: {
    /** 這次要上傳到哪個資料夾 */
    resolveFolder: () => string
    /** 每傳完一個檔案 */
    onUploaded: (file: File) => Promise<void> | void
}) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string }[]>([])

    const uploadFiles = async (files: File[]) => {
        if (files.length === 0) return
        setIsUploading(true)
        setUploadProgress(0)

        const targetFolder = resolveFolder()
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
        let doneBytes = 0

        try {
            for (const file of files) {
                try {
                    await documentsApi.upload(file, targetFolder, (e) => {
                        const overall = totalBytes ? Math.round(((doneBytes + (e.loaded ?? 0)) * 100) / totalBytes) : 0
                        setUploadProgress(Math.min(overall, 99))
                    })
                    doneBytes += file.size
                    await onUploaded(file)
                } catch (err) {
                    console.error(`上傳失敗 [${file.name}]:`, err)
                }
            }
            setUploadProgress(100)
        } finally {
            setIsUploading(false)
            setTimeout(() => setUploadProgress(0), 400)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files
        if (list && list.length > 0) await uploadFiles(Array.from(list))
    }

    return { fileInputRef, isUploading, uploadProgress, uploadedFiles, setUploadedFiles, uploadFiles, handleFileUpload }
}
