/**
 * MaterialIcon —— 保留原本的用法（name="mic" 等），但改畫 Snow 圖示庫（範本規格：24 格、線條、圓頭圓角）。
 * 原本是 Google Material Symbols 字型圖示，和全站圖示風格不一致，所以改成依名稱對照。
 */
import { CSSProperties } from 'react'
import * as I from '@/components/snow/icons'

interface MaterialIconProps {
    name: string
    className?: string
    size?: number
    /** 舊參數（範本圖示一律線條，不填色），保留介面相容 */
    filled?: boolean
    weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
    style?: CSSProperties
    title?: string
    onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
    'aria-hidden'?: boolean
}

const MAP: Record<string, React.ComponentType<I.IconProps>> = {
    mic: I.Mic,
    send: I.ArrowUp,
    attach_file: I.Paperclip,
    check: I.Check,
    check_circle: I.CheckCircle2,
    close: I.X,
    content_copy: I.Copy,
    warning: I.AlertTriangle,
    crisis_alert: I.AlertTriangle,
    error: I.AlertCircle,
    info: I.Info,
    security: I.Shield,
    shield: I.Shield,
    search: I.Search,
    folder: I.Folder,
    memory: I.Cpu,
    developer_board: I.Cpu,
    smart_toy: I.Bot,
    menu_book: I.Book,
    chat: I.MessageSquare,
    play_arrow: I.Play,
    pause: I.Pause,
    description: I.FileText,
    storage: I.Database,
    speed: I.Gauge,
    bolt: I.Zap,
    lock: I.Lock,
    person: I.User,
    group: I.Users,
    settings: I.Settings,
    delete: I.Trash2,
    edit: I.Edit2,
    refresh: I.RefreshCw,
    download: I.Download,
    upload: I.Upload,
    schedule: I.Clock,
    language: I.Globe,
}

export default function MaterialIcon({ name, className = '', size = 20, style, title, onClick, 'aria-hidden': ariaHidden }: MaterialIconProps) {
    const Icon = MAP[name] ?? I.Info
    return (
        <Icon
            size={size}
            className={`inline-block align-middle shrink-0 ${className}`}
            style={style}
            onClick={onClick}
            aria-hidden={ariaHidden ?? !title}
            aria-label={title}
            role={onClick ? 'button' : undefined}
        />
    )
}
