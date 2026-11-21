/**
 * 模型檔名的共用解析（全站共用）
 *   例：Qwen2.5-7B-Instruct-Q5_K_M → 系列 Qwen2.5、大小 7B
 */

/** 模型大小（例如 3B、7B、14B）；檔名裡沒有就回 undefined */
export function modelSize(name: string): string | undefined {
    return name.match(/(\d+(?:\.\d+)?B)(?![A-Za-z0-9])/i)?.[1]?.toUpperCase()
}

/** 窄螢幕用的短名稱：系列·大小（例如 Qwen2.5·7B）；每個人可以選不同的模型，一定要看得出大小 */
export function shortModelName(name: string): string {
    const family = name.split(/[-_]/)[0]
    const size = modelSize(name)
    return size ? `${family}·${size}` : name.slice(0, 14)
}

/** 量化格式（Q5_K_M、Q4_0、IQ3_XS、F16、BF16、MXFP4…）只有工程師看得懂，畫面上不顯示 */
const QUANT_SUFFIX = /[-_.](?:I?Q\d+(?:_[A-Z0-9]+)*|B?F(?:16|32)|MXFP\d+)$/i

/**
 * 畫面上顯示的模型名稱：去掉路徑、.gguf 副檔名、量化格式，連字號換成空格
 *   例：D:\models\Qwen2.5-3B-Instruct-Q5_K_M.gguf → Qwen2.5 3B Instruct
 *   完整檔名放在 title 提示裡給要查的人看
 */
export function displayModelName(nameOrPath: string): string {
    const file = nameOrPath.split(/[\\/]/).pop() ?? nameOrPath
    const base = file.replace(/\.gguf$/i, '').replace(QUANT_SUFFIX, '')
    return base.replace(/[-_]+/g, ' ').trim() || file
}
