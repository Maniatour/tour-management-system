import React from 'react'
import { Users, Maximize2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import TourChatRoom from '@/components/TourChatRoom'
import { useTourDetailSectionChrome } from './TourDetailModalChromeContext'

interface TourChatProps {
  tour: any
  user: any
  openChat: (chatData: any) => void
}

export const TourChat: React.FC<TourChatProps> = ({
  tour,
  user,
  openChat
}) => {
  const chrome = useTourDetailSectionChrome()
  const t = useTranslations('tours.tourChat')
  
  const handleOpenFloatingChat = () => {
    if (tour) {
      openChat({
        id: `chat_${tour.id}_${Date.now()}`,
        tourId: tour.id,
        tourDate: tour.tour_date,
        guideEmail: user?.email || "admin@tour.com",
        tourName: `${tour.tour_date} 투어`
      })
    }
  }

  if (!tour) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className={chrome.shellPadding}>
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm mb-2">{t('tourChatRoom')}</p>
            <p className="text-xs">투어 정보를 불러올 수 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className={chrome.shellPadding}>
        <div className={`flex items-center justify-between ${chrome.headerMargin}`}>
          <h3 className={chrome.sectionTitle}>{t('title')}</h3>
          {chrome.compact ? (
            <button
              type="button"
              onClick={handleOpenFloatingChat}
              className={`${chrome.iconButton} border border-gray-200 bg-white text-gray-600 hover:bg-gray-50`}
              title="플로팅 모드"
              aria-label="플로팅 모드"
            >
              <Maximize2 size={chrome.iconSize} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenFloatingChat}
              className={`inline-flex items-center gap-2 ${chrome.textActionButton} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`}
            >
              <Maximize2 size={chrome.iconSize} />
              플로팅 모드
            </button>
          )}
        </div>
        <div className="border rounded-lg overflow-hidden" style={{ height: chrome.compact ? '400px' : '600px' }}>
          <TourChatRoom
            tourId={tour.id}
            guideEmail={user?.email || "admin@tour.com"}
            tourDate={tour.tour_date}
          />
        </div>
      </div>
    </div>
  )
}
