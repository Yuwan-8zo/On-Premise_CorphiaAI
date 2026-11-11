/**
 * 建立瀏覽器的 AudioContext（舊版 Safari 叫 webkitAudioContext）
 * 錄音時的音量顯示、語音轉 WAV 都用這個
 */
type AudioContextCtor = typeof AudioContext

export function createAudioContext(): AudioContext {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) throw new Error('此瀏覽器不支援 Web Audio API')
    return new Ctor()
}
