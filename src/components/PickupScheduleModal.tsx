import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { X, ImageIcon, MapPin, Play, Users, Info, ChevronDown, ChevronUp, Building2, Footprints } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PickupHotel } from '@/utils/pickupHotelUtils'
import { getPickupLocalizedText } from '@/lib/pickupHotelLocales'
import { PICKUP_HOTEL_SECTION_TITLES } from '@/components/pickup-hotel/PickupHotelSectionEditModal'
import PickupHotelDirectionStepsDisplay from '@/components/pickup-hotel/PickupHotelDirectionStepsDisplay'

function LocationDescriptionSection({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-blue-50/60 px-3 py-2.5 text-sm font-semibold text-blue-700">
        <MapPin size={15} className="shrink-0" />
        {title}
      </div>
      <div className="px-3 py-3">
        <p className="rounded-lg bg-blue-50/80 px-3 py-2.5 text-sm leading-6 text-slate-700 whitespace-pre-line">
          {text}
        </p>
      </div>
    </div>
  )
}

function DirectionSection({
  title,
  text,
  accent,
  icon,
  emptyLabel,
}: {
  title: string
  text: string
  accent: 'blue' | 'green'
  icon: ReactNode
  emptyLabel: string
}) {
  const headerBg =
    accent === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
      <div className={`flex items-center gap-1.5 px-3 py-2.5 ${headerBg}`}>
        <span className="flex shrink-0 items-center">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="px-3 py-3">
        <PickupHotelDirectionStepsDisplay text={text} accent={accent} emptyLabel={emptyLabel} />
      </div>
    </div>
  )
}

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
  const [hotelRecord, setHotelRecord] = useState<PickupHotel | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const contentLocale = language === 'ko' ? 'ko' : 'en'

  const locationDetails = useMemo(() => {
    if (!hotelRecord) {
      return { description: '', fromInside: '', fromOutside: '' }
    }
    return {
      description: getPickupLocalizedText(hotelRecord, 'description', contentLocale),
      fromInside: getPickupLocalizedText(hotelRecord, 'from_inside_hotel', contentLocale),
      fromOutside: getPickupLocalizedText(hotelRecord, 'from_outside_hotel', contentLocale),
    }
  }, [hotelRecord, contentLocale])

  const hasLocationDetails = Boolean(
    locationDetails.description || locationDetails.fromInside || locationDetails.fromOutside
  )

  const hotelMediaUrls = hotelRecord?.media ?? []
  const googleMapsLink = hotelRecord?.link ?? null
  const youtubeLink = hotelRecord?.youtube_link ?? null

  // 픽업 호텔 데이터 가져오기
  useEffect(() => {
    const fetchHotelData = async () => {
      try {
        const { data: hotelData, error } = await supabase
          .from('pickup_hotels')
          .select(
            'media, link, youtube_link, description_ko, description_en, from_inside_hotel_ko, from_inside_hotel_en, from_outside_hotel_ko, from_outside_hotel_en, content_i18n'
          )
          .eq('hotel', schedule.hotel)
          .eq('pick_up_location', schedule.location)
          .single()

        if (error) {
          console.error('Error fetching hotel data:', error)
          return
        }

        if (hotelData) {
          setHotelRecord(hotelData as PickupHotel)
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
      
      {/* 버튼들 */}
      {(hasLocationDetails || hotelMediaUrls.length > 0 || googleMapsLink || youtubeLink) && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="flex items-center justify-between gap-2">
            {/* 왼쪽: 사진 · 지도 · 동영상 */}
            <div className="flex items-center gap-2">
              {hotelMediaUrls.length > 0 && (
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  className="flex items-center justify-center rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                  title={language === 'ko' ? '사진' : 'Photos'}
                >
                  <ImageIcon className="h-4 w-4 text-gray-600" />
                </button>
              )}

              {googleMapsLink && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                  onClick={handleMapClick}
                  title={language === 'ko' ? '구글맵 열기' : 'Open in Google Maps'}
                >
                  <MapPin className="h-4 w-4 text-gray-600" />
                </button>
              )}

              {youtubeLink && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200"
                  onClick={handleYoutubeClick}
                  title={language === 'ko' ? '동영상 보기' : 'Watch Video'}
                >
                  <Play className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>

            {/* 오른쪽: 자세히 보기 */}
            {hasLocationDetails && (
              <button
                type="button"
                onClick={() => setShowDetails((open) => !open)}
                className={`ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showDetails
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{language === 'ko' ? '자세히 보기' : 'View Details'}</span>
                {showDetails ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            )}
          </div>

          {showDetails && hasLocationDetails && (
            <div className="mt-3 space-y-3">
              {locationDetails.description && (
                <LocationDescriptionSection
                  title={PICKUP_HOTEL_SECTION_TITLES.description[language]}
                  text={locationDetails.description}
                />
              )}
              {locationDetails.fromInside && (
                <DirectionSection
                  title={PICKUP_HOTEL_SECTION_TITLES.inside[language]}
                  text={locationDetails.fromInside}
                  accent="blue"
                  icon={<Building2 size={16} />}
                  emptyLabel={language === 'ko' ? '안내 없음' : 'No directions'}
                />
              )}
              {locationDetails.fromOutside && (
                <DirectionSection
                  title={PICKUP_HOTEL_SECTION_TITLES.outside[language]}
                  text={locationDetails.fromOutside}
                  accent="green"
                  icon={<Footprints size={16} />}
                  emptyLabel={language === 'ko' ? '안내 없음' : 'No directions'}
                />
              )}
            </div>
          )}
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
      close: '닫기',
      mapsNotice:
        '버튼을 눌러 Google 지도에서 정확한 픽업 위치를 확인해 주세요. 라스베이거스 호텔은 출입구가 여러 곳인 경우가 많고, 픽업 지점은 메인 로비와 다를 수 있습니다. Google 지도에 표시된 위치로 와 주세요.',
    },
    en: {
      title: 'Pickup Schedule',
      noSchedule: 'No pickup schedule available.',
      close: 'Close',
      mapsNotice:
        'Please click the button to check the exact pickup location on Google Maps. Many Las Vegas hotels have multiple entrances, and the pickup point may be different from the main lobby. Please come to the exact location shown on Google Maps.',
    },
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
          <p
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950"
            role="note"
          >
            {t.mapsNotice}
          </p>
          <div className="space-y-3">
            {pickupSchedule.length > 0 ? (
              pickupSchedule.map((schedule, index) => (
                <ScheduleItem
                  key={index}
                  schedule={schedule}
                  language={language}
                  {...(onPhotoClick ? { onPhotoClick } : {})}
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
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
