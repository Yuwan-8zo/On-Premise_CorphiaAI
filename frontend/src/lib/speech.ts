/**
 * 朗讀回答：用這台電腦自己的語音唸出來
 *
 * 只用「裝在這台電腦上」的語音（voice.localService）。瀏覽器另外提供的線上語音會把文字送到廠商的伺服器，
 * 這個系統的資料不出公司，所以一律不用；沒有本機語音就不朗讀，並告訴使用者原因。
 *
 * 一次只唸一則：開始唸另一則、或再按一次，前一則就停。誰正在唸放在這裡，訊息泡泡用 useSpeakingId() 讀。
 */
import { useSyncExternalStore } from 'react'

/** 語速（1＝正常） */
const SPEECH_RATE = 1
/** 一段最多幾個字：整篇一次交給語音引擎，有些引擎唸到一半會自己停；切成一句一句排隊唸 */
const CHUNK_MAX_CHARS = 180

let speakingId: string | null = null
const listeners = new Set<() => void>()
const setSpeakingId = (id: string | null) => {
    speakingId = id
    listeners.forEach((fn) => fn())
}

/** 正在唸哪一則訊息（沒有在唸是 null） */
export function useSpeakingId(): string | null {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
        () => speakingId,
        () => null,
    )
}

export function speechSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'localService'>

/**
 * 挑語音：只挑本機的；語言完全相同（zh-TW）優先，其次同一種語言（zh-CN、zh-HK），都沒有回 null。
 * 語音的語言代碼有的用底線（zh_TW），一律當成連字號比對。
 */
export function pickVoice<T extends VoiceLike>(voices: T[], lang: string): T | null {
    const norm = (s: string) => s.replace('_', '-').toLowerCase()
    const want = norm(lang)
    const local = voices.filter((v) => v.localService)
    return local.find((v) => norm(v.lang) === want) ?? local.find((v) => norm(v.lang).split('-')[0] === want.split('-')[0]) ?? null
}

/** Markdown → 唸得出來的純文字：程式碼區塊不唸，連結只唸文字，拿掉標記符號 */
export function plainText(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?(```|$)/g, '\n')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
        .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, '')
        .replace(/[*_~`|]+/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, '\n')
        .trim()
}

/** 切成一句一句（句號、問號、驚嘆號、換行）；太長的句子再照長度切 */
export function splitForSpeech(text: string, max = CHUNK_MAX_CHARS): string[] {
    const out: string[] = []
    for (const sentence of text.split(/(?<=[。！？!?；;\n])/)) {
        let rest = sentence.trim()
        while (rest.length > max) {
            out.push(rest.slice(0, max))
            rest = rest.slice(max)
        }
        if (rest) out.push(rest)
    }
    return out
}

/** 語音清單是瀏覽器之後才載入的：已經有就直接回，沒有就等它載好（最多等一下） */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis
    const now = synth.getVoices()
    if (now.length) return Promise.resolve(now)
    return new Promise((resolve) => {
        const done = () => {
            synth.removeEventListener('voiceschanged', done)
            clearTimeout(timer)
            resolve(synth.getVoices())
        }
        const timer = setTimeout(done, 1500)
        synth.addEventListener('voiceschanged', done)
    })
}

export function stopSpeaking(): void {
    if (speechSupported()) window.speechSynthesis.cancel()
    setSpeakingId(null)
}

/**
 * 唸一則訊息。回傳 'ok'、'no-voice'（這台電腦沒有這個語言的本機語音）或 'empty'（沒有唸得出來的字，例如整則都是程式碼）。
 */
export async function speak(id: string, markdown: string, lang: string): Promise<'ok' | 'no-voice' | 'empty'> {
    if (!speechSupported()) return 'no-voice'
    stopSpeaking()
    const chunks = splitForSpeech(plainText(markdown))
    if (!chunks.length) return 'empty'
    const voice = pickVoice(await loadVoices(), lang)
    if (!voice) return 'no-voice'

    setSpeakingId(id)
    chunks.forEach((chunk, i) => {
        const u = new SpeechSynthesisUtterance(chunk)
        u.voice = voice
        u.lang = voice.lang
        u.rate = SPEECH_RATE
        // 唸完最後一段、或中途出錯：回到沒有在唸（被別則蓋掉時 speakingId 已經不是自己，不動它）
        const finish = () => {
            if (speakingId === id) setSpeakingId(null)
        }
        if (i === chunks.length - 1) u.onend = finish
        u.onerror = finish
        window.speechSynthesis.speak(u)
    })
    return 'ok'
}
