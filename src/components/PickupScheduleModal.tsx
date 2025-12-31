import React, { useState, useEffect } from 'react'
import { X, Camera, MapPin, Play, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PickupScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  pickupSchedule: Array<{
    time: string
    date: string
    hotel: string
    location: string
    people: number
    customers?: Array<{
      name: string
      people: number
    }>
  }>
  language?: 'ko' | 'en'
  onPhotoClick?: (hotelName: string, mediaUrls: string[]) => void
}

// 개별 스케줄 항목 컴포넌트
function ScheduleItem({ 
  schedule, 
  language, 
  onPhotoClick 
}: { 
  schedule: {
    time: string
    date: string
    hotel: string
    location: string
    people: number
    customers?: Array<{ name: string; people: number }>
  }
  language: 'ko' | 'en'
  onPhotoClick?: (hotelName: string, mediaUrls: string[]) => void
}) {
  const [hotelMediaUrls, setHotelMediaUrls] = useState<string[]>([])
  const [googleMapsLink, setGoogleMapsLink] = useState<string | null>(null)
  const [youtubeLink, setYoutubeLink] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // 픽업 호텔 미디어 데이터, 구글맵 링크, 유튜브 링크 가져오기
  useEffect(() => {
    const fetchHotelData = async () => {
      try {
        const { data: hotelData, error } = await supabase
          .from('pickup_hotels')
          .select('media, link, youtube_link')
          .eq('hotel', schedule.hotel)
          .eq('pick_up_location', schedule.location)
          .single()

        if (error) {
          console.error('Error fetching hotel data:', error)
          return
        }

        if (hotelData?.media) {
          setHotelMediaUrls(hotelData.media)
        }
        
        if (hotelData?.link) {
          setGoogleMapsLink(hotelData.link)
        }

        if (hotelData?.youtube_link) {
          setYoutubeLink(hotelData.youtube_link)
        }
      } catch (error) {
        console.error('Error fetching hotel data:', error)
      }
    }

    fetchHotelData()
  }, [schedule.hotel, schedule.location])

  const handlePhotoClick = () => {
    if (onPhotoClick && hotelMediaUrls.length > 0) {
      onPhotoClick(schedule.hotel, hotelMediaUrls)
    }
  }

  const handleMapClick = () => {
    if (googleMapsLink) {
      window.open(googleMapsLink, '_blank')
    }
  }

  const handleYoutubeClick = () => {
    if (youtubeLink) {
      window.open(youtubeLink, '_blank')
    }
  }

  const t = {
    ko: { people: '명' },
    en: { people: ' people' }
  }[language]

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div>
        {/* 첫 번째 줄: 시간, 날짜, 사람 아이콘, 인원 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="text-sm font-medium text-gray-900">
            {schedule.time}
          </div>
          {schedule.date && (
            <div className="text-sm text-gray-600">
              {schedule.date}
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              {schedule.people}
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-700 font-medium">
          {schedule.hotel}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {schedule.location}
        </div>
      </div>
      
      {/* 버튼들 - 항상 표시 */}
      {(hotelMediaUrls.length > 0 || googleMapsLink || youtubeLink) && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex items-center justify-end space-x-2">
            {/* 사진 버튼 */}
            {hotelMediaUrls.length > 0 && (
              <button 
                onClick={handlePhotoClick}
                className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                title={language === 'ko' ? '사진' : 'Photos'}
              >
                <Camera className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {/* 맵 버튼 */}
            {googleMapsLink && (
              <button 
                className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                onClick={handleMapClick}
                title={language === 'ko' ? '구글맵 열기' : 'Open in Google Maps'}
              >
                <MapPin className="h-4 w-4 text-gray-600" />
              </button>
            )}

            {/* 유튜브 버튼 */}
            {youtubeLink && (
              <button 
                className="flex items-center justify-center p-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                onClick={handleYoutubeClick}
                title={language === 'ko' ? '동영상 보기' : 'Watch Video'}
              >
                <Play className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PickupScheduleModal({ 
  isOpen, 
  onClose, 
  pickupSchedule,
  language = 'ko',
  onPhotoClick
}: PickupScheduleModalProps) {
  console.log('PickupScheduleModal props:', { isOpen, pickupSchedule })
  console.log('픽업 스케줄 데이터:', pickupSchedule)
  console.log('픽업 스케줄 개수:', pickupSchedule?.length || 0)
  
  // 다국어 텍스트
  const texts = {
    ko: {
      title: '픽업 스케줄',
      noSchedule: '픽업 스케줄이 없습니다.',
      close: '닫기'
    },
    en: {
      title: 'Pickup Schedule',
      noSchedule: 'No pickup schedule available.',
      close: 'Close'
    }
  }
  
  const t = texts[language]
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {t.title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {pickupSchedule.length > 0 ? (
              pickupSchedule.map((schedule, index) => (
                <ScheduleItem
                  key={index}
                  schedule={schedule}
                  language={language}
                  onPhotoClick={onPhotoClick}
                />
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                {t.noSchedule}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
