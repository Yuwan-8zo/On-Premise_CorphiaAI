import { describe, expect, it } from 'vitest'
import { displayModelName, shortModelName } from '../modelName'

describe('displayModelName', () => {
    it('去掉路徑、副檔名和量化格式', () => {
        expect(displayModelName(String.raw`D:\models\Qwen2.5-3B-Instruct-Q5_K_M.gguf`)).toBe('Qwen2.5 3B Instruct')
        expect(displayModelName('/srv/ai/gpt-oss-20b-F16.gguf')).toBe('gpt oss 20b')
        expect(displayModelName('Llama-3.1-8B-Instruct.Q4_0')).toBe('Llama 3.1 8B Instruct')
        expect(displayModelName('phi-4-IQ3_XS')).toBe('phi 4')
        expect(displayModelName('gpt-oss-20b-MXFP4.gguf')).toBe('gpt oss 20b')
    })
    it('沒有量化格式的名稱只換空格', () => {
        expect(displayModelName('Qwen2.5-7B-Instruct')).toBe('Qwen2.5 7B Instruct')
    })
    it('短名稱照舊', () => {
        expect(shortModelName('Qwen2.5-3B-Instruct-Q5_K_M')).toBe('Qwen2.5·3B')
    })
})
