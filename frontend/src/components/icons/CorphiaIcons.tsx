import React from 'react';
import CorphiaLogoLight from '../../assets/Corphia_LOGO_Light_nostar.png';
import CorphiaLogoDark from '../../assets/Corphia_LOGO_Dark_nostar.png';
import CorphiaLogoStar from '../../assets/Corphia_LOGO_star.png';

// 極簡直球對決：C + AI Spark
// 保留極高的辨識度，黑底白字，一眼就看出是 Corphia 的「C」與 AI 的結合。
export const CorphiaLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6 text-text-primary' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <CorphiaLogoPaths color="currentColor" />
    </svg>
);

// 只包含 C 與 Spark 的符號，預設仍為白色以維持相容性，但允許透過 color prop 覆寫 (例如傳入"currentColor" 以適應環境文字顏色)
export const CorphiaLogoSymbol: React.FC<{ className?: string, color?: string }> = ({ className = 'w-6 h-6', color ="white" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <CorphiaLogoPaths color={color} />
    </svg>
);

/**
 * Corphia 完整品牌字標
 * 將 C 字型、四芒星與 orphia 文字整合為單一 SVG 元件
 * 使用 Inter 字體確保與全站字型一致
 */
export const CorphiaWordmark: React.FC<{ className?: string; color?: string }> = ({
    className = 'h-14 w-auto',
}) => <LogoWithStar className={className} alt="Corphia Logo" />;

/**
 * 字樣圖片（已去掉星星）＋ 用強調色填滿的星星遮罩，星星會跟著系統強調色變。
 * 遮罩和圖片同尺寸，位置對齊方式跟著 object-left / 置中。
 */
const LogoWithStar: React.FC<{ className: string; alt: string }> = ({ className, alt }) => {
    const pos = /object-left/.test(className) ? 'left center' : 'center'
    const star: React.CSSProperties = {
        backgroundColor: 'rgb(var(--accent))',
        WebkitMaskImage: `url(${CorphiaLogoStar})`,
        maskImage: `url(${CorphiaLogoStar})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: pos,
        maskPosition: pos,
    }
    return (
        <span className="relative inline-block max-w-full align-middle select-none pointer-events-none">
            <img src={CorphiaLogoLight} alt={alt} className={`dark:hidden ${className}`} draggable={false} />
            <img src={CorphiaLogoDark} alt={alt} className={`hidden dark:block ${className}`} draggable={false} />
            <span aria-hidden className="absolute inset-0" style={star} />
        </span>
    )
}



const CorphiaLogoPaths = ({ color = "white", sparkColor = "var(--color-primary)" }: { color?: string, sparkColor?: string }) => (
    <>
        {/* 幾何 C 字 */}
        <path d="M16 8.5C15 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 15 16.5 16 15.5" 
              stroke={color} 
              strokeWidth="2.5" 
              strokeLinecap="round" />
        
        {/* AI 代表性的小星芒 (Spark) */}
        <path d="M18 9C18 10 19 11 20 11C19 11 18 12 18 13C18 12 17 11 16 11C17 11 18 10 18 9Z" 
              fill={sparkColor} />
    </>
);

// 方案 C: 軌跡描繪 (The Neural Drawing)
export const CorphiaThinkingIcon: React.FC<{ className?: string, color?: string }> = ({ className = 'w-6 h-6', color ="currentColor" }) => (
    <span className={`inline-flex items-center justify-center ${className}`}>
        <svg viewBox="5.5 5.5 15 14" fill="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">

            {/* 幾何 C 字 - 軌跡描繪 */}
            <path d="M16 8.5C15 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 15 16.5 16 15.5" 
                  stroke={color} 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  style={{ strokeDasharray: 28 }}
                  className="animate-draw-c" />
            
            {/* AI 星芒 - 尾端點亮 */}
            <path d="M18 9C18 10 19 11 20 11C19 11 18 12 18 13C18 12 17 11 16 11C17 11 18 10 18 9Z" 
                  fill={color}
                  style={{ transformOrigin: '18px 11px' }}
                  className="animate-pop-spark" />
        </svg>
    </span>
);

// ============================================================================
// 專為品牌展示設計的「全向量幾何」字體 Logo (Perfect Pixel Vector)
// 完美復刻了 Corphia 的專屬字型設計，包含挖空的星芒 (Sparkles)
// ============================================================================
export const CorphiaBrandLogo: React.FC<{ className?: string, color?: string }> = ({ 
    className = 'w-auto h-12' 
}) => <LogoWithStar className={className} alt="Corphia Brand Logo" />;

