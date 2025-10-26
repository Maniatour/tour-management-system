import React from 'react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'

interface TourInfoProps {
  tour: any
  product: any
  tourNote: string
  isPrivateTour: boolean
  connectionStatus: { tours: boolean }
  params: { locale: string }
  onTourNoteChange: (note: string) => void
  onPrivateTourToggle: () => void
  getStatusColor: (status: string | null) => string
  getStatusText: (status: string | null) => string
}

export const TourInfo: React.FC<TourInfoProps> = ({
  tour,
  product,
  tourNote,
  isPrivateTour,
  connectionStatus,
  params,
  onTourNoteChange,
  onPrivateTourToggle,
  getStatusColor,
  getStatusText
}) => {
  const t = useTranslations('tours.tourInfo')
  const productName = params.locale === 'ko' ? product?.name_ko : product?.name_en
  const dateLocale = params.locale === 'ko' ? 'ko-KR' : 'en-US'
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
          {t('title')}
          <ConnectionStatusLabel status={connectionStatus.tours} section={t('section')} />
        </h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">{t('tourName')}:</span>
            <span className="font-medium text-sm">{productName || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">{t('tourDate')}:</span>
            <span className="font-medium text-sm">
              {tour.tour_date ? new Date(tour.tour_date + 'T00:00:00').toLocaleDateString(dateLocale, {timeZone: 'America/Los_Angeles'}) : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">{t('tourTime')}:</span>
            <span className="font-medium text-sm">
              {tour.tour_start_datetime ? new Date(tour.tour_start_datetime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : '08:00'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 text-sm">{t('status')}:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tour.tour_status)}`}>
              {getStatusText(tour.tour_status, params.locale)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">{t('tourType')}:</span>
            <button
              onClick={onPrivateTourToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isPrivateTour
                  ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
              }`}
            >
              {isPrivateTour ? t('privateTour') : t('regularTour')}
            </button>
          </div>
        </div>
        
        {/* 투어 노트 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tourNote')}
          </label>
          <textarea
            value={tourNote}
            onChange={(e) => onTourNoteChange(e.target.value)}
            placeholder={t('tourNotePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}
