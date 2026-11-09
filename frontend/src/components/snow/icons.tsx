/**
 * Snow 圖示庫 —— 照「北海道雪見六日」範本的圖示規格（IC 物件 + .ic 樣式）
 *
 *   24×24 格線、只用線條不填色、stroke: currentColor、線寬 1.8（Dock 27px 圖示用 1.6）、
 *   圓頭圓角；每個圖示是幾筆簡單的幾何線條，點用「.01 長度的線段＋圓頭」表示。
 *   範本有的圖示（警告、箭頭、大樓、盾牌、月亮、太陽、星星、地圖釘、上一頁／下一頁）直接沿用範本線條；
 *   系統需要但範本沒有的，照同一套規格重畫。
 *
 * 匯出名稱與 lucide-react 相同，原本 `from 'lucide-react'` 的地方直接換成這裡即可。
 */
import { forwardRef, type SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
    size?: number | string
    strokeWidth?: number | string
    color?: string
}

const make = (name: string, d: string, extra?: (p: { color?: string }) => React.ReactNode) => {
    const C = forwardRef<SVGSVGElement, IconProps>(({ size = 24, strokeWidth = 1.8, color = 'currentColor', className = '', ...rest }, ref) => (
        <svg
            ref={ref}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={rest['aria-label'] ? undefined : true}
            className={`ic ic-${name} ${className}`}
            {...rest}
        >
            {d && <path d={d} />}
            {extra?.({ color })}
        </svg>
    ))
    C.displayName = name
    return C
}

const CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0 -18'

