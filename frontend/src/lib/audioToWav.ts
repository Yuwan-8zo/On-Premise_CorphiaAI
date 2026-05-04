/**
 * 把 MediaRecorder 錄到的 Blob（webm/opus、mp4 等）轉成 16kHz mono 16-bit PCM WAV，
 * 後端就只要用 Python 內建 `wave` 讀取即可，不必裝 ffmpeg。
 *
 * 實作原則：
 *   1. 用瀏覽器內建 AudioContext.decodeAudioData() 解碼，支援所有原生支援的格式
 *   2. 多聲道 → 取平均做 mixdown
 *   3. 用 linear interpolation 重採樣到 16kHz（語音用足夠了，不需要 polyphase 濾波）
 *   4. 編成 16-bit signed PCM WAV
 */

const TARGET_SAMPLE_RATE = 16000

/** AudioContext 單例：每次 decode 都重建很浪費，且 Safari 會限制可同時開啟的數量 */
let _ctx: AudioContext | null = null
function getAudioContext(): AudioContext {
    if (!_ctx) {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!Ctor) throw new Error('此瀏覽器不支援 Web Audio API')
        _ctx = new Ctor()
    }
    // 上一個 if 已保證非 null，但 TS narrowing 不認 closure 賦值，這裡明確斷言
    return _ctx as AudioContext
}

/**
 * 將 audio Blob 轉換成 16kHz mono 的 WAV Blob。
 */
export async function blobToWav16kMono(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer()
    // decodeAudioData 會 mutate buffer（部分瀏覽器），所以必要時複製一份
    const ctx = getAudioContext()
    // Safari 在 ctx.state === 'suspended' 時會卡住 decode，先 resume
    if (ctx.state === 'suspended') {
        try { await ctx.resume() } catch { /* noop */ }
    }
    // decodeAudioData 在某些瀏覽器要 callback 形式才穩，這裡兩種都包
    const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        try {
            const p = ctx.decodeAudioData(
                arrayBuffer.slice(0),
                (b) => resolve(b),
                (e) => reject(e),
            )
            // 部分新版瀏覽器同時回傳 Promise；用 thenable 接也可
            if (p && typeof (p as any).then === 'function') {
                (p as any).then(resolve, reject)
            }
        } catch (e) {
            reject(e)
        }
    })

    // ── Mixdown：多聲道 → mono ───────────────────────────────────────────
    const numChannels = audioBuffer.numberOfChannels
    const length = audioBuffer.length
    let mono: Float32Array
    if (numChannels === 1) {
        mono = audioBuffer.getChannelData(0)
    } else {
        mono = new Float32Array(length)
        for (let ch = 0; ch < numChannels; ch += 1) {
            const data = audioBuffer.getChannelData(ch)
            for (let i = 0; i < length; i += 1) mono[i] += data[i]
        }
        for (let i = 0; i < length; i += 1) mono[i] /= numChannels
    }

    // ── Resample：線性內插到 16kHz ────────────────────────────────────────
    const sourceRate = audioBuffer.sampleRate
    const resampled = sourceRate === TARGET_SAMPLE_RATE
        ? mono
        : linearResample(mono, sourceRate, TARGET_SAMPLE_RATE)

    // ── 編碼成 16-bit PCM WAV ────────────────────────────────────────────
    return encodeWav(resampled, TARGET_SAMPLE_RATE)
}

function linearResample(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
    const ratio = sourceRate / targetRate
    const newLength = Math.round(input.length / ratio)
    const out = new Float32Array(newLength)
    for (let i = 0; i < newLength; i += 1) {
        const srcIndex = i * ratio
        const lo = Math.floor(srcIndex)
        const hi = Math.min(lo + 1, input.length - 1)
        const frac = srcIndex - lo
        out[i] = input[lo] * (1 - frac) + input[hi] * frac
    }
    return out
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const numFrames = samples.length
    const numChannels = 1
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = numFrames * blockAlign
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    writeAscii(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeAscii(view, 8, 'WAVE')

    // fmt sub-chunk
    writeAscii(view, 12, 'fmt ')
    view.setUint32(16, 16, true)             // sub-chunk size
    view.setUint16(20, 1, true)              // PCM = 1
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)             // bits per sample

    // data sub-chunk
    writeAscii(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    let offset = 44
    for (let i = 0; i < numFrames; i += 1) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
        offset += 2
    }

    return new Blob([buffer], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i += 1) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}
