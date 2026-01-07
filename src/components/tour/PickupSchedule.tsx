import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, MapPin, Map, Users, Mail, Eye, CheckCircle2, Home, Plane, PlaneTakeoff, HelpCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import { supabase } from '@/lib/supabase'

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
    pickup_notification_sent?: boolean | null
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
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [sendingNotifications, setSendingNotifications] = useState(false)
  const [reservationResidentStatus, setReservationResidentStatus] = useState<Record<string, {
    usResident: number
    nonResident: number
    nonResidentWithPass: number
  }>>({})

  // 예약별 거주 상태 정보 가져오기
  useEffect(() => {
    const fetchResidentStatus = async () => {
      if (assignedReservations.length === 0) return

      const reservationIds = assignedReservations.map(r => r.id)
      const { data: reservationCustomers, error } = await supabase
        .from('reservation_customers')
        .select('reservation_id, resident_status')
        .in('reservation_id', reservationIds)
      
      if (!error && reservationCustomers) {
        const statusMap: Record<string, {
          usResident: number
          nonResident: number
          nonResidentWithPass: number
        }> = {}

        reservationCustomers.forEach((rc: any) => {
          if (!statusMap[rc.reservation_id]) {
            statusMap[rc.reservation_id] = {
              usResident: 0,
              nonResident: 0,
              nonResidentWithPass: 0
            }
          }

          if (rc.resident_status === 'us_resident') {
            statusMap[rc.reservation_id].usResident++
          } else if (rc.resident_status === 'non_resident') {
            statusMap[rc.reservation_id].nonResident++
          } else if (rc.resident_status === 'non_resident_with_pass') {
            statusMap[rc.reservation_id].nonResidentWithPass++
          }
        })

        setReservationResidentStatus(statusMap)
      }
    }

    fetchResidentStatus()
  }, [assignedReservations])

  // 거주 상태 아이콘 가져오기
  const getResidentStatusIcon = (reservationId: string) => {
    const status = reservationResidentStatus[reservationId]
    if (!status) return null

    const total = status.usResident + status.nonResident + status.nonResidentWithPass
    if (total === 0) return null

    // 가장 많은 상태를 대표 아이콘으로 표시
    if (status.usResident >= status.nonResident && status.usResident >= status.nonResidentWithPass) {
      const title = locale === 'ko' 
        ? `${tCommon('statusUsResident')}: ${status.usResident}명`
        : `${tCommon('statusUsResident')}: ${status.usResident}`
      return <Home className="h-3 w-3 text-green-600" title={title} />
    } else if (status.nonResident >= status.nonResidentWithPass) {
      const title = locale === 'ko'
        ? `${tCommon('statusNonResident')}: ${status.nonResident}명`
        : `${tCommon('statusNonResident')}: ${status.nonResident}`
      return <Plane className="h-3 w-3 text-blue-600" title={title} />
    } else {
      const title = locale === 'ko'
        ? `${tCommon('statusNonResidentWithPass')}: ${status.nonResidentWithPass}명`
        : `${tCommon('statusNonResidentWithPass')}: ${status.nonResidentWithPass}`
      return <PlaneTakeoff className="h-3 w-3 text-purple-600" title={title} />
    }
  }
  
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
    const groupedByHotel = assignedReservations.reduce((acc: Record<string, Array<{ id: string; customer_id: string | null; pickup_time: string | null; adults: number | null; children?: number | null; infants?: number | null; tour_date?: string | null }>>, reservation) => {
      const hotelName = getPickupHotelNameOnly(reservation.pickup_hotel || '')
      if (!acc[hotelName]) {
        acc[hotelName] = []
      }
      acc[hotelName].push(reservation)
      return acc
    }, {} as Record<string, any[]>)

    // 오후 9시 이후 시간을 전날로 취급하여 정렬하는 함수
    const sortByPickupTime = (a: { pickup_time: string | null; tour_date?: string | null }, b: { pickup_time: string | null; tour_date?: string | null }) => {
      const parseTime = (time: string | null) => {
        if (!time) return 0
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + (minutes || 0)
      }
      
      const parseDate = (dateStr: string | null | undefined, defaultDate: string) => {
        if (!dateStr) {
          // tour_date가 없으면 첫 번째 예약의 tour_date 사용
          const firstReservation = assignedReservations.find(r => r.tour_date)
          if (firstReservation?.tour_date) {
            const [year, month, day] = firstReservation.tour_date.split('-').map(Number)
            return new Date(year, month - 1, day)
          }
          return new Date(defaultDate)
        }
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
      }
      
      const timeA = parseTime(a.pickup_time)
      const timeB = parseTime(b.pickup_time)
      const referenceTime = 21 * 60 // 오후 9시 (21:00) = 1260분
      
      // 기본 날짜는 첫 번째 예약의 tour_date 사용
      const defaultDate = assignedReservations.find(r => r.tour_date)?.tour_date || '2000-01-01'
      
      // 오후 9시 이후 시간은 전날로 취급
      let dateA = parseDate(a.tour_date, defaultDate)
      let dateB = parseDate(b.tour_date, defaultDate)
      
      if (timeA >= referenceTime) {
        dateA = new Date(dateA)
        dateA.setDate(dateA.getDate() - 1)
      }
      if (timeB >= referenceTime) {
        dateB = new Date(dateB)
        dateB.setDate(dateB.getDate() - 1)
      }
      
      // 날짜와 시간을 함께 고려하여 정렬
      const dateTimeA = dateA.getTime() + timeA * 60 * 1000
      const dateTimeB = dateB.getTime() + timeB * 60 * 1000
      
      return dateTimeA - dateTimeB
    }

    // 호텔별로 정렬 (가장 빠른 픽업 시간 기준)
    const sortedHotelEntries = Object.entries(groupedByHotel).sort(([, reservationsA], [, reservationsB]) => {
      const firstTimeA = reservationsA[0]?.pickup_time || null
      const firstTimeB = reservationsB[0]?.pickup_time || null
      return sortByPickupTime(
        { pickup_time: firstTimeA, tour_date: reservationsA[0]?.tour_date },
        { pickup_time: firstTimeB, tour_date: reservationsB[0]?.tour_date }
      )
    })

    return sortedHotelEntries.map(([hotelName, reservations]) => {
      // 각 호텔 내 예약도 정렬
      const sortedReservations = [...reservations].sort(sortByPickupTime)
      
      const totalPeople = sortedReservations.reduce((sum: number, res) => {
        const adults = res.adults || 0
        const children = (res.children || (res as any).child || 0) as number
        const infants = (res.infants || (res as any).infant || 0) as number
        return sum + adults + children + infants
      }, 0)
      const hotelInfo = pickupHotels.find((h) => h.hotel === hotelName)
      
      // 가장 빠른 픽업 시간 찾기 (정렬된 첫 번째 예약)
      const earliestTime = sortedReservations[0]?.pickup_time 
        ? sortedReservations[0].pickup_time.substring(0, 5) 
        : '08:00'
      
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
            {sortedReservations.map((reservation) => {
              const status = reservationResidentStatus[reservation.id]
              const statusIcon = getResidentStatusIcon(reservation.id)
              
              return (
                <div key={reservation.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                    {reservation.pickup_notification_sent ? (
                      <CheckCircle2 
                        size={14} 
                        className="text-green-600 flex-shrink-0" 
                        title="픽업 안내 발송됨"
                      />
                    ) : (
                      <Mail 
                        size={14} 
                        className="text-gray-400 flex-shrink-0" 
                        title="픽업 안내 미발송"
                      />
                    )}
                    {statusIcon && (
                      <span className="flex-shrink-0">
                        {statusIcon}
                      </span>
                    )}
                    <span>{getCustomerName(reservation.customer_id || '')}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    {status && (status.usResident > 0 || status.nonResident > 0 || status.nonResidentWithPass > 0) && (
                      <span className="text-gray-400">
                        ({status.usResident > 0 && <span className="text-green-600">{status.usResident}</span>}
                        {status.usResident > 0 && (status.nonResident > 0 || status.nonResidentWithPass > 0) && <span className="text-gray-400">/</span>}
                        {status.nonResident > 0 && <span className="text-blue-600">{status.nonResident}</span>}
                        {status.nonResident > 0 && status.nonResidentWithPass > 0 && <span className="text-gray-400">/</span>}
                        {status.nonResidentWithPass > 0 && <span className="text-purple-600">{status.nonResidentWithPass}</span>})
                      </span>
                    )}
                    <span>
                      {(() => {
                        // 필드명이 child/infant일 수도 있고 children/infants일 수도 있음
                        const adults = reservation.adults || 0
                        const children = (reservation.children || (reservation as any).child || 0) as number
                        const infants = (reservation.infants || (reservation as any).infant || 0) as number
                        const total = adults + children + infants
                        
                        // 성인만 있는 경우
                        if (children === 0 && infants === 0) {
                          return `${total}명`
                        }
                        
                        // 아동이나 유아가 있는 경우: "총 인원, 아동X, 유아Y" 형식
                        const detailParts: string[] = []
                        if (children > 0) {
                          detailParts.push(`아동${children}`)
                        }
                        if (infants > 0) {
                          detailParts.push(`유아${infants}`)
                        }
                        
                        return `총 ${total}명, ${detailParts.join(', ')}`
                      })()}
                    </span>
                  </div>
                </div>
              )
            })}
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
