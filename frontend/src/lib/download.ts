import { localDate } from './dates'

/** 把瀏覽器裡的檔案資料（Blob）存成下載檔（全站共用） */
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

/** 今天的本地日期（YYYY-MM-DD），給下載檔名用 */
export const todayStamp = () => localDate()
