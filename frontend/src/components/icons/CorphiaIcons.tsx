import React from 'react';

// 極簡直球對決：C + AI Spark
// 保留極高的辨識度，黑底白字，一眼就看出是 Corphia 的「C」與 AI 的結合。
export const CorphiaLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
        {/* 背景大圓角方塊 / 圓形 */}
        <rect width="24" height="24" rx="12" fill="#1C1C1E" />
        
        {/* 幾何 C 字 */}
        <path d="M16 8.5C15 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 15 16.5 16 15.5" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" />
        
        {/* AI 代表性的小星芒 (Spark) */}
        <path d="M18 9C18 10 19 11 20 11C19 11 18 12 18 13C18 12 17 11 16 11C17 11 18 10 18 9Z" 
              fill="white" />
    </svg>
);

