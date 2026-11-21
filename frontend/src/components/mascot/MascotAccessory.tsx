/**
 * 小 AI 的配件（戴在頭上，跟著身體呼吸、跳）：節日或深夜才出現，由 lib/dayPart 決定戴哪一個
 *
 *   nightcap  深夜（22～5 點）：紫色睡帽
 *   christmas 聖誕：紅帽白邊
 *   midAutumn 中秋：柚子帽
 *   newYear   過年：紅色斗方「春」
 *
 * 座標用小 AI 的 220px 設計稿（和 mascot.css 一樣），整張 SVG 蓋在身體上、跟著 --m-size 縮放。
 * 顏色都在 mascot.css 的 --m-acc-* 設定；全部圓角（線條 round、形狀用粗描邊包圓）。
 */
import type { MascotAccessory as Kind } from '@/lib/dayPart'

/** 尖帽（睡帽、聖誕帽共用）：帽身往右後方倒、尖端一顆毛球；droop＝睡帽，尖端垂下來 */
function PointyHat({ body, trim, droop = false }: Readonly<{ body: string; trim: string; droop?: boolean }>) {
    const cone = droop
        ? 'M60 46 C66 -6 140 -40 194 -10 C180 -2 166 16 160 38 Z'
        : 'M60 46 C76 6 128 -26 182 -36 C172 -12 162 12 160 38 Z'
    const pom = droop ? { cx: 196, cy: -2 } : { cx: 184, cy: -36 }
    return (
        <>
            <path d={cone} fill={`var(${body})`} stroke={`var(${body})`} strokeWidth="14" strokeLinejoin="round" />
            <rect x="50" y="32" width="122" height="26" rx="13" transform="rotate(-5 111 45)" fill={`var(${trim})`} />
            <circle {...pom} r="15" fill={`var(${trim})`} />
        </>
    )
}

export default function MascotAccessory({ kind }: Readonly<{ kind: Kind }>) {
    return (
        <svg className={`m-acc m-acc-${kind}`} viewBox="0 0 220 220" aria-hidden>
            {kind === 'nightcap' && <PointyHat body="--m-acc-night" trim="--m-acc-night-trim" droop />}
            {kind === 'christmas' && <PointyHat body="--m-acc-red" trim="--m-acc-white" />}
            {kind === 'midAutumn' && (
                <>
                    {/* 柚子皮：歪歪的圓頂，下緣一圈白色內皮 */}
                    <path d="M44 56 Q40 -16 112 -20 Q184 -16 178 54 Q112 40 44 56 Z" fill="var(--m-acc-pomelo)" />
                    <path d="M44 56 Q112 40 178 54" fill="none" stroke="var(--m-acc-white)" strokeWidth="8" strokeLinecap="round" />
                    <rect x="106" y="-36" width="11" height="22" rx="5.5" fill="var(--m-acc-stem)" />
                    <ellipse cx="134" cy="-30" rx="18" ry="9" transform="rotate(-24 134 -30)" fill="var(--m-acc-leaf)" />
                </>
            )}
            {kind === 'newYear' && (
                // 斗方「春」：斜貼在頭的右上角
                <g transform="rotate(45 158 20)">
                    <rect x="124" y="-14" width="68" height="68" rx="16" fill="var(--m-acc-red)" />
                    <text x="158" y="21" transform="rotate(-45 158 20)" textAnchor="middle" dominantBaseline="central" className="m-acc-char">春</text>
                </g>
            )}
        </svg>
    )
}
