/**
 * VoiceRecorder
 *
 * 取代輸入框的「錄音模式」面板。
 *
 * 功能：
 *   1. 透過 getUserMedia + MediaRecorder 錄製音訊
 *   2. 透過 Web Audio API 的 AnalyserNode 即時取得音量，渲染動態 waveform
 *   3. 計時器 (mm:ss)
 *   4. （可選）若瀏覽器支援 webkitSpeechRecognition / SpeechRecognition，
 *      同步進行語音轉文字，作為 message.transcript 提供給 LLM
 *   5. 取消 / 送出 兩個操作
 *
 * 設計重點：
 *   - 元件啟動時就向使用者請求麥克風權限，被拒絕時呼叫 onError
 *   - unmount 時關閉 stream / context，避免瀏覽器持續顯示錄音中圖示
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/components/icons/MaterialIcon'

interface VoiceRecorderProps {
    /** 取消錄音（不送出） */
    onCancel: () => void
    /** 完成錄音並送出（轉錄交給後端 Whisper，故 payload 不含 transcript） */
    onSend: (payload: {
        blob: Blob
        url: string
        mimeType: string
        durationMs: number
    }) => void
    /** 錯誤通知（例：使用者拒絕授權） */
    onError?: (msg: string) => void
}

const BAR_COUNT = 32

