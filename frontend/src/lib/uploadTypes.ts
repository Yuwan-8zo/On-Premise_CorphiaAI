/** 可上傳到知識庫的檔案格式（與後端文件解析支援的格式一致） */
export const UPLOAD_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.csv,.txt,.md,.html,.htm'
/** 附加給這一則訊息的檔案：文件之外，網頁與程式原始碼也可以（原封不動交給 AI，見後端 browser_folder.CODE_EXTS） */
export const ATTACH_ACCEPT = `${UPLOAD_ACCEPT},.css,.js,.mjs,.ts,.tsx,.jsx,.json,.py,.xml,.svg`
