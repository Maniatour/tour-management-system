'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useReservationData } from '@/hooks/useReservationData'
import type { Reservation, Customer } from '@/types/reservation'
import { FileText, Mail, Printer } from 'lucide-react'

export default function ReservationDetailsPage() {
  const t = useTranslations('reservations')
  const router = useRouter()
  const params = useParams() as { locale?: string; id?: string }

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
  const [previewDoc, setPreviewDoc] = useState<null | 'confirmation' | 'pickup' | 'receipt'>(null)
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
          {reservation && (
            <>
              <button
                onClick={() => setPreviewDoc('confirmation')}
                className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                title="Reservation Confirmation 미리보기"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDoc('pickup')}
                className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                title="Pick up Notification 미리보기"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewDoc('receipt')}
                className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                title="Reservation Receipt 미리보기"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const customer = (customers as Customer[]).find(c => c.id === reservation.customerId)
                  const to = customer?.email || ''
                  const origin = typeof window !== 'undefined' ? window.location.origin : ''
                  const confirmUrl = `${origin}/${params?.locale || 'ko'}/admin/reservations/${reservation.id}/documents/confirmation`
                  const subject = `[Reservation Confirmation] ${reservation.id}`
                  const body = `Dear ${customer?.name || ''},%0D%0A%0D%0APlease review your reservation confirmation here:%0D%0A${confirmUrl}%0D%0A%0D%0AThank you.`
                  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${body}`
                }}
                className="p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                title="이메일 보내기"
              >
                <Mail className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => router.push(`/${params?.locale || 'ko'}/admin/reservations`)}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            목록으로
          </button>
        </div>
      </div>
      {content}

      {/* 문서 미리보기 모달 */}
      {previewDoc && reservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-[95vw] sm:max-w-[90vw] h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-medium text-gray-700">
                {previewDoc === 'confirmation' && 'Reservation Confirmation 미리보기'}
                {previewDoc === 'pickup' && 'Pick up Notification 미리보기'}
                {previewDoc === 'receipt' && 'Reservation Receipt 미리보기'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const base = `/${params?.locale || 'ko'}/admin/reservations/${reservation.id}/documents/${previewDoc}`
                    window.open(base, '_blank')
                  }}
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                >새 창</button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                >닫기</button>
              </div>
            </div>
            <div className="flex-1">
              <iframe
                title="document-preview"
                src={`/${params?.locale || 'ko'}/admin/reservations/${reservation.id}/documents/${previewDoc}?mode=embed`}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


