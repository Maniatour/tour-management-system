import React from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('tours.tourChat')
  
  const handleOpenChat = () => {
    if (tour) {
      openChat({
        id: `chat_${tour.id}_${Date.now()}`, // 고유한 ID 생성
        tourId: tour.id,
        tourDate: tour.tour_date,
        guideEmail: user?.email || "admin@tour.com",
        tourName: `${tour.tour_date} 투어`
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
          <Button 
            onClick={handleOpenChat}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            {t('floatingChat')}
          </Button>
        </div>
        <div className="text-center py-8 text-gray-500">
          <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm mb-2">{t('tourChatRoom')}</p>
          <p className="text-xs">{t('openChatMessage')}</p>
        </div>
      </div>
    </div>
  )
}
