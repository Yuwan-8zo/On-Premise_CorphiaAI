/**
 * 404 頁面
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
    const { t } = useTranslation()

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center">
                <h1 className="text-9xl font-bold text-primary-500">404</h1>
                <p className="text-2xl font-medium text-slate-700 dark:text-slate-300 mt-4">
                    {t('errors.notFound')}
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                    找不到您要的頁面
                </p>
                <Link
                    to="/"
                    className="inline-block mt-8 px-6 py-3 bg-primary-600 hover:bg-primary-700 
                   text-white font-medium rounded-lg transition-colors"
                >
                    {t('common.back')}
                </Link>
            </div>
        </div>
    )
}
