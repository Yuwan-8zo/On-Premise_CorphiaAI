/**
 * QrCode — 把文字畫成 QR code（SVG，離線產生）
 *   - 資料點畫成圓角小方塊（相鄰的會連在一起，比圓點好掃）；三個定位方塊畫成圓角方框＋圓角實心方塊（全站大圓角風格）
 *   - 樣式用解碼器實測過：大、中、小三種尺寸都讀得到（圓點樣式在部分尺寸會讀不到）
 *   - 四周留 2 格空白（掃描器需要的安靜區；標準建議 4 格，2 格手機相機實測讀得到，QR 本體才夠大）；
 *     顏色固定深色點＋白底，深色模式也一樣才掃得到
 *   - 同心圓（外圓角＝內圓角＋間距，單位＝格）：定位方塊外緣圓角 3 → 框線內緣 2 → 隔 1 格的實心方塊 1；
 *     白色底卡隔著 2 格安靜區，圓角 3＋2＝5（白底畫在 SVG 裡，跟著格子一起縮放）
 */
import { useMemo, type ReactElement } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
    value: string
    /** 邊長（px）；不給就填滿外層 */
    size?: number | string
    className?: string
}

const QUIET = 2 // 安靜區（格）
const FINDER = 7 // 定位方塊（格）
const FINDER_R = 3 // 定位方塊外緣圓角（格）
const CARD_R = FINDER_R + QUIET // 白色底卡圓角（同心）

export default function QrCode({ value, size = '100%', className = '' }: QrCodeProps) {
    const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value])
    const n = qr.modules.size
    const at = (r: number, c: number) => qr.modules.get(r, c) === 1
    const inFinder = (r: number, c: number) =>
        (r < FINDER && c < FINDER) || (r < FINDER && c >= n - FINDER) || (r >= n - FINDER && c < FINDER)

    const dots: ReactElement[] = []
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (at(r, c) && !inFinder(r, c)) dots.push(<rect key={`${r}-${c}`} x={c + QUIET} y={r + QUIET} width={1.02} height={1.02} rx={0.35} />)
        }
    }
    const finder = (r: number, c: number) => (
        <g key={`f${r}-${c}`}>
            {/* 框線粗 1，畫在中線上：中線圓角＝外緣 − 0.5 */}
            <rect x={c + QUIET + 0.5} y={r + QUIET + 0.5} width={6} height={6} rx={FINDER_R - 0.5} fill="none" stroke="currentColor" strokeWidth={1} />
            {/* 實心方塊：外緣 3 − 框線 1 − 間隔 1 */}
            <rect x={c + QUIET + 2} y={r + QUIET + 2} width={3} height={3} rx={FINDER_R - 2} />
        </g>
    )
    const full = n + QUIET * 2

    return (
        <svg
            viewBox={`0 0 ${full} ${full}`}
            width={size}
            height={size}
            className={className}
            style={{ color: '#111114' }}
            role="img"
            aria-label={`QR code：${value}`}
            fill="currentColor"
        >
            <rect width={full} height={full} rx={CARD_R} fill="#fff" />
            {dots}
            {finder(0, 0)}
            {finder(0, n - FINDER)}
            {finder(n - FINDER, 0)}
        </svg>
    )
}
