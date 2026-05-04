/**
 * BackendBootSplash — 後端尚未啟動時的全螢幕等待畫面
 * ----------------------------------------------------
 * 顯示時機：頁面載入後 backend 還沒有 200 過任何一次 health check。
 * 一旦連上（hasInitialConnected = true）就由 LoginPage 自己 unmount。
 *
 * 設計：
 *   - 全螢幕 backdrop（沿用品牌色背景，避免閃白）
 *   - 中央：Corphia logo + 旋轉的細圈 spinner + 兩行文字
 *   - 右上角小型 status pill 不重疊（splash 顯示時表單藏起來，pill 也不會跟它打架）
 *
 * 不在這裡做 health check —— LoginPage 已經有 polling 邏輯，這裡只是純呈現層。
 */

import { useTranslation } from 'react-i18next'

import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'

import type { BackendStatus } from './BackendStatusPill'

interface BackendBootSplashProps {
    status: BackendStatus
}

export default function BackendBootSplash({ status }: BackendBootSplashProps) {
    const { t } = useTranslation()

    // checking → 第一次 fetch 還沒回；offline → 至少 fail 一次但還沒成功
    // 兩者都還沒連上，主訊息一樣；副訊息略有差異讓使用者知道差別
    const isOffline = status === 'offline'

    const title = isOffline
        ? t('auth.waitingBackend', '等待後端啟動')
        : t('auth.connectingBackend', '正在連線後端')

    const hint = isOffline
        ? t('auth.backendOfflineHint', '請確認 backend 已啟動，連上後會自動進入')
        : t('auth.backendCheckingHint', '初次連線，稍候即可使用')

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg-base select-none"
            role="status"
            aria-live="polite"
        >
            {/* 背景柔光斑點，跟登入頁同個調 */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <svg
                    className="absolute w-full h-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 1440 900"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        className="fill-corphia-bronze dark:fill-white opacity-[0.03] dark:opacity-[0.02]"
                        d="M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z"
                    />
                    <path
                        className="fill-corphia-bronze dark:fill-white opacity-[0.06] dark:opacity-[0.03]"
                        d="M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z"
                    />
                </svg>
            </div>

            {/* 中央內容 */}
            <div className="relative z-10 flex flex-col items-center gap-7 px-6 text-center">
                {/* 放大的 wordmark + 呼吸光暈 */}
                <div className="relative">
                    <CorphiaWordmark
                        className="h-20 sm:h-24 w-auto animate-[bootSplashBreathe_2.6s_ease-in-out_infinite]"
                    />
                    {/* offline 時 wordmark 後方淡淡的紅光提示，online checking 時是 bronze */}
                    <div
                        aria-hidden
                        className={`pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-30 ${
                            isOffline ? 'bg-[#FF453A]/30' : 'bg-corphia-bronze/30'
                        }`}
                    />
                </div>

                {/*
                  不定進度條 —— 圓球從左滑到右，後方留下「已走過」的拖尾
                  ───────────────────────────────────────────────────────
                  Track：膠囊狀深色軌道 (h-3 比原本 3px 略粗，球才看得清楚)
                  Fill ：軌道內淺色填充，width 從 0% 動畫到 100%
                  Ball ：軌道上方的小白球，位置跟著 fill 邊緣同步滑動
                  Loop ：到底後 instant 隱藏 → 重置 → 淡入，視覺上是平順循環不會 snap
                */}
                <div
                    className="relative h-3 w-[280px] overflow-hidden rounded-full bg-text-muted/15"
                    role="progressbar"
                    aria-busy="true"
                >
                    {/* 拖尾 / 已走過的部分 */}
                    <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 rounded-full animate-[bootSplashFill_2.2s_cubic-bezier(0.65,0,0.35,1)_infinite] ${
                            isOffline ? 'bg-[#FF453A]/35' : 'bg-text-primary/30'
                        }`}
                    />
                    {/* 圓球 (前緣指引) — top-1/2 + translateY-1/2 確保垂直置中、不被 overflow-hidden 切掉 */}
                    <span
                        aria-hidden
                        className={`absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full shadow-sm animate-[bootSplashBall_2.2s_cubic-bezier(0.65,0,0.35,1)_infinite] ${
                            isOffline ? 'bg-[#FF453A]' : 'bg-text-primary'
                        }`}
                    />
                </div>

                <div className="flex flex-col items-center gap-2">
                    <p className="text-[15px] font-medium tracking-wide text-text-primary">
                        {title}
                        <span className="ml-0.5 inline-flex">
                            <span className="animate-[bounce_1.4s_infinite_-0.32s] inline-block">.</span>
                            <span className="animate-[bounce_1.4s_infinite_-0.16s] inline-block">.</span>
                            <span className="animate-[bounce_1.4s_infinite] inline-block">.</span>
                        </span>
                    </p>
                    <p className="text-[12px] text-text-muted max-w-[320px] leading-relaxed">
                        {hint}
                    </p>
                </div>
            </div>

            {/*
              動畫 keyframes —— 寫在元件內因為只有這裡用，不污染全域 CSS

              bootSplashFill / bootSplashBall：
                0~5%   : opacity 0（重置時隱藏，避免循環瞬間「snap 回左邊」可見）
                5~85%  : 淡入 + 球從 0 滑到右側、填充從 0% 增長到 100%
                85~95% : 維持滿格
                95~100%: 淡出（視覺上完成，準備循環）

              球的 left 用 calc(100% - 0.5rem)：右邊緣減去球本身寬度，避免球被軌道邊緣切到。

              bootSplashBreathe：wordmark 慢速呼吸 (1 → 1.015 → 1)，跟整體節奏一致。
            */}
            <style>{`
                @keyframes bootSplashFill {
                    0%   { width: 0;    opacity: 0; }
                    5%   { width: 0;    opacity: 1; }
                    85%  { width: 100%; opacity: 1; }
                    95%  { width: 100%; opacity: 0; }
                    100% { width: 0;    opacity: 0; }
                }
                @keyframes bootSplashBall {
                    0%   { left: 0;                     opacity: 0; }
                    5%   { left: 0;                     opacity: 1; }
                    85%  { left: calc(100% - 0.5rem);   opacity: 1; }
                    95%  { left: calc(100% - 0.5rem);   opacity: 0; }
                    100% { left: 0;                     opacity: 0; }
                }
                @keyframes bootSplashBreathe {
                    0%, 100% { opacity: 0.85; transform: scale(1); }
                    50%      { opacity: 1;    transform: scale(1.015); }
                }
            `}</style>
        </div>
    )
}