function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function VoiceRecorder({ onCancel, onSend, onError }: VoiceRecorderProps) {
    const { t } = useTranslation()

    const [elapsedMs, setElapsedMs] = useState(0)
    const [isReady, setIsReady] = useState(false)
    const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.05))

    const streamRef = useRef<MediaStream | null>(null)
    const recorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const startedAtRef = useRef<number>(0)
    const tickIntervalRef = useRef<number | null>(null)

    // Web Audio API
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const rafRef = useRef<number | null>(null)

    // 防止 onSend / onCancel 被多次觸發
    const finalizedRef = useRef(false)

    // 記住最新 callbacks，避免初始化 effect 因為 prop 變化重跑
    const onCancelRef = useRef(onCancel)
    const onSendRef = useRef(onSend)
    const onErrorRef = useRef(onError)
    useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
    useEffect(() => { onSendRef.current = onSend }, [onSend])
    useEffect(() => { onErrorRef.current = onError }, [onError])

    // 統一資源清理
    const cleanup = () => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        if (tickIntervalRef.current !== null) {
            window.clearInterval(tickIntervalRef.current)
            tickIntervalRef.current = null
        }
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            try { recorderRef.current.stop() } catch { /* noop */ }
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => { /* noop */ })
            audioCtxRef.current = null
        }
    }

    useEffect(() => {
        let mounted = true

        const start = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                onErrorRef.current?.(t('chat.voice.unsupported'))
                onCancelRef.current()
                return
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                if (!mounted) {
                    stream.getTracks().forEach((tr) => tr.stop())
                    return
                }
                streamRef.current = stream

                // 選擇瀏覽器支援的 mimeType
                const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : MediaRecorder.isTypeSupported('audio/mp4')
                    ? 'audio/mp4'
                    : ''

                const recorder = mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream)
                recorderRef.current = recorder

                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
                }
                recorder.start(250) // 每 250ms 切一塊，避免長錄音記憶體壓力

                startedAtRef.current = performance.now()
                tickIntervalRef.current = window.setInterval(() => {
                    setElapsedMs(performance.now() - startedAtRef.current)
                }, 100)

                // 音量視覺化
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
                audioCtxRef.current = ctx
                const source = ctx.createMediaStreamSource(stream)
                const analyser = ctx.createAnalyser()
                analyser.fftSize = 64
                source.connect(analyser)
                analyserRef.current = analyser

                const data = new Uint8Array(analyser.frequencyBinCount)
                const drawLoop = () => {
                    if (!analyserRef.current) return
                    analyserRef.current.getByteFrequencyData(data)
                    setBars((prev) => {
                        const next = prev.slice(1)
                        const sum = data.reduce((a, b) => a + b, 0)
                        const avg = sum / data.length / 255
                        // 0.05 ~ 1.0 區間，配合視覺最低高度
                        next.push(Math.max(0.08, Math.min(1, avg * 1.6)))
                        return next
                    })
                    rafRef.current = requestAnimationFrame(drawLoop)
                }
                drawLoop()

                // 註：原本嘗試用瀏覽器 webkitSpeechRecognition 做即時轉錄，
                // 但實測在多數環境會無聲失敗（Brave 完全沒有；Chrome 在企業環境也常被擋）。
                // 改成全部交給後端 Whisper（見 useChatLogic.handleSendVoice）。

                setIsReady(true)
            } catch (err: any) {
                if (!mounted) return
                const msg = err?.name === 'NotAllowedError'
                    ? t('chat.voice.permissionDenied')
                    : t('chat.voice.startFailed')
                onErrorRef.current?.(msg)
                onCancelRef.current()
            }
        }

        start()

        return () => {
            mounted = false
            cleanup()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleCancel = () => {
        if (finalizedRef.current) return
        finalizedRef.current = true
        cleanup()
        onCancel()
    }

    const handleSend = () => {
        if (finalizedRef.current) return
        finalizedRef.current = true
        const recorder = recorderRef.current
        const durationMs = Math.round(performance.now() - startedAtRef.current)

        // 太短 (< 500ms) 直接視為取消，避免空語音訊息
        if (durationMs < 500 || !recorder) {
            cleanup()
            onCancel()
            return
        }

        const handleStop = () => {
            const mimeType = recorder.mimeType || 'audio/webm'
            const blob = new Blob(chunksRef.current, { type: mimeType })
            const url = URL.createObjectURL(blob)
            cleanup()
            // transcript 由後端 Whisper 處理，這裡只回傳音訊本身
            onSend({
                blob,
                url,
                mimeType,
                durationMs,
            })
        }

        if (recorder.state !== 'inactive') {
            recorder.addEventListener('stop', handleStop, { once: true })
            try { recorder.stop() } catch { handleStop() }
        } else {
            handleStop()
        }
    }

    // bars 高度的 inline style — 預先計算避免 React render 字串化成本
    const barElements = useMemo(() => bars.map((h, i) => (
        <span
            key={i}
            className="inline-block w-[3px] bg-accent rounded-full transition-[height] duration-75"
            style={{ height: `${Math.round(h * 28)}px` }}
        />
    )), [bars])

    return (
        <div
            className="flex items-center gap-3 px-4 py-3 w-full bg-bg-base border border-border-subtle rounded-[30px] shadow-md dark:shadow-black/40"
            role="dialog"
            aria-label={t('chat.voice.recordingAria')}
        >
            {/* 取消按鈕 */}
            <button
                type="button"
                onClick={handleCancel}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title={t('chat.voice.cancel')}
                aria-label={t('chat.voice.cancel')}
            >
                <MaterialIcon name="close" size={22} />
            </button>

            {/* 錄音指示燈 + 計時 */}
            <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[14px] font-mono tabular-nums text-text-primary min-w-[44px]">
                    {formatDuration(elapsedMs)}
                </span>
            </div>

            {/* 波形 */}
            <div className="flex-1 flex items-center justify-center gap-[3px] h-8 overflow-hidden px-1">
                {isReady ? barElements : (
                    <span className="text-[13px] text-text-muted">{t('chat.voice.preparing')}</span>
                )}
            </div>

            {/* 送出按鈕 */}
            <button
                type="button"
                onClick={handleSend}
                disabled={!isReady}
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-accent text-text-on-accent hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                title={t('chat.voice.send')}
                aria-label={t('chat.voice.send')}
            >
                <MaterialIcon name="send" size={18} filled />
            </button>
        </div>
    )
}
