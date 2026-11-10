/**
 * 全站背景波浪（登入、聊天、後台、文件、啟動畫面共用）
 * 淺色：純主題色低透明度，往下越疊越深。
 * 深色：三層實色色帶，顏色由 App.tsx 從品牌色算出（--wave-d1～d3），一層比一層深。兩種模式都是「上淺下深」。
 * 不混灰色：灰疊在帶色的深底上會發霧、看起來髒。
 *   深色底本身已混了 6% 主題色，波浪再疊一點主題色，層次會落在同一個色相上，不會像白霧發灰。
 */
const WAVES = [
    { d: 'M0,0 C400,400 1000,500 1440,200 L1440,900 L0,900 Z', light: 0.04 },
    { d: 'M0,300 C500,800 1100,700 1440,400 L1440,900 L0,900 Z', light: 0.06 },
    { d: 'M0,600 C600,900 1200,600 1440,700 L1440,900 L0,900 Z', light: 0.03 },
]

export default function WaveBackground() {
    return (
        <svg className="wave-bg absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            {WAVES.map((w) => (
                <path
                    key={w.d}
                    d={w.d}
                    style={{ ['--wl' as string]: w.light }}
                />
            ))}
        </svg>
    )
}
