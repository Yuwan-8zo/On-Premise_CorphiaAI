/**
 * 設定頁面
 */

import { useTranslation } from 'react-i18next'

export default function Settings() {
    const { t } = useTranslation()

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 items-center justify-center">
            <div className="text-center">
                <div className="text-6xl mb-4">⚙️</div>
                <h1 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                    {t('settings.title')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    {t('common.loading')}
                </p>
            </div>
        </div>
    )
}
