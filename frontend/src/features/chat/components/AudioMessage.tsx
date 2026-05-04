/**
 * AudioMessage
 *
 * 在訊息氣泡內顯示語音附件的播放器。
 *
 * 設計：
 *   - 圓形播放/暫停按鈕（使用 Material Symbols 圖示）
 *   - 進度條（可拖曳跳轉）
 *   - 時長 (mm:ss)
 *   - 主題色（accent）跟隨全站品牌色
 */

import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '@/components/icons/MaterialIcon'
import type { MessageAudio } from '@/types/chat'

interface AudioMessageProps {
    audio: MessageAudio
    /** 是否為使用者訊息（影響配色） */
    isUser?: boolean
}

function formatDuration(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) seconds = 0
    const totalSec = Math.floor(seconds)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function AudioMessage({ audio, isUser = false }: AudioMessageProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentSec, setCurrentSec] = useState(0)
    const [durationSec, setDurationSec] = useState(audio.durationMs / 1000)

    useEffect(() => {
        const el = audioRef.current
        if (!el) return

        const onTimeUpdate = () => setCurrentSec(el.currentTime)
        const onLoadedMeta = () => {
            // 部分瀏覽器（特別是 Chrome 對 webm/opus）可能回傳 Infinity，
            // 此時退回使用錄音時手動計算的 durationMs
            if (isFinite(el.duration) && el.duration > 0) setDurationSec(el.duration)
        }
        const onEnded = () => {
            setIsPlaying(false)
            setCurrentSec(0)
            try { el.currentTime = 0 } catch { /* noop */ }
        }
        const onPause = () => setIsPlaying(false)
        const onPlay = () => setIsPlaying(true)

        el.addEventListener('timeupdate', onTimeUpdate)
        el.addEventListener('loadedmetadata', onLoadedMeta)
        el.addEventListener('ended', onEnded)
        el.addEventListener('pause', onPause)
        el.addEventListener('play', onPlay)
        return () => {
            el.removeEventListener('timeupdate', onTimeUpdate)
            el.removeEventListener('loadedmetadata', onLoadedMeta)
            el.removeEventListener('ended', onEnded)
            el.removeEventListener('pause', onPause)
            el.removeEventListener('play', onPlay)
        }
    }, [])

    const togglePlay = () => {
        const el = audioRef.current
        if (!el) return
        if (isPlaying) {
            el.pause()
        } else {
            el.play().catch(() => { /* 自動播放被擋 → 由使用者再次點擊 */ })
        }
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const el = audioRef.current
        if (!el) return
        const target = Number(e.target.value)
        try { el.currentTime = target } catch { /* noop */ }
        setCurrentSec(target)
    }

    const safeDuration = durationSec > 0 ? durationSec : 1
    const progress = Math.min(100, (currentSec / safeDuration) * 100)

    return (
        <div
            className={[
                'flex items-center gap-3 min-w-[220px] max-w-[320px] py-2 pl-2 pr-3 rounded-2xl',
                isUser
                    ? 'bg-white/10 backdrop-blur-sm'
                    : 'bg-bg-surface',
            ].join(' ')}
        >
            {/* 隱藏的 audio 元素 */}
            <audio
                ref={audioRef}
                src={audio.url}
                preload="metadata"
                className="hidden"
            />

            {/* 播放/暫停按鈕 */}
            <button
                type="button"
                onClick={togglePlay}
                className={[
                    'shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95',
                    isUser
                        ? 'bg-white text-accent hover:bg-white/90'
                        : 'bg-accent text-text-on-accent hover:bg-accent-hover',
                ].join(' ')}
                aria-label={isPlaying ? 'pause' : 'play'}
            >
                <MaterialIcon name={isPlaying ? 'pause' : 'play_arrow'} size={20} filled />
            </button>

            {/* 進度條 + 時長 */}
            <div className="flex-1 min-w-0">
                <div
                    className={[
                        'relative h-[6px] rounded-full',
                        isUser ? 'bg-white/30' : 'bg-border-subtle',
                    ].join(' ')}
                >
                    <div
                        className={[
                            'absolute left-0 top-0 h-full rounded-full',
                            isUser ? 'bg-white' : 'bg-accent',
                        ].join(' ')}
                        style={{ width: `${progress}%` }}
                    />
                    <input
                        type="range"
                        min={0}
                        max={safeDuration}
                        step={0.1}
                        value={currentSec}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="seek"
                    />
                </div>
                <div className={[
                    'mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums',
                    isUser ? 'text-white/80' : 'text-text-muted',
                ].join(' ')}>
                    <span>{formatDuration(currentSec)}</span>
                    <span>{formatDuration(safeDuration)}</span>
                </div>
            </div>
        </div>
    )
}
