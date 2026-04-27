import React from 'react';

// 極簡直球對決：C + AI Spark
// 保留極高的辨識度，黑底白字，一眼就看出是 Corphia 的「C」與 AI 的結合。
export const CorphiaLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        {/* 背景大圓角方塊 / 圓形 */}
        <rect width="24" height="24" rx="12" className="fill-bg-base dark:fill-bg-elevated" />
        <CorphiaLogoPaths />
    </svg>
);

// 只包含 C 與 Spark 的符號，預設仍為白色以維持相容性，但允許透過 color prop 覆寫 (例如傳入"currentColor" 以適應環境文字顏色)
export const CorphiaLogoSymbol: React.FC<{ className?: string, color?: string }> = ({ className = 'w-6 h-6', color ="white" }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        <CorphiaLogoPaths color={color} />
    </svg>
);

// 專為文字排版 (Inline Text) 設計，裁切掉原本 24x24 的外部留白，使得 C 字型本身可以完美貼合旁邊的文字
export const CorphiaTextLogo: React.FC<{ className?: string, color?: string }> = ({ className = 'w-auto h-auto', color ="currentColor" }) => (
    // viewBox x=6 y=5 width=15 height=14 (緊湊包覆原本的 path 幾何)
    <svg viewBox="5.5 5.5 15 13" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
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
    color = 'currentColor',
}) => (
    <svg
        viewBox="0 0 260 64"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Corphia"
        fill="none"
    >
        {/* ── 幾何 C 字 (完美繼承品牌曲線，並對齊 Baseline y=50) ── */}
        <g transform="translate(-10, -15.7) scale(3.6)">
            <path
                d="M16 8.5C15 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 15 16.5 16 15.5"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
            />
        </g>
        
        {/* ── 四芒星 (星芒) - 完美契合在 C 和 o 之間的幾何縫隙 ── */}
        <path
            transform="translate(61, 25)"
            fill="var(--color-primary)"
            d="M 0 -10 Q 0 0 10 0 Q 0 0 0 10 Q 0 0 -10 0 Q 0 0 0 -10 Z"
        />

        {/* ── 幾何 o 字 (空心圓，完美對齊 Baseline y=50) ── */}
        <circle
            cx="86"
            cy="36.25"
            r="9.25"
            stroke={color}
            strokeWidth="9"
            fill="none"
        />

        {/* ── rphia 文字 (與幾何 C/o 對齊 Baseline y=50) ── */}
        <text
            x="105"
            y="50"
            fontFamily="Inter, 'Noto Sans TC', system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize="52"
            fill={color}
            letterSpacing="-1.5"
            className="select-none pointer-events-none"
            style={{ userSelect: 'none' }}
        >
            rphia
        </text>
    </svg>
);



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
export const CorphiaBrandLogo: React.FC<{ className?: string, color?: string }> = ({ className = 'w-auto h-12', color ="currentColor" }) => (
    <svg viewBox="0 0 440 120" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
            {/* 定義四芒星 (Sparkle)，中心點在 (0,0)，半徑 15 */}
            <path id="sparkle-star" d="M 0 -15 Q 0 0 15 0 Q 0 0 0 15 Q 0 0 -15 0 Q 0 0 0 -15 Z" />
            
            {/* 定義遮罩：白色的地方保留，黑色的地方挖空 */}
            <mask id="brand-cutout-mask">
                <rect x="0" y="0" width="440" height="120" fill="white" />
                
                {/* 挖空 o 的星星 */}
                <g transform="translate(150 65) scale(0.9)">
                    <use href="#sparkle-star" fill="black" />
                </g>
                
                {/* 挖空 p 的星星 */}
                <g transform="translate(254 65) scale(0.9)">
                    <use href="#sparkle-star" fill="black" />
                </g>
                
                {/* 挖空 a 的星星 */}
                <g transform="translate(406 65) scale(0.9)">
                    <use href="#sparkle-star" fill="black" />
                </g>
            </mask>
        </defs>

        {/* 獨立青銅星星 (在 C 與 o 之間) */}
        <g transform="translate(108 40) scale(1.1)">
            <use href="#sparkle-star" fill="var(--color-primary)" />
        </g>
        
        {/* 獨立 i 頂部的黑色星星 */}
        <g transform="translate(366 25) scale(0.9)">
            <use href="#sparkle-star" fill={color} />
        </g>

        {/* 套用遮罩的字母主體 */}
        <g fill={color} mask="url(#brand-cutout-mask)">
            {/* C: 使用圓潤粗線條 (stroke) 繪製 */}
            <path d="M 65 24 A 32 32 0 1 0 65 76" stroke={color} strokeWidth="17" fill="none" strokeLinecap="round" />
            
            {/* o: 完美的實心圓 */}
            <circle cx="150" cy="65" r="24" />
            
            {/* r: 直桿 + 頂部弧線 */}
            <rect x="182" y="41" width="16" height="48" />
            <path d="M 198 65 A 24 24 0 0 1 222 41 L 222 57 A 8 8 0 0 0 198 65 Z" />

            {/* p: 直桿 (向下延伸) + 圓形 bowl */}
            <rect x="230" y="41" width="16" height="69" />
            <circle cx="254" cy="65" r="24" />
            
            {/* h: 直桿 (向上延伸) + 弧線 + 右直桿 */}
            <rect x="286" y="10" width="16" height="79" />
            <rect x="334" y="65" width="16" height="24" />
            <path d="M 302 65 A 24 24 0 0 1 350 65 L 334 65 A 8 8 0 0 0 302 65 Z" />

            {/* i: 下方直桿 */}
            <rect x="358" y="41" width="16" height="48" />
            
            {/* a: 圓形 bowl + 右直桿 */}
            <circle cx="406" cy="65" r="24" />
            <rect x="414" y="41" width="16" height="48" />
        </g>
    </svg>
);

