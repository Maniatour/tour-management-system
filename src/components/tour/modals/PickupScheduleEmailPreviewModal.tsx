'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Mail, Eye, Loader2, Users, Clock, Building } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PickupScheduleEmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reservations: Array<{
    id: string
    customer_id: string | null
    pickup_time: string | null
    tour_date?: string | null
  }>
  tourDate: string
  onSend?: () => Promise<void>
}

export default function PickupScheduleEmailPreviewModal({
  isOpen,
  onClose,
  reservations,
  tourDate,
  onSend
}: PickupScheduleEmailPreviewModalProps) {
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [emailContent, setEmailContent] = useState<{
    subject: string
    html: string
    customer: {
      name: string
      email: string
      language: string
    }
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [reservationDetails, setReservationDetails] = useState<Record<string, {
    customerName: string
    adults: number | null
    children: number | null
    infants: number | null
    pickupHotel: string | null
    pickupLocation: string | null
  }>>({})

  const reservationsWithPickupTime = reservations.filter(
    (res) => res.pickup_time && res.pickup_time.trim() !== ''
  )

  // 예약 ID 배열 메모이제이션
  const reservationIds = React.useMemo(
    () => reservationsWithPickupTime.map(r => r.id),
    [reservationsWithPickupTime]
  )

  // 예약 상세 정보 가져오기
  useEffect(() => {
    if (!isOpen || reservationsWithPickupTime.length === 0) return

    const fetchReservationDetails = async () => {
      const details: Record<string, {
        customerName: string
        adults: number | null
        children: number | null
        infants: number | null
        pickupHotel: string | null
        pickupLocation: string | null
      }> = {}

      // 모든 예약 ID 수집
      const reservationIds = reservationsWithPickupTime.map(r => r.id)
      
      try {
        // 한 번에 모든 예약 정보 조회
        type ReservationData = {
          id: string
          customer_id: string | null
          adults: number | null
          child: number | null
          infant: number | null
          pickup_hotel: string | null
        }
        
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant, pickup_hotel')
          .in('id', reservationIds)

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', reservationsError)
          // 에러가 발생해도 기본값 설정
          reservationsWithPickupTime.forEach(res => {
            details[res.id] = {
              customerName: 'Unknown',
              adults: null,
              children: null,
              infants: null,
              pickupHotel: null,
              pickupLocation: null
            }
          })
          setReservationDetails(details)
          return
        }

        const reservationsTyped = (reservationsData || []) as ReservationData[]

        // 고객 ID 수집
        const customerIds = [...new Set(reservationsTyped
          .map(r => r.customer_id)
          .filter((id): id is string => id !== null)
        )]

        // 한 번에 모든 고객 정보 조회
        type CustomerData = {
          id: string
          name: string
        }
        
        let customersMap: Record<string, string> = {}
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', customerIds)

          if (customersData) {
            const customersTyped = customersData as CustomerData[]
            customersMap = customersTyped.reduce((acc, customer) => {
              acc[customer.id] = customer.name
              return acc
            }, {} as Record<string, string>)
          }
        }

        // 호텔 ID 수집
        const hotelIds = [...new Set(reservationsTyped
          .map(r => r.pickup_hotel)
          .filter((id): id is string => id !== null)
        )]

        // 한 번에 모든 호텔 정보 조회
        type HotelData = {
          id: string
          hotel: string
          pick_up_location: string | null
        }
        
        let hotelsMap: Record<string, { hotel: string; location: string | null }> = {}
        if (hotelIds.length > 0) {
          const { data: hotelsData } = await supabase
            .from('pickup_hotels')
            .select('id, hotel, pick_up_location')
            .in('id', hotelIds)

          if (hotelsData) {
            const hotelsTyped = hotelsData as HotelData[]
            hotelsMap = hotelsTyped.reduce((acc, hotel) => {
              acc[hotel.id] = {
                hotel: hotel.hotel,
                location: hotel.pick_up_location
              }
              return acc
            }, {} as Record<string, { hotel: string; location: string | null }>)
          }
        }

        // 예약별로 상세 정보 구성
        reservationsTyped.forEach(reservation => {
          const customerName = reservation.customer_id 
            ? (customersMap[reservation.customer_id] || 'Unknown')
            : 'Unknown'
          
          const hotelInfo = reservation.pickup_hotel 
            ? hotelsMap[reservation.pickup_hotel]
            : null

          details[reservation.id] = {
            customerName,
            adults: reservation.adults || null,
            children: reservation.child || null,
            infants: reservation.infant || null,
            pickupHotel: hotelInfo?.hotel || null,
            pickupLocation: hotelInfo?.location || null
          }
        })

        // 데이터가 없는 예약에 대해서도 기본값 설정
        reservationsWithPickupTime.forEach(res => {
          if (!details[res.id]) {
            details[res.id] = {
              customerName: 'Unknown',
              adults: null,
              children: null,
              infants: null,
              pickupHotel: null,
              pickupLocation: null
            }
          }
        })

        setReservationDetails(details)
      } catch (error) {
        console.error('예약 상세 정보 조회 오류:', error)
        // 에러 발생 시 기본값 설정
        reservationsWithPickupTime.forEach(res => {
          details[res.id] = {
            customerName: 'Unknown',
            adults: null,
            children: null,
            infants: null,
            pickupHotel: null,
            pickupLocation: null
          }
        })
        setReservationDetails(details)
      }
    }

    fetchReservationDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reservationIds.join(',')])

  const selectedReservation = selectedReservationId 
    ? reservations.find(r => r.id === selectedReservationId)
    : reservationsWithPickupTime[0]

  const loadEmailPreview = useCallback(async () => {
    if (!selectedReservation || !selectedReservation.pickup_time) return

    setLoading(true)
    try {
      const response = await fetch('/api/preview-pickup-schedule-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: selectedReservation.id,
          pickupTime: selectedReservation.pickup_time.includes(':') 
            ? selectedReservation.pickup_time 
            : `${selectedReservation.pickup_time}:00`,
          tourDate: selectedReservation.tour_date || tourDate
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API 응답 오류:', response.status, errorData)
        throw new Error(errorData.error || `이메일 미리보기 로드 실패 (${response.status})`)
      }

      const data = await response.json()
      if (!data.emailContent) {
        throw new Error('이메일 내용을 받을 수 없습니다.')
      }
      setEmailContent(data.emailContent)
    } catch (error) {
      console.error('이메일 미리보기 로드 오류:', error)
      alert('이메일 미리보기를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [selectedReservation, tourDate])

  // 초기 선택 예약 설정
  useEffect(() => {
    if (isOpen && reservationsWithPickupTime.length > 0 && !selectedReservationId) {
      setSelectedReservationId(reservationsWithPickupTime[0].id)
    }
  }, [isOpen, reservationsWithPickupTime, selectedReservationId])

  // 선택된 예약이 변경되면 이메일 미리보기 로드
  useEffect(() => {
    if (isOpen && selectedReservation && selectedReservation.pickup_time) {
      loadEmailPreview()
    }
  }, [isOpen, selectedReservationId, selectedReservation, loadEmailPreview])

  const handleSend = async () => {
    if (!onSend) return

    setSending(true)
    try {
      await onSend()
      onClose()
    } catch (error) {
      console.error('일괄 발송 오류:', error)
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">픽업 스케줄 알림 이메일 미리보기</h2>
            <span className="text-sm text-gray-500">
              ({reservationsWithPickupTime.length}건)
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 왼쪽: 예약 목록 */}
          <div className="w-80 border-r overflow-y-auto p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">예약 목록</h3>
            <div className="space-y-3">
              {reservationsWithPickupTime.map((reservation, index) => {
                const details = reservationDetails[reservation.id]
                const totalPeople = (details?.adults || 0) + (details?.children || 0) + (details?.infants || 0)
                const pickupTime = reservation.pickup_time?.includes(':') 
                  ? reservation.pickup_time.substring(0, 5)
                  : reservation.pickup_time

                return (
                  <button
                    key={reservation.id}
                    onClick={() => setSelectedReservationId(reservation.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedReservationId === reservation.id
                        ? 'bg-blue-50 border-blue-500 shadow-md'
                        : 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500">
                        예약 #{index + 1}
                      </div>
                      {selectedReservationId === reservation.id && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    
                    {/* 고객명 */}
                    <div className="font-semibold text-gray-900 mb-2 truncate">
                      {details?.customerName || 'Loading...'}
                    </div>

                    {/* 인원 정보 */}
                    {totalPeople > 0 && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                        <Users size={12} />
                        <span>{totalPeople}명</span>
                        {details?.adults && details.adults > 0 && (
                          <span className="text-gray-500">(성인 {details.adults}</span>
                        )}
                        {details?.children && details.children > 0 && (
                          <span className="text-gray-500">, 아동 {details.children}</span>
                        )}
                        {details?.infants && details.infants > 0 && (
                          <span className="text-gray-500">, 유아 {details.infants}</span>
                        )}
                        {totalPeople > 0 && <span className="text-gray-500">)</span>}
                      </div>
                    )}

                    {/* 픽업 시간 */}
                    {pickupTime && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                        <Clock size={12} />
                        <span className="font-medium">{pickupTime}</span>
                      </div>
                    )}

                    {/* 픽업 호텔 */}
                    {details?.pickupHotel && (
                      <div className="flex items-start gap-1 text-xs text-gray-600">
                        <Building size={12} className="mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{details.pickupHotel}</div>
                          {details.pickupLocation && (
                            <div className="text-gray-500 truncate mt-0.5">{details.pickupLocation}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 오른쪽: 이메일 미리보기 */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">이메일 미리보기를 불러오는 중...</p>
                </div>
              </div>
            ) : emailContent ? (
              <div className="space-y-4">
                {/* 이메일 정보 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">받는 사람:</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">이메일:</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">언어:</span>
                      <span className="ml-2 text-gray-900">{emailContent.customer?.language || '한국어'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">제목:</span>
                      <span className="ml-2 text-gray-900">{emailContent.subject || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* 이메일 내용 미리보기 */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span>이메일 미리보기</span>
                    </div>
                  </div>
                  <div 
                    className="p-4"
                    dangerouslySetInnerHTML={{ __html: emailContent.html }}
                    style={{ 
                      maxWidth: '600px',
                      margin: '0 auto'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>이메일 미리보기를 불러올 수 없습니다.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedReservationId 
              ? reservationsWithPickupTime.findIndex(r => r.id === selectedReservationId) + 1 
              : 1} / {reservationsWithPickupTime.length} 건
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              닫기
            </button>
            {onSend && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>발송 중...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>일괄 발송 ({reservationsWithPickupTime.length}건)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

