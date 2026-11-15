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
