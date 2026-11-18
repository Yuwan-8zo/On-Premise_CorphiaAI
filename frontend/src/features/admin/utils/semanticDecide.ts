/**
 * 語意檢查的判定（和後端 services/semantic_guard.py 的 _decide 同一套規則），門檻規劃器用來預覽：
 *   直接攔阻：最像攻擊範例的相似度 ≥ 攔阻門檻，而且比最像的正常範例高出 margin
 *   送模型複查：≥ 複查門檻，而且比正常範例更像攻擊
 *   其他放行
 */
export type SemanticDecision = 'pass' | 'review' | 'block'

export interface SemanticThresholds {
    review: number
    block: number
    margin: number
}

export function decide([score, normal]: [number, number], th: SemanticThresholds): SemanticDecision {
    if (score >= th.block && score - normal >= th.margin) return 'block'
    if (score >= th.review && score > normal) return 'review'
    return 'pass'
}

export interface DecisionShare {
    pass: number
    review: number
    block: number
    total: number
}

/** 這組門檻下，各判定佔幾則 */
export function shareOf(scores: Array<[number, number]>, th: SemanticThresholds): DecisionShare {
    const out: DecisionShare = { pass: 0, review: 0, block: 0, total: scores.length }
    for (const s of scores) out[decide(s, th)] += 1
    return out
}

/** 依分數分成 bins 格（0～1），每格裡三種判定各幾則（長條圖） */
export function histogram(scores: Array<[number, number]>, th: SemanticThresholds, bins: number) {
    const out = Array.from({ length: bins }, () => ({ pass: 0, review: 0, block: 0 }))
    for (const s of scores) {
        const i = Math.min(bins - 1, Math.max(0, Math.floor(s[0] * bins)))
        out[i][decide(s, th)] += 1
    }
    return out
}

/** 百分比（整數；有則數但不到 1% 顯示 <1） */
export function pct(n: number, total: number): string {
    if (!total) return '0'
    const p = (n / total) * 100
    if (p > 0 && p < 1) return '<1'
    return String(Math.round(p))
}
