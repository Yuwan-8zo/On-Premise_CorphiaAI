/**
 * 歡迎頁的 Corphia 標誌寫字動畫
 *   一支粗筆沿每個字母的中心線依序寫過去，筆跡只露出標誌的形狀（SVG 遮罩＋每一筆自己的裁切）；
 *   整段先加速、最後慢下來，全部寫完星芒才閃出來。
 *   每一筆的開始時間、長度、曲線寫在 SVG 裡（--d、--t、--e，由原型的 build.py 依筆畫長度算好）。
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
            {/* 「歡迎使用」排在標誌上面（使用者要求）；寫完才淡入 */}
            <p className="logo-write-title">{title}</p>
            <div className="logo-write-svg" role="img" aria-label="Corphia" dangerouslySetInnerHTML={{ __html: logoSvg }} />
        </div>
    )
}
