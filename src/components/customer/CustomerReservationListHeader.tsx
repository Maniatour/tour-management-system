'use client'

import { ArrowLeft, Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'

const FILTER_VALUES = ['all', 'inquiry', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const

type CustomerReservationListHeaderProps = {
  filter: string
  onFilterChange: (value: string) => void
  onBack: () => void
  isSimulating?: boolean
  simulatedUserName?: string | undefined
  onGoDashboard: () => void
  onGoProfile: () => void
  onStopSimulation: () => void
}

export default function CustomerReservationListHeader({
  filter,
  onFilterChange,
  onBack,
  isSimulating,
  simulatedUserName,
  onGoDashboard,
  onGoProfile,
  onStopSimulation,
}: CustomerReservationListHeaderProps) {
  const t = useTranslations('common')

  const filterOptions = FILTER_VALUES.map((value) => ({
    value,
    label: t(value === 'all' ? 'all' : value),
  }))

  return (
    <>
      <div className="bg-white shadow-sm p-3 sm:p-6 mb-1 sm:mb-6 rounded-none sm:rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4 space-y-2 sm:space-y-0">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-3 sm:mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-sm sm:text-base">{t('back')}</span>
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{t('myReservations')}</h1>
          </div>
          {isSimulating && simulatedUserName && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs sm:text-sm font-medium text-center">
                {t('simulating')}: {simulatedUserName}
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-1">
                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs hover:bg-primary/90 flex-1 sm:flex-none"
                >
                  {t('dashboard')}
                </button>
                <button
                  type="button"
                  onClick={onGoProfile}
                  className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 flex-1 sm:flex-none"
                >
                  {t('myInfo')}
                </button>
                <button
                  type="button"
                  onClick={onStopSimulation}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center justify-center flex-1 sm:flex-none"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  {t('backToAdmin')}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-sm sm:text-base text-gray-600">{t('checkReservationHistory')}</p>
      </div>

      <div className="bg-white shadow-sm p-3 sm:p-4 mb-1 sm:mb-6 rounded-none sm:rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{t('filterByStatus')}</span>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2 sm:pb-0">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFilterChange(option.value)}
                className={`px-3 py-1 text-sm rounded-full transition-colors whitespace-nowrap flex-shrink-0 ${
                  filter === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