// ── 範本原有的線條 ──
export const AlertTriangle = make('AlertTriangle', 'M12 3l9 16H3zM12 10v4M12 17h.01')
export const ArrowLeft = make('ArrowLeft', 'M19 12H5M11 6l-6 6 6 6')
export const ArrowRight = make('ArrowRight', 'M5 12h14M13 6l6 6-6 6')
export const Building2 = make('Building2', 'M5 21V5l7-2v18M12 9h7v12M3 21h18M8 8h.01M8 12h.01M8 16h.01M15 13h.01M15 17h.01')
export const ChevronLeft = make('ChevronLeft', 'M15 6l-6 6 6 6')
export const ChevronRight = make('ChevronRight', 'M9 6l6 6-6 6')
export const Shield = make('Shield', 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z')
export const ShieldCheck = make('ShieldCheck', 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-4.5')
export const Moon = make('Moon', 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z')
export const Sun = make('Sun', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')
export const Star = make('Star', 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z')
export const MapPin = make('MapPin', 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z')
export const Menu = make('Menu', 'M5 7h14M5 12h14M5 17h14')

// ── 同規格新畫 ──
export const Activity = make('Activity', 'M3 12h4l3-7 4 14 3-7h4')
export const AlertCircle = make('AlertCircle', `${CIRCLE}M12 7.5v5M12 16.4h.01`)
export const CircleAlert = AlertCircle
export const Check = make('Check', 'M5 12.5l4.5 4.5L19 7')
export const CheckCircle2 = make('CheckCircle2', `${CIRCLE}M8.5 12l2.5 2.5 4.5-4.5`)
export const Clock = make('Clock', `${CIRCLE}M12 7v5l3 2`)
export const Copy = make('Copy', 'M9 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM16 8V5a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2')
export const Cpu = make('Cpu', 'M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3')
export const Database = make('Database', 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3')
export const Download = make('Download', 'M12 4v11M7 10l5 5 5-5M5 20h14')
export const Upload = make('Upload', 'M12 20V9M7 14l5-5 5 5M5 4h14')
export const Edit2 = make('Edit2', 'M15 4.5l4.5 4.5L8 20.5H3.5V16zM13 6.5l4.5 4.5')
export const FileText = make('FileText', 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6')
export const Folder = make('Folder', 'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z')
export const Gauge = make('Gauge', 'M4.6 18A9 9 0 1 1 19.4 18M12 14l4-5M12 14h.01')
export const HardDrive = make('HardDrive', 'M3 13l2.5-7h13l2.5 7v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 13h18M7 16h.01M11 16h.01')
export const HelpCircle = make('HelpCircle', `${CIRCLE}M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 16.6h.01`)
export const Home = make('Home', 'M3 11l9-7 9 7M5 9.5V20h5v-5h4v5h5V9.5')
export const Info = make('Info', `${CIRCLE}M12 10.5v5M12 7.6h.01`)
export const Layers3 = make('Layers3', 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5')
export const Loader2 = make('Loader2', 'M21 12a9 9 0 1 1-6.2-8.6')
export const LogOut = make('LogOut', 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9')
export const MessageSquare = make('MessageSquare', 'M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z')
export const MonitorPlay = make('MonitorPlay', 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 21h8M12 17v4M10.5 8.5v5l4-2.5z')
// 三個點：範本用「.01 線段＋圓頭」畫點；這裡加粗到 3 讓點看得見
export const MoreHorizontal = make('MoreHorizontal', '', () => (
    <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3.2} />
))
export const PanelLeftClose = make('PanelLeftClose', 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16M16 9.5L13.5 12l2.5 2.5')
export const Plus = make('Plus', 'M12 5v14M5 12h14')
export const RefreshCw = make('RefreshCw', 'M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4')
export const Search = make('Search', 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0 -14M16 16l4.5 4.5')
export const Server = make('Server', 'M5 4h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h14a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM8 7h.01M8 17h.01')
export const Settings = make('Settings', 'M12 3l2 2.4 3.1-.3.5 3.1L20 10l-1.4 2.4L20 15l-2.4 1.8-.5 3.1-3.1-.3L12 21l-2-2.4-3.1.3-.5-3.1L4 15l1.4-2.6L4 10l2.4-1.8.5-3.1 3.1.3zM12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 1 0 0 -5.6')
export const SlidersHorizontal = make('SlidersHorizontal', 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4')
export const Sparkles = make('Sparkles', 'M11 4l1.6 4.4L17 10l-4.4 1.6L11 16l-1.6-4.4L5 10l4.4-1.6zM18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z')
export const Trash2 = make('Trash2', 'M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v6M14 11v6')
export const UserRoundCog = make('UserRoundCog', 'M10 3a4 4 0 1 0 0 8a4 4 0 1 0 0 -8M3 21c0-3.9 3.1-7 7-7 1.3 0 2.5.3 3.5.9M18 14.5V16M18 20v1.5M21.5 18H20M16 18h-1.5M18 16.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0 -3.6')
export const User = make('User', 'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0 -8M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7')
export const Users = make('Users', 'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0 -8M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M16 4.2a3.5 3.5 0 0 1 0 6.6M18 14.3c2.3.8 4 3 4 5.7')
export const X = make('X', 'M6 6l12 12M18 6L6 18')
export const Zap = make('Zap', 'M13 3L5 13.5h6L10 21l8-10.5h-6z')
export const Mic = make('Mic', 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21')
export const Paperclip = make('Paperclip', 'M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7')
export const ArrowUp = make('ArrowUp', 'M12 19V5M6 11l6-6 6 6')
export const Share = make('Share', 'M12 15V3M7 8l5-5 5 5M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6')
export const Globe = make('Globe', `${CIRCLE}M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z`)
export const Book = make('Book', 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4')
export const Lock = make('Lock', 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4')
export const Palette = make('Palette', 'M12 3a9 9 0 0 0 0 18c1 0 1.6-.8 1.6-1.6 0-1-.8-1.4-.8-2.4 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01')
export const Undo = make('Undo', 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11')
export const Regenerate = make('Regenerate', 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5')

// ── 對照內嵌圖示補畫（同規格） ──
export const ChevronDown = make('ChevronDown', 'M6 9l6 6 6-6')
export const ChevronUp = make('ChevronUp', 'M6 15l6-6 6 6')
export const ArrowDown = make('ArrowDown', 'M12 5v14M6 13l6 6 6-6')
export const Eye = make('Eye', 'M2.5 12C4.6 7.6 8 5.5 12 5.5s7.4 2.1 9.5 6.5c-2.1 4.4-5.5 6.5-9.5 6.5S4.6 16.4 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0 -5')
export const EyeOff = make('EyeOff', 'M4 4l16 16M10 6c.7-.3 1.3-.5 2-.5 4 0 7.4 2.1 9.5 6.5-.6 1.3-1.4 2.4-2.3 3.3M7 7.4C5.1 8.5 3.6 10 2.5 12c2.1 4.4 5.5 6.5 9.5 6.5 1.6 0 3-.3 4.3-1M10.2 10.3a2.5 2.5 0 0 0 3.5 3.5')
export const Languages = make('Languages', 'M3 6h11M8.5 3v3M5 6c.8 3 3 5.6 6 7M12 6c-.9 3.4-3.5 6.7-7 8.5M13 21l4-9 4 9M14.4 18h5.2')
export const Mail = make('Mail', 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7l8.5 6 8.5-6')
export const Code = make('Code', 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16')
export const PanelLeft = make('PanelLeft', 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 4v16')
export const Pointer = make('Pointer', 'M6 4l13 6.5-5.5 1.5-1.5 5.5zM13.5 13.5L19 19')
export const Square = make('Square', 'M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z')
export const Play = make('Play', 'M8 5.5v13l10.5-6.5z')
export const Pause = make('Pause', 'M8 5v14M16 5v14')
export const Bot = make('Bot', 'M7 8h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM12 4v4M9.5 13h.01M14.5 13h.01M3 13v2M21 13v2')
