/**
 * 建立瀏覽器的 AudioContext（舊版 Safari 叫 webkitAudioContext）
 * 錄音時的音量顯示、語音轉 WAV 都用這個
 */
import i18n from '@/i18n'

type AudioContextCtor = typeof AudioContext

export function createAudioContext(): AudioContext {
    const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) throw new Error(i18n.t('ui.misc.noWebAudio'))
    return new Ctor()
}
