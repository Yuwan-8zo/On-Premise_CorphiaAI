/**
 * 歡迎頁的 Corphia 標誌寫字動畫
 *   一支粗筆沿每個字母的中心線依序寫過去，筆跡只露出標誌的形狀（SVG 遮罩＋每一筆自己的裁切）；
 *   整段先加速、最後慢下來，全部寫完星芒才閃出來。
 *   每一筆的開始時間、長度、曲線寫在 SVG 裡（--d、--t、--e，由原型的 build.py 依筆畫長度算好）。
 *   視覺置中：標誌的墨水只到 x≈1235，原本畫布到 1439、右邊空一大塊看起來偏左 → 畫布左緣改成 -90：墨水正中間是 -111.9，但使用者看了覺得太右，往左回一點（約 7px）。
 *   筆跡顏色跟著文字色（深淺色都看得到），星芒用品牌色。
 */
import logoSvg from '@/assets/corphia-logo-write.svg?raw'
import './logoWrite.css'

interface LogoWriteProps {
    /** 下方（排版上在標誌上面）的歡迎字 */
    title: string
    /** 寫字開始；換 key 可以重播 */
    play?: boolean
}

export default function LogoWrite({ title, play = true }: Readonly<LogoWriteProps>) {
    return (
        <div className={`logo-write${play ? ' go' : ''}`}>
            {/* 「歡迎使用」排在標誌上面（使用者要求）；寫完才淡入。標誌的名稱寫在 SVG 自己身上（role="img"） */}
            <p className="logo-write-title">{title}</p>
            <div className="logo-write-svg" dangerouslySetInnerHTML={{ __html: logoSvg }} />
        </div>
    )
}
