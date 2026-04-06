import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, MapPin, Map, Users, Home, Plane, PlaneTakeoff, HelpCircle, X } from 'lucide-react'
import { FaEnvelope, FaEye, FaCheckCircle, FaExclamationCircle, FaTimesCircle, FaPaperPlane } from 'react-icons/fa'
import { useTranslations, useLocale } from 'next-intl'
import { ConnectionStatusLabel } from './TourUIComponents'
import { supabase } from '@/lib/supabase'
// @ts-expect-error - react-country-flag 라이브러리의 타입 정의가 없음
import ReactCountryFlag from 'react-country-flag'

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
  getCustomerLanguage?: (customerId: string) => string
  openGoogleMaps: (link: string) => void
  /** 투어 상품이 거주 상태 UI 대상일 때만 예약 행에 거주 아이콘·조회 */
  residentStatusIndicatorsEnabled?: boolean
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
  getCustomerLanguage,
  openGoogleMaps,
  residentStatusIndicatorsEnabled = false
}) => {
  const t = useTranslations('tours.pickupSchedule')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [reservationResidentStatus, setReservationResidentStatus] = useState<Record<string, {
    usResident: number
    nonResident: number
    nonResidentWithPass: number
  }>>({})
  const [emailStatusMap, setEmailStatusMap] = useState<Record<string, {
    status: 'sent' | 'failed' | 'delivered' | 'bounced'
    opened_at?: string | null
    opened_count?: number | null
    delivered_at?: string | null
    bounced_at?: string | null
    bounce_reason?: string | null
  }>>({})
  const [showEmailStatusHelpModal, setShowEmailStatusHelpModal] = useState(false)

  // 언어를 국가 코드로 변환하는 함수
  const getLanguageFlag = (language: string | null | undefined): string => {
    if (!language) return 'US'
    const lang = language.toLowerCase()
    if (lang === 'kr' || lang === 'ko' || lang === '한국어') return 'KR'
    if (lang === 'en' || lang === '영어') return 'US'
    if (lang === 'jp' || lang === '일본어') return 'JP'
    if (lang === 'cn' || lang === '중국어') return 'CN'
    if (lang === 'es' || lang === '스페인어') return 'ES'
    if (lang === 'fr' || lang === '프랑스어') return 'FR'
    if (lang === 'de' || lang === '독일어') return 'DE'
    if (lang === 'it' || lang === '이탈리아어') return 'IT'
    if (lang === 'pt' || lang === '포르투갈어') return 'PT'
    if (lang === 'ru' || lang === '러시아어') return 'RU'
    if (lang === 'th' || lang === '태국어') return 'TH'
    if (lang === 'vi' || lang === '베트남어') return 'VN'
    if (lang === 'id' || lang === '인도네시아어') return 'ID'
    if (lang === 'ms' || lang === '말레이어') return 'MY'
    if (lang === 'ph' || lang === '필리핀어') return 'PH'
    return 'US' // 기본값
  }

  // 예약별 거주 상태 정보 가져오기
  useEffect(() => {
    const fetchResidentStatus = async () => {
      if (!residentStatusIndicatorsEnabled) {
        setReservationResidentStatus({})
        return
      }
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
  }, [assignedReservations, residentStatusIndicatorsEnabled])

  // 예약별 이메일 발송 현황 가져오기
  useEffect(() => {
    const fetchEmailStatus = async () => {
      if (assignedReservations.length === 0) return

      const reservationIds = assignedReservations.map(r => r.id)
      
      console.log(`[PickupSchedule] 이메일 로그 조회 시작 - 예약 ID 개수: ${reservationIds.length}`, reservationIds)
      
      // 각 예약의 최신 픽업 스케줄 알림 이메일 로그 조회
      const { data: emailLogs, error } = await supabase
        .from('email_logs')
        .select('reservation_id, status, opened_at, opened_count, delivered_at, bounced_at, bounce_reason, sent_at, email_type')
        .in('reservation_id', reservationIds)
        .order('sent_at', { ascending: false })

      console.log(`[PickupSchedule] 이메일 로그 조회 결과:`, {
        error,
        count: emailLogs?.length || 0,
        logs: emailLogs
      })

      if (error) {
        console.error('[PickupSchedule] 이메일 로그 조회 오류:', error)
      }

      if (!error && emailLogs && emailLogs.length > 0) {
        // email_type이 'pickup'인 것만 필터링
        const pickupLogs = emailLogs.filter((log: any) => log.email_type === 'pickup')
        console.log(`[PickupSchedule] 픽업 이메일 로그 필터링 결과:`, {
          total: emailLogs.length,
          pickup: pickupLogs.length,
          logs: pickupLogs
        })
        // 각 예약별로 최신 이메일 로그만 사용 (sent_at 기준으로 정렬되어 있으므로 첫 번째 것만 사용)
        const statusMap: Record<string, {
          status: 'sent' | 'failed' | 'delivered' | 'bounced'
          opened_at?: string | null
          opened_count?: number | null
          delivered_at?: string | null
          bounced_at?: string | null
          bounce_reason?: string | null
        }> = {}

        // 예약 ID별로 그룹화하고 각 그룹의 첫 번째(최신) 로그만 사용
        const seenReservations = new Set<string>()
        pickupLogs.forEach((log: any) => {
          const reservationId = log.reservation_id
          
          // 이미 처리한 예약은 스킵 (최신 로그만 사용)
          if (seenReservations.has(reservationId)) {
            return
          }

          seenReservations.add(reservationId)
          
          // delivered_at이 있으면 status를 'delivered'로 설정
          let finalStatus = log.status
          if (log.delivered_at && log.status !== 'bounced' && log.status !== 'failed') {
            finalStatus = 'delivered'
            console.log(`[PickupSchedule] ✅ 예약 ${reservationId}의 상태를 'delivered'로 변경`, {
              originalStatus: log.status,
              delivered_at: log.delivered_at,
              timestamp: new Date(log.delivered_at).toISOString()
            })
          }
          
          statusMap[reservationId] = {
            status: finalStatus,
            opened_at: log.opened_at,
            opened_count: log.opened_count || 0,
            delivered_at: log.delivered_at,
            bounced_at: log.bounced_at,
            bounce_reason: log.bounce_reason
          }
          
          console.log(`[PickupSchedule] 📧 이메일 로그 처리 완료 - 예약 ID: ${reservationId}`, {
            finalStatus,
            delivered_at: log.delivered_at,
            originalStatus: log.status,
            opened_at: log.opened_at,
            opened_count: log.opened_count
          })
        })

        console.log('[PickupSchedule] 이메일 상태 맵:', statusMap)
        setEmailStatusMap(statusMap)
      } else {
        console.log('[PickupSchedule] 이메일 로그가 없거나 조회 실패:', {
          hasError: !!error,
          error,
          hasLogs: !!emailLogs,
          logCount: emailLogs?.length || 0
        })
        // 이메일 로그가 없어도 빈 맵으로 설정하여 재시도 방지
        setEmailStatusMap({})
      }
    }

    fetchEmailStatus()
  }, [assignedReservations])

  // 거주 상태 아이콘 가져오기
  const getResidentStatusIcon = (reservationId: string) => {
    if (!residentStatusIndicatorsEnabled) return null
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

  // 이메일 발송 현황 아이콘 가져오기
  const getEmailStatusIcon = (reservationId: string) => {
    const emailStatus = emailStatusMap[reservationId]
    const pickupNotificationSent = assignedReservations.find(r => r.id === reservationId)?.pickup_notification_sent

    // 디버깅: 모든 상태 로그
    if (emailStatus) {
      console.log(`[PickupSchedule] 이메일 상태 확인 - 예약 ID: ${reservationId}`, {
        emailStatus,
        delivered_at: emailStatus.delivered_at,
        status: emailStatus.status,
        opened_at: emailStatus.opened_at,
        opened_count: emailStatus.opened_count,
        isDelivered: !!(emailStatus.delivered_at || emailStatus.status === 'delivered'),
        isOpened: !!(emailStatus.opened_at || (emailStatus.opened_count && emailStatus.opened_count > 0))
      })
    }

    // 이메일 로그가 없는 경우
    if (!emailStatus) {
      if (pickupNotificationSent) {
        // 발송 플래그만 있고 로그가 없는 경우 (구버전 데이터 또는 로그 조회 실패)
        // 이 경우에도 파란색으로 표시 (발송은 완료된 것으로 간주)
        console.log(`[PickupSchedule] ⚠️ 이메일 로그 없음, pickup_notification_sent=true - 예약 ID: ${reservationId}`)
        return (
          <FaCheckCircle 
            size={14} 
            className="flex-shrink-0" 
            style={{ color: '#2563eb' }}
            title="픽업 안내 발송됨 (상세 정보 없음)"
          />
        )
      } else {
        return (
          <FaEnvelope 
            size={14} 
            className="flex-shrink-0" 
            style={{ color: '#9ca3af' }}
            title="픽업 안내 미발송"
          />
        )
      }
    }

    // 이메일 상태에 따라 아이콘 표시 (우선순위: 실패 > 반송 > 읽음 > 전달 완료 > 발송 완료)
    if (emailStatus.status === 'failed') {
      return (
        <FaTimesCircle 
          size={14} 
          className="flex-shrink-0" 
          style={{ color: '#dc2626' }}
          title="이메일 발송 실패"
        />
      )
    }

    if (emailStatus.status === 'bounced' || emailStatus.bounced_at) {
      return (
        <FaExclamationCircle 
          size={14} 
          className="flex-shrink-0" 
          style={{ color: '#ea580c' }}
          title={`이메일 반송됨${emailStatus.bounce_reason ? `: ${emailStatus.bounce_reason}` : ''}`}
        />
      )
    }

    // 읽음 상태는 전달 완료보다 우선 (읽으면 전달된 것이므로)
    if (emailStatus.opened_at || (emailStatus.opened_count && emailStatus.opened_count > 0)) {
      return (
        <FaEye 
          size={14} 
          className="flex-shrink-0" 
          style={{ color: '#16a34a' }}
          title={`이메일 읽음${emailStatus.opened_count && emailStatus.opened_count > 1 ? ` (${emailStatus.opened_count}회)` : ''}`}
        />
      )
    }

    // 전달 완료 체크 (delivered_at이 있거나 status가 'delivered'인 경우)
    // 읽지 않았지만 전달된 경우
    const hasDeliveredAt = !!emailStatus.delivered_at
    const isDeliveredStatus = emailStatus.status === 'delivered'
    const isOpened = !!(emailStatus.opened_at || (emailStatus.opened_count && emailStatus.opened_count > 0))
    const isDelivered = hasDeliveredAt || isDeliveredStatus
    
    if (isDelivered && !isOpened) {
      console.log(`[PickupSchedule] ✅✅✅ 전달 완료 아이콘 렌더링 - 예약 ID: ${reservationId}`, {
        delivered_at: emailStatus.delivered_at,
        status: emailStatus.status,
        opened_at: emailStatus.opened_at,
        opened_count: emailStatus.opened_count,
        hasDeliveredAt,
        isDeliveredStatus,
        isDelivered,
        isOpened
      })
      return (
        <span style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center' }}>
          <FaCheckCircle 
            size={14} 
            className="flex-shrink-0" 
            style={{ 
              color: '#2563eb'
            }}
            title="이메일 전달 완료"
          />
        </span>
      )
    }

    // 발송 완료 (전달 대기 중)
    if (emailStatus.status === 'sent') {
      return (
        <FaPaperPlane 
          size={14} 
          className="flex-shrink-0" 
          style={{ color: '#6b7280' }}
          title="이메일 발송 완료 (전달 대기 중)"
        />
      )
    }

    // 기본값
    return (
      <FaEnvelope 
        size={14} 
        className="flex-shrink-0" 
        style={{ color: '#9ca3af' }}
        title="픽업 안내 미발송"
      />
    )
  }
  
  // 픽업 시간이 설정된 예약 개수 확인
  const reservationsWithPickupTime = assignedReservations.filter(
    (res) => res.pickup_time && res.pickup_time.trim() !== ''
  ).length

  const renderPickupSchedule = () => {
    if (assignedReservations.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">{t('noAssignedReservations')}</p>
          <p className="text-xs">{t('assignToShowSchedule')}</p>
        </div>
      )
    }

    // 픽업 호텔 ID별로 그룹화 (같은 호텔이어도 픽업 장소가 다르면 별도 그룹으로 표시)
    const groupedByPickupHotelId = assignedReservations.reduce((acc: Record<string, Array<{ id: string; customer_id: string | null; pickup_time: string | null; pickup_hotel?: string | null; adults: number | null; children?: number | null; infants?: number | null; tour_date?: string | null }>>, reservation) => {
      const hotelId = reservation.pickup_hotel || ''
      if (!hotelId) return acc
      if (!acc[hotelId]) {
        acc[hotelId] = []
      }
      acc[hotelId].push(reservation)
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

    // 픽업 호텔 ID별로 정렬 (가장 빠른 픽업 시간 기준)
    const sortedHotelEntries = Object.entries(groupedByPickupHotelId).sort(([, reservationsA], [, reservationsB]) => {
      const firstTimeA = reservationsA[0]?.pickup_time || null
      const firstTimeB = reservationsB[0]?.pickup_time || null
      return sortByPickupTime(
        { pickup_time: firstTimeA, tour_date: reservationsA[0]?.tour_date },
        { pickup_time: firstTimeB, tour_date: reservationsB[0]?.tour_date }
      )
    })

    return sortedHotelEntries.map(([pickupHotelId, reservations]) => {
      // 각 그룹 내 예약도 정렬
      const sortedReservations = [...reservations].sort(sortByPickupTime)
      // 픽업 호텔 ID로 정보 조회 (예약에 저장된 실제 픽업 장소 사용)
      const hotelInfo = pickupHotels.find((h) => h.id === pickupHotelId)
      const hotelName = hotelInfo ? hotelInfo.hotel : getPickupHotelNameOnly(pickupHotelId)
      
      const totalPeople = sortedReservations.reduce((sum: number, res) => {
        const adults = res.adults || 0
        const children = (res.children || (res as any).child || 0) as number
        const infants = (res.infants || (res as any).infant || 0) as number
        return sum + adults + children + infants
      }, 0)
      
      // 가장 빠른 픽업 시간 찾기 (정렬된 첫 번째 예약)
      const earliestTime = sortedReservations[0]?.pickup_time 
        ? sortedReservations[0].pickup_time.substring(0, 5) 
        : '08:00'
      
      return (
        <div key={pickupHotelId} className="border rounded-lg p-3">
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
                <div key={reservation.id} className="flex items-center justify-between p-2 border border-gray-200 rounded bg-white hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-1 text-xs">
                    <span 
                      className="flex-shrink-0" 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        lineHeight: 1
                      }}
                    >
                      {getEmailStatusIcon(reservation.id)}
                    </span>
                    {statusIcon && (
                      <span className="flex-shrink-0">
                        {statusIcon}
                      </span>
                    )}
                    {reservation.customer_id && getCustomerLanguage && (() => {
                      const customerLanguage = getCustomerLanguage(reservation.customer_id)
                      const flagCode = getLanguageFlag(customerLanguage)
                      return (
                        <ReactCountryFlag
                          countryCode={flagCode}
                          svg
                          style={{
                            width: '16px',
                            height: '12px',
                            borderRadius: '2px',
                            marginRight: '6px'
                          }}
                        />
                      )
                    })()}
                    <span className="text-gray-700 font-medium">{getCustomerName(reservation.customer_id || '')}</span>
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
                setShowEmailStatusHelpModal(true)
              }}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title={t('emailStatusHelpTitle')}
            >
              <HelpCircle size={18} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                onAutoGenerate()
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              {t('autoGenerate')}
            </button>
            {reservationsWithPickupTime > 0 && (
              <>
                {onPreviewEmail && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreviewEmail()
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 flex items-center gap-1"
                    title={t('sendEmailTitle')}
                  >
                    <FaEnvelope size={14} />
                    <span>{t('email')}</span>
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

      {/* 이메일 상태 아이콘 설명 모달 */}
      {showEmailStatusHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEmailStatusHelpModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FaEnvelope className="w-5 h-5 text-blue-600" />
                  {t('emailStatusModalTitle')}
                </h2>
                <button
                  onClick={() => setShowEmailStatusHelpModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 발송 실패 */}
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <FaTimesCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-1">{t('sendFailed')}</h3>
                    <p className="text-sm text-red-800">
                      {t('sendFailedDesc')}
                    </p>
                  </div>
                </div>

                {/* 반송 */}
                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <FaExclamationCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 mb-1">{t('bounced')}</h3>
                    <p className="text-sm text-orange-800">
                      {t('bouncedDesc')}
                      <span className="block mt-1 text-xs text-orange-700">
                        {t('bouncedHover')}
                      </span>
                    </p>
                  </div>
                </div>

                {/* 읽음 */}
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <FaEye size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 mb-1">{t('read')}</h3>
                    <p className="text-sm text-green-800">
                      {t('readDesc')}
                      <span className="block mt-1 text-xs text-green-700">
                        {t('readHover')}
                      </span>
                    </p>
                  </div>
                </div>

                {/* 전달 완료 */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <FaCheckCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">{t('delivered')}</h3>
                    <p className="text-sm text-blue-800">
                      {t('deliveredDesc')}
                    </p>
                  </div>
                </div>

                {/* 발송 완료 (전달 대기 중) */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <FaPaperPlane size={20} className="text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{t('sentPending')}</h3>
                    <p className="text-sm text-gray-700">
                      {t('sentPendingDesc')}
                    </p>
                  </div>
                </div>

                {/* 미발송 */}
                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <FaEnvelope size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-700 mb-1">{t('notSent')}</h3>
                    <p className="text-sm text-gray-600">
                      {t('notSentDesc')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  💡 <strong>{t('tipLabel')}:</strong> {t('tipHover')}
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowEmailStatusHelpModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
