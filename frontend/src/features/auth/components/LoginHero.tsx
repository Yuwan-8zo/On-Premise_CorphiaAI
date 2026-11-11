/**
 * 登入頁左半邊（只在桌機顯示）：歡迎標題、品牌字標、副標、三個特色
 */
import { useTranslation } from 'react-i18next'
import { FileText, MessageSquare, Shield } from '@/components/snow/icons'
import { CorphiaWordmark } from '@/components/icons/CorphiaIcons'

export default function LoginHero() {
    const { t } = useTranslation()
    const features = [
        { icon: MessageSquare, title: t('auth.feature1'), desc: t('auth.feature1Desc') },
        { icon: FileText, title: t('auth.feature2'), desc: t('auth.feature2Desc') },
        { icon: Shield, title: t('auth.feature3'), desc: t('auth.feature3Desc') },
    ]

    return (
        // 整塊往右推約 4% 視窗寬，視覺重心不要太靠左
        <div className="flex-1 flex items-center justify-center w-full pl-[4vw]">
            <div className="mx-auto max-w-[460px] w-full px-6 sm:px-10 lg:px-12 xl:px-16">
                <h2 className="text-[44px] xl:text-[52px] font-bold text-text-primary tracking-[-0.025em] leading-tight relative z-10 transition-colors">
                    {t('auth.welcomeTitle')}
                </h2>
                <div className="mt-5 -mb-6 relative z-0 flex items-center">
                    <CorphiaWordmark className="h-[96px] w-auto max-w-full object-contain object-left pointer-events-none select-none" />
                </div>
                {/* 副標（Apple 副標 17／22 次要字） */}
                <p className="mt-2 mb-10 text-[17px] leading-[22px] text-text-secondary">
                    {t('auth.engineSubtitle', '企業知識引擎')} · <span className="whitespace-nowrap">{t('auth.localDeploy', '地端部署')}</span>
                </p>

                <div className="space-y-7">
                    {features.map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex items-center gap-4">
                            <div className="flex-shrink-0 w-[52px] h-[52px] rounded-full glass-chip flex items-center justify-center relative">
                                <Icon className="w-6 h-6 text-accent" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[17px] leading-[22px] font-semibold text-text-primary mb-0.5">{title}</span>
                                <span className="text-[15px] leading-[20px] text-text-secondary">{desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
