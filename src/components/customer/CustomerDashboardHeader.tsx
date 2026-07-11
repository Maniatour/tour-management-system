'use client'

import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

type CustomerDashboardHeaderProps = {
  isSimulating?: boolean
  simulatedUserName?: string | undefined
  onProfile: () => void
  onReservations: () => void
  onStopSimulation: () => void
}

export default function CustomerDashboardHeader({
  isSimulating,
  simulatedUserName,
  onProfile,
  onReservations,
  onStopSimulation,
}: CustomerDashboardHeaderProps) {
  const t = useTranslations('customerDashboard')
  const tCommon = useTranslations('common')

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>
        {isSimulating && simulatedUserName && (
          <div className="flex items-center space-x-2">
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
              {tCommon('simulating')}: {simulatedUserName}
            </div>
            <div className="flex space-x-1">
              <button
                type="button"
                onClick={onProfile}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                {tCommon('myInfo')}
              </button>
              <button
                type="button"
                onClick={onReservations}
                className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
              >
                {tCommon('myReservations')}
              </button>
              <button
                type="button"
                onClick={onStopSimulation}
                className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                {tCommon('backToAdmin')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
