'use client'

import { Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function CustomerReservationListLoadingState() {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    </div>
  )
}

type CustomerReservationNoCustomerStateProps = {
  onGoProfile: () => void
}

export function CustomerReservationNoCustomerState({
  onGoProfile,
}: CustomerReservationNoCustomerStateProps) {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('noCustomerInfo')}</h2>
        <p className="text-gray-600 mb-4">{t('registerCustomerFirst')}</p>
        <button
          type="button"
          onClick={onGoProfile}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {t('registerProfile')}
        </button>
      </div>
    </div>
  )
}

type CustomerReservationSimulationEmptyStateProps = {
  onGoProfile: () => void
  onStopSimulation: () => void
}

export function CustomerReservationSimulationEmptyState({
  onGoProfile,
  onStopSimulation,
}: CustomerReservationSimulationEmptyStateProps) {
  const t = useTranslations('common')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('simulationMode')}</h2>
        <p className="text-gray-600 mb-4">{t('simulationUserNoReservations')}</p>
        <div className="space-x-2">
          <button
            type="button"
            onClick={onGoProfile}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {t('registerProfile')}
          </button>
          <button
            type="button"
            onClick={onStopSimulation}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            {t('stopSimulation')}
          </button>
        </div>
      </div>
    </div>
  )
}
