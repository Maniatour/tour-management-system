import React from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import TourScheduleSection from '@/components/product/TourScheduleSection'

interface TourScheduleProps {
  tour: any
  expandedSections: Set<string>
  onToggleSection: (sectionId: string) => void
  locale: string
}

export const TourSchedule: React.FC<TourScheduleProps> = ({
  tour,
  expandedSections,
  onToggleSection,
  locale
}) => {
  const t = useTranslations('tours.tourSchedule')
  
  if (!tour.product_id) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer mb-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => onToggleSection('tour-schedule')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
          </h2>
          <div className="flex items-center space-x-2">
            {expandedSections.has('tour-schedule') ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        
        {expandedSections.has('tour-schedule') && (
          <TourScheduleSection 
            productId={tour.product_id} 
            teamType={tour.team_type as 'guide+driver' | '2guide' | null}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}
