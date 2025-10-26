import React from 'react'
import { useTranslations } from 'next-intl'
import TourPhotoUpload from '@/components/TourPhotoUpload'

interface TourPhotosProps {
  tour: any
  onPhotosUpdated: () => void
}

export const TourPhotos: React.FC<TourPhotosProps> = ({
  tour,
  onPhotosUpdated
}) => {
  const t = useTranslations('tours.tourPhoto')
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4" id="tour-photos">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        </div>
        <TourPhotoUpload
          tourId={tour.id}
          uploadedBy="guide@tour.com" // 실제로는 현재 로그인한 가이드의 이메일
          onPhotosUpdated={onPhotosUpdated}
        />
      </div>
    </div>
  )
}
