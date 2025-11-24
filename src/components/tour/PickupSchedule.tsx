import React, { useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Map, Users, Mail, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'

interface PickupScheduleProps {
  assignedReservations: Array<{
    id: string
    customer_id: string | null
    pickup_hotel: string | null
    pickup_time: string | null
    adults: number | null
    children?: number | null
    infants?: number | null
    tour_date?: string | null
  }>
  pickupHotels: Array<{
    id: string
    hotel: string
    pick_up_location?: string
    google_maps_link?: string
  }>
  expandedSections: Set<string>
  connectionStatus: { reservations: boolean }
  onToggleSection: (sectionId: string) => void
  onAutoGenerate: () => void
  onBatchSendNotification?: () => Promise<void>
  onPreviewEmail?: () => void
  getPickupHotelNameOnly: (hotelId: string) => string
  getCustomerName: (customerId: string) => string
  openGoogleMaps: (link: string) => void
}

export const PickupSchedule: React.FC<PickupScheduleProps> = ({
  assignedReservations,
  pickupHotels,
  expandedSections,
  connectionStatus,
  onToggleSection,
  onAutoGenerate,
  onBatchSendNotification,
  onPreviewEmail,
  getPickupHotelNameOnly,
  getCustomerName,
  openGoogleMaps
}) => {
  const t = useTranslations('tours.pickupSchedule')
  const [sendingNotifications, setSendingNotifications] = useState(false)
  
  // 픽업 시간이 설정된 예약 개수 확인
  const reservationsWithPickupTime = assignedReservations.filter(
    (res) => res.pickup_time && res.pickup_time.trim() !== ''
  ).length

  const handleBatchSend = async () => {
    if (!onBatchSendNotification) return
    
    if (reservationsWithPickupTime === 0) {
      alert('픽업 시간이 설정된 예약이 없습니다. 먼저 픽업 시간을 설정해주세요.')
      return
    }

    if (!confirm(`픽업 시간이 설정된 ${reservationsWithPickupTime}건의 예약에 대해 고객에게 알림을 발송하시겠습니까?`)) {
      return
    }

    setSendingNotifications(true)
    try {
      await onBatchSendNotification()
      alert(`픽업 스케줄 알림이 ${reservationsWithPickupTime}건 발송되었습니다.`)
    } catch (error) {
      console.error('일괄 알림 발송 오류:', error)
      alert('일괄 알림 발송 중 오류가 발생했습니다.')
    } finally {
      setSendingNotifications(false)
    }
  }
  const renderPickupSchedule = () => {
    if (assignedReservations.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">배정된 예약이 없습니다.</p>
          <p className="text-xs">예약을 배정하면 픽업 스케줄이 표시됩니다.</p>
        </div>
      )
    }

    // 호텔별로 그룹화
    const groupedByHotel = assignedReservations.reduce((acc: Record<string, Array<{ id: string; customer_id: string | null; pickup_time: string | null; adults: number | null; children?: number | null; infants?: number | null }>>, reservation) => {
      const hotelName = getPickupHotelNameOnly(reservation.pickup_hotel || '')
      if (!acc[hotelName]) {
        acc[hotelName] = []
      }
      acc[hotelName].push(reservation)
      return acc
    }, {} as Record<string, any[]>)

    return Object.entries(groupedByHotel).map(([hotelName, reservations]) => {
      const totalPeople = reservations.reduce((sum: number, res) => sum + ((res.adults || 0) + (res.children || 0) + (res.infants || 0)), 0)
      const hotelInfo = pickupHotels.find((h) => h.hotel === hotelName)
      
      // 가장 빠른 픽업 시간 찾기
      const pickupTimes = reservations.map((r) => r.pickup_time).filter(Boolean)
      const earliestTime = pickupTimes.length > 0 ? 
        (pickupTimes.sort()[0] || '').substring(0, 5) : '08:00'
      
      return (
        <div key={hotelName} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-600">{earliestTime}</span>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-sm">{hotelName}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                <Users size={14} />
                <span>{totalPeople}</span>
              </span>
            </div>
            {hotelInfo?.link && (
              <button
                onClick={() => openGoogleMaps(hotelInfo.link || '')}
                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                title="구글 맵에서 보기"
              >
                <Map size={16} />
              </button>
            )}
          </div>
          {hotelInfo && (
            <div className="text-xs text-gray-500 mb-2">
              {hotelInfo.pick_up_location}
            </div>
          )}
          <div className="space-y-1">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-600">
                  {getCustomerName(reservation.customer_id || '')}
                </div>
                <div className="text-xs text-gray-500">
                  {reservation.total_people || 0}인
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <div 
          className="flex items-center justify-between cursor-pointer mb-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => onToggleSection('pickup-schedule')}
        >
          <h2 className="text-md font-semibold text-gray-900 flex items-center">
            {t('title')}
            <ConnectionStatusLabel status={connectionStatus.reservations} section="예약" />
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onAutoGenerate()
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              자동생성
            </button>
            {reservationsWithPickupTime > 0 && (
              <>
                {onPreviewEmail && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreviewEmail()
                    }}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 flex items-center gap-1"
                    title="이메일 미리보기"
                  >
                    <Eye size={14} />
                    <span>미리보기</span>
                  </button>
                )}
                {onBatchSendNotification && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleBatchSend()
                    }}
                    disabled={sendingNotifications}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title={`픽업 시간 일괄 발송 (${reservationsWithPickupTime}건)`}
                  >
                    {sendingNotifications ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>발송 중...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        <span>일괄 발송 ({reservationsWithPickupTime})</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
            {expandedSections.has('pickup-schedule') ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        
        {expandedSections.has('pickup-schedule') && (
          <div className="space-y-2">
            {renderPickupSchedule()}
          </div>
        )}
      </div>
    </div>
  )
}
