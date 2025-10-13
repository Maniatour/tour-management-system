'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useReservationData } from '@/hooks/useReservationData'
import type { Reservation, Customer } from '@/types/reservation'
import { useAuth } from '@/contexts/AuthContext'

export default function ReservationDetailsPage() {
  const t = useTranslations('reservations')
  const router = useRouter()
  const params = useParams() as { locale?: string; id?: string }
  const { hasPermission, userRole, user, loading: authLoading, isInitialized } = useAuth()

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
  }, [isInitialized, userRole, user?.email, isStaff, authLoading])
  
  // 권한이 없을 때만 리다이렉트 (useEffect로 처리)
  useEffect(() => {
    // 초기화가 완료되고 권한이 없을 때만 리다이렉트
    if (isInitialized && !isStaff) {
      console.log('권한 없음, 리다이렉트:', { isInitialized, isStaff, userRole, user: user?.email })
      router.push(`/${params.locale}/admin`)
    }
  }, [isInitialized, isStaff, router, params.locale, userRole, user])
  
  // 초기화가 완료되지 않았을 때 로딩 화면 표시
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  // 권한이 없을 때는 리다이렉트 중이므로 빈 화면 표시
  if (!isStaff) {
    return null
  }

  const {
    reservations,
    customers,
    products,
    channels,
    productOptions,
    optionChoices,
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
          .select('*, choices')
          .eq('id', reservationId)
          .single()

        if (error) {
          console.error('Failed to fetch reservation:', error)
          return
        }

        if (data) {
          // Minimal map to Reservation type; rely on list loader shape
          const mapped: Reservation = {
            id: data.id,
            customerId: data.customer_id || '',
            productId: data.product_id || '',
            tourDate: data.tour_date || '',
            tourTime: data.tour_time || '',
            eventNote: data.event_note || '',
            pickUpHotel: data.pickup_hotel || '',
            pickUpTime: data.pickup_time || '',
            adults: data.adults || 0,
            child: data.child || 0,
            infant: data.infant || 0,
            totalPeople: data.total_people || 0,
            channelId: data.channel_id || '',
            channelRN: data.channel_rn || '',
            addedBy: data.added_by || '',
            addedTime: data.created_at || '',
            tourId: data.tour_id || '',
            status: (data.status as Reservation['status']) || 'pending',
            selectedOptions: (typeof data.selected_options === 'string'
              ? (() => { try { return JSON.parse(data.selected_options as unknown as string) } catch { return {} } })()
              : (data.selected_options as { [optionId: string]: string[] }) || {}),
            selectedOptionPrices: (typeof data.selected_option_prices === 'string'
              ? (() => { try { return JSON.parse(data.selected_option_prices as unknown as string) } catch { return {} } })()
              : (data.selected_option_prices as { [key: string]: number }) || {}),
            choices: (typeof data.choices === 'string'
              ? (() => { try { return JSON.parse(data.choices as unknown as string) } catch { return {} } })()
              : (data.choices as { [key: string]: unknown }) || {}),
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

  const handleSubmit = async (payload: Omit<Reservation, 'id'>) => {
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
        is_private_tour: payload.isPrivateTour || false
      }

      const { error } = await (supabase as unknown as Database)
        .from('reservations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(reservationData as any)
        .eq('id', reservation.id)

      if (error) {
        alert('예약 수정 중 오류: ' + (error as unknown as { message: string }).message)
        return
      }

      await refreshReservations()
      alert('예약이 수정되었습니다.')
      // 투어가 생성되었다면 투어 섹션도 새로고침
      if (tourCreated) {
        setTourCreated(false)
      }
    } catch (e) {
      console.error(e)
      alert('예약 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
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
  }

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
          customers={customers as Customer[]}
          products={products}
          channels={channels}
          productOptions={productOptions}
          optionChoices={optionChoices}
          options={options}
          pickupHotels={pickupHotels}
          coupons={coupons}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/${params?.locale || 'ko'}/admin/reservations`)}
          onRefreshCustomers={refreshCustomers}
          onDelete={handleDelete}
          layout="page"
        />
      </div>
    )
  }, [loading, loadingReservation, reservation, customers, products, channels, productOptions, optionChoices, options, pickupHotels, coupons])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {reservation && (
            <span className="text-sm text-gray-500">ID: {reservation.id}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push(`/${params?.locale || 'ko'}/admin/reservations`)}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            목록으로
          </button>
        </div>
      </div>
      {content}
    </div>
  )
}


