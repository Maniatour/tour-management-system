'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useReservationData } from '@/hooks/useReservationData'
import type { Reservation, Customer } from '@/types/reservation'
import { useAuth } from '@/contexts/AuthContext'
import { Eye, X, GripVertical } from 'lucide-react'
import { getCustomerName } from '@/utils/reservationUtils'

// 리사이즈 가능한 모달 컴포넌트
function ResizableModal({
  isOpen,
  onClose,
  title,
  children,
  initialHeight,
  onHeightChange
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  initialHeight: number
  onHeightChange: (height: number) => void
}) {
  const [height, setHeight] = useState(initialHeight)
  const [isResizing, setIsResizing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHeight(initialHeight)
  }, [initialHeight])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const windowHeight = window.innerHeight
      const newHeight = windowHeight - e.clientY
      const minHeight = 300
      const maxHeight = windowHeight - 100
      
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
      setHeight(clampedHeight)
      onHeightChange(clampedHeight)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onHeightChange])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-t-lg shadow-xl w-full max-w-7xl overflow-hidden flex flex-col"
        style={{ height: `${height}px`, maxHeight: '95vh' }}
      >
        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={handleMouseDown}
          className="w-full h-2 bg-gray-200 hover:bg-gray-300 cursor-ns-resize flex items-center justify-center group transition-colors"
        >
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </div>
        
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden" style={{ height: `calc(${height}px - 80px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ReservationDetailsPage() {
  const t = useTranslations('reservations')
  const router = useRouter()
  const params = useParams() as { locale?: string; id?: string }
  const { hasPermission, userRole, user, loading: authLoading, isInitialized } = useAuth()

  // 모든 훅을 조건부 호출 없이 먼저 호출
  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    options,
    pickupHotels,
    coupons,
    loading,
    refreshReservations,
    refreshCustomers
  } = useReservationData()

  const [loadingReservation, setLoadingReservation] = useState<boolean>(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const reservationId = params?.id || ''
  const [tourCreated, setTourCreated] = useState(false)
  
  // 예약 상세 모달 관련 상태
  const [showReservationDetailModal, setShowReservationDetailModal] = useState(false)
  const [modalHeight, setModalHeight] = useState(() => {
    // 기본 높이를 화면 높이의 90%로 설정
    if (typeof window !== 'undefined') {
      return window.innerHeight * 0.9
    }
    return 600
  })

  // 인증 로딩 중이거나 권한이 없는 경우 로딩 표시
  const isStaff = isInitialized && (hasPermission('canManageReservations') || hasPermission('canManageTours') || (userRole === 'admin' || userRole === 'manager'))
  
  // 디버깅을 위한 상세 로그
  useEffect(() => {
    console.log('ReservationDetailsPage - 인증 상태:', {
      isInitialized,
      userRole,
      userEmail: user?.email,
      hasManageReservations: hasPermission('canManageReservations'),
      hasManageTours: hasPermission('canManageTours'),
      isStaff,
      authLoading
    })
  }, [isInitialized, userRole, user?.email, isStaff, authLoading, hasPermission])
  
  // 권한이 없을 때만 리다이렉트 (useEffect로 처리)
  useEffect(() => {
    // 초기화가 완료되고 권한이 없을 때만 리다이렉트
    if (isInitialized && !isStaff) {
      console.log('권한 없음, 리다이렉트:', { isInitialized, isStaff, userRole, user: user?.email })
      router.push(`/${params.locale}/admin`)
    }
  }, [isInitialized, isStaff, router, params.locale, userRole, user])

  // Try to use already-loaded list; if not found, fetch just this reservation
  useEffect(() => {
    const load = async () => {
      if (!reservationId) return
      const found = reservations.find(r => r.id === reservationId)
      if (found) {
        setReservation(found)
        return
      }
      setLoadingReservation(true)
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single()

        if (error) {
          console.error('Failed to fetch reservation:', error)
          return
        }

        if (data) {
          // Minimal map to Reservation type; rely on list loader shape
          const mapped: Reservation = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: (data as any).id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customerId: (data as any).customer_id || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            productId: (data as any).product_id || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tourDate: (data as any).tour_date || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tourTime: (data as any).tour_time || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eventNote: (data as any).event_note || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pickUpHotel: (data as any).pickup_hotel || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pickUpTime: (data as any).pickup_time || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adults: (data as any).adults || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            child: (data as any).child || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            infant: (data as any).infant || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            totalPeople: (data as any).total_people || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channelId: (data as any).channel_id || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            channelRN: (data as any).channel_rn || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            addedBy: (data as any).added_by || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            addedTime: (data as any).created_at || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tourId: (data as any).tour_id || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: ((data as any).status as Reservation['status']) || 'pending',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selectedOptions: (typeof (data as any).selected_options === 'string'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (() => { try { return JSON.parse((data as any).selected_options as unknown as string) } catch { return {} } })()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : ((data as any).selected_options as { [optionId: string]: string[] }) || {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            selectedOptionPrices: (typeof (data as any).selected_option_prices === 'string'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (() => { try { return JSON.parse((data as any).selected_option_prices as unknown as string) } catch { return {} } })()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : ((data as any).selected_option_prices as { [key: string]: number }) || {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            choices: (typeof (data as any).choices === 'string'
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? (() => { try { return JSON.parse((data as any).choices as unknown as string) } catch { return {} } })()
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : ((data as any).choices as { [key: string]: unknown }) || {}),
            hasExistingTour: false
          }
          setReservation(mapped)
        }
      } finally {
        setLoadingReservation(false)
      }
    }
    load()
  }, [reservationId, reservations])

  const handleSubmit = useCallback(async (payload: Omit<Reservation, 'id'>) => {
    if (!reservation) return
    try {
      const reservationData = {
        customer_id: payload.customerId,
        product_id: payload.productId,
        tour_date: payload.tourDate,
        tour_time: payload.tourTime || null,
        event_note: payload.eventNote,
        pickup_hotel: payload.pickUpHotel,
        pickup_time: payload.pickUpTime || null,
        adults: payload.adults,
        child: payload.child,
        infant: payload.infant,
        total_people: payload.totalPeople,
        channel_id: payload.channelId,
        channel_rn: payload.channelRN,
        added_by: payload.addedBy,
        tour_id: payload.tourId,
        status: payload.status,
        selected_options: payload.selectedOptions,
        selected_option_prices: payload.selectedOptionPrices,
        is_private_tour: payload.isPrivateTour || false,
        choices: payload.choices
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('reservations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(reservationData as any)
        .eq('id', reservation.id)

      if (error) {
        alert('예약 수정 중 오류: ' + (error as unknown as { message: string }).message)
        return
      }

      // 새로운 초이스 시스템: reservation_choices 테이블에 저장
      if (payload.choices && payload.choices.required && Array.isArray(payload.choices.required)) {
        // 기존 reservation_choices 삭제
        await supabase
          .from('reservation_choices')
          .delete()
          .eq('reservation_id', reservation.id)

        // 새로운 초이스 데이터 저장
        const choicesToInsert = payload.choices.required.map((choice: any) => ({
          reservation_id: reservation.id,
          choice_id: choice.choice_id,
          option_id: choice.option_id,
          quantity: choice.quantity,
          total_price: choice.total_price
        }))

        if (choicesToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: choicesError } = await (supabase as any)
            .from('reservation_choices')
            .insert(choicesToInsert)

          if (choicesError) {
            console.error('초이스 저장 오류:', choicesError)
            alert('초이스 저장 중 오류가 발생했습니다: ' + choicesError.message)
            return
          }
        }
      }

      await refreshReservations()
      
      // 저장된 예약 데이터를 다시 로드하여 초이스 정보 업데이트
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedReservation, error: loadError } = await (supabase as any)
        .from('reservations')
        .select('*')
        .eq('id', reservation.id)
        .single()
      
      if (!loadError && updatedReservation) {
        // 예약 데이터를 다시 매핑하여 상태 업데이트
        const mapped = {
          id: updatedReservation.id,
          customerId: updatedReservation.customer_id || '',
          customerSearch: '',
          showCustomerDropdown: false,
          productId: updatedReservation.product_id || '',
          selectedProductCategory: '',
          selectedProductSubCategory: '',
          productSearch: '',
          showProductDropdown: false,
          tourDate: updatedReservation.tour_date || '',
          tourTime: updatedReservation.tour_time || '',
          eventNote: updatedReservation.event_note || '',
          pickUpHotel: updatedReservation.pickup_hotel || '',
          pickUpTime: updatedReservation.pickup_time || '',
          adults: updatedReservation.adults || 0,
          child: updatedReservation.child || 0,
          infant: updatedReservation.infant || 0,
          totalPeople: updatedReservation.total_people || 0,
          channelId: updatedReservation.channel_id || '',
          channelRN: updatedReservation.channel_rn || '',
          addedBy: updatedReservation.added_by || '',
          addedTime: updatedReservation.created_at || '',
          tourId: updatedReservation.tour_id || '',
          status: (updatedReservation.status as Reservation['status']) || 'pending',
          selectedOptions: (typeof updatedReservation.selected_options === 'string'
            ? (() => { try { return JSON.parse(updatedReservation.selected_options as unknown as string) } catch { return {} } })()
            : (updatedReservation.selected_options as { [optionId: string]: string[] }) || {}),
          selectedOptionPrices: (typeof updatedReservation.selected_option_prices === 'string'
            ? (() => { try { return JSON.parse(updatedReservation.selected_option_prices as unknown as string) } catch { return {} } })()
            : (updatedReservation.selected_option_prices as { [key: string]: number }) || {}),
          choices: (typeof updatedReservation.choices === 'string'
            ? (() => { try { return JSON.parse(updatedReservation.choices as unknown as string) } catch { return {} } })()
            : (updatedReservation.choices as { [key: string]: unknown }) || {}),
          hasExistingTour: false
        }
        setReservation(mapped)
      }
      
      alert('예약이 수정되었습니다.')
      // 투어가 생성되었다면 투어 섹션도 새로고침
      if (tourCreated) {
        setTourCreated(false)
      }
    } catch (e) {
      console.error(e)
      alert('예약 수정 중 오류가 발생했습니다.')
    }
  }, [reservation, refreshReservations, tourCreated])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)

      if (error) {
        alert('삭제 실패: ' + error.message)
        return
      }
      await refreshReservations()
      alert('삭제되었습니다.')
      router.push(`/${params?.locale || 'ko'}/admin/reservations`)
    } catch (e) {
      console.error(e)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }, [t, refreshReservations, router, params?.locale])

  const content = useMemo(() => {
    if (loading || loadingReservation) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      )
    }
    if (!reservation) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">예약을 찾을 수 없습니다.</p>
          <button
            onClick={() => router.push(`/${params?.locale || 'ko'}/admin/reservations`)}
            className="mt-4 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            목록으로
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <ReservationForm
          reservation={reservation}
          customers={(customers as Customer[]) || []}
          products={products || []}
          channels={channels || []}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={pickupHotels || []}
          coupons={coupons || []}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/${params?.locale || 'ko'}/admin/reservations`)}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDelete}
          layout="page"
          onViewCustomer={() => setShowReservationDetailModal(true)}
        />
      </div>
    )
  }, [loading, loadingReservation, reservation, customers, products, channels, productOptions, options, pickupHotels, coupons, handleSubmit, handleDelete, params?.locale, router, refreshCustomers])

  return (
    <div>
      {/* 초기화가 완료되지 않았을 때 로딩 화면 표시 */}
      {!isInitialized ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      ) : !isStaff ? (
        // 권한이 없을 때는 리다이렉트 중이므로 빈 화면 표시
        null
      ) : (
        <>
          {/* 권한이 있을 때만 실제 콘텐츠 표시 */}
          {content}
          
          {/* 예약 상세 모달 (고객 보기) */}
          {showReservationDetailModal && reservation && (
            <ResizableModal
              isOpen={showReservationDetailModal}
              onClose={() => setShowReservationDetailModal(false)}
              title={`고객 예약 상세 - ${getCustomerName(reservation.customerId, (customers as Customer[]) || [])}`}
              initialHeight={modalHeight}
              onHeightChange={setModalHeight}
            >
              <iframe
                src={`/${params?.locale || 'ko'}/dashboard/reservations/${reservation.customerId}/${reservation.id}`}
                className="w-full h-full border-0"
                title="예약 상세 정보"
              />
            </ResizableModal>
          )}
        </>
      )}
    </div>
  )
}


