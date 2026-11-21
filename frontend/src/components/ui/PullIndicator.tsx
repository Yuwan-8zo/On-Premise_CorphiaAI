/**
 * 下拉重新整理的提示（lib/usePullRefresh）：清單上方被拉出的空間裡，一隻小小的小 AI
 *
 *   拉的時候：小 AI 被拉長（越拉越長），拉夠了就開心
 *   重新載入中：想事情；載完收回去
 *   高度＝拉出的距離，把清單往下推（不是蓋在清單上）
 */
import { useTranslation } from 'react-i18next'
import Mascot from '@/components/mascot/Mascot'
import { pullConfig, type PullState } from '@/lib/usePullRefresh'

/** 拉到門檻時，小 AI 被拉長多少（高 1＋這個值、寬 1－這個值的一半） */
const PULL_STRETCH = 0.35

export default function PullIndicator({ distance, state }: Readonly<{ distance: number; state: PullState }>) {
    const { t } = useTranslation()
    const mood = { idle: 'idle', pulling: 'idle', ready: 'happy', refreshing: 'think' } as const
    const trigger = state === 'idle' ? 1 : pullConfig().trigger || 1
    const k = state === 'refreshing' ? 0 : Math.min(1, distance / trigger) * PULL_STRETCH
    return (
        <div className={`pull-indicator ${state === 'idle' ? 'is-idle' : ''}`} style={{ height: distance }} aria-hidden={state === 'idle'}>
            {state !== 'idle' && (
                <div className="pull-mascot" style={{ transform: `scale(${1 - k / 2}, ${1 + k})` }}>
                    <Mascot mood={mood[state]} label={t('ui.sidebar.refreshing')} accessory={null} />
                </div>
            )}
            {state === 'refreshing' && <output className="sr-only">{t('ui.sidebar.refreshing')}</output>}
        </div>
    )
}
