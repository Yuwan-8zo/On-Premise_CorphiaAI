/**
 * 骨架畫面（讀取中）：照元件外形放灰色預留方塊，取代轉圈圈。
 *   <Skel>         單一灰塊；預設膠囊（文字行），傳 className 改大小／圓角
 *   <SkelMessages> 對話：左右交錯的氣泡
 *   整頁骨架 <SkelPage> 在 SkelPages.tsx；後台卡片、表格的骨架寫在各分頁裡，和真資料同一組 class
 * 顏色用 --chip（深淺模式各自的淡墨色），呼吸動畫在 snow.css 的 .skel；「減少動態效果」時靜止。
 */
import type { CSSProperties, ReactNode } from 'react'
import i18n from '@/i18n'

export function Skel({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <span aria-hidden className={`skel ${className}`} style={style} />
}

/**
 * 文字骨架：children 放和真資料同格式的佔位文字（例如「0.0」「00.0%」「8 cores」），文字透明、只看到灰條。
 * 高度一定等於真資料那一行，資料載入後版面不會長高或跳動；放在數字、短文字的位置用這個，不要用固定高度的 Skel。
 */
export function SkelText({ children }: { children: ReactNode }) {
    return <span aria-hidden className="skel-text">{children}</span>
}

export function SkelMessages({ count = 3, className = '' }: { count?: number; className?: string }) {
    return (
        <div role="status" aria-label={i18n.t('common.loading')} className={`flex flex-col gap-4 ${className}`}>
            {Array.from({ length: count }, (_, i) =>
                i % 2 === 0 ? (
                    <div key={i} className="flex justify-end">
                        <Skel className="h-[var(--sz-44)] !rounded-[var(--r-22)]" style={{ width: `${38 - (i % 3) * 6}%` }} />
                    </div>
                ) : (
                    <div key={i} className="flex flex-col gap-2">
                        <Skel className="h-[var(--sz-14)] w-[80%]" />
                        <Skel className="h-[var(--sz-14)] w-[72%]" />
                        <Skel className="h-[var(--sz-14)] w-[46%]" />
                    </div>
                ),
            )}
        </div>
    )
}

