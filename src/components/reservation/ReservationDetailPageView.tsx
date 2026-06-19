'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { updateReservation, type ReservationUpdatePayload } from '@/lib/reservationUpdate'
import ReservationForm from '@/components/reservation/ReservationForm'
import { useReservationData } from '@/hooks/useReservationData'
import type { Reservation, Customer, Channel, PickupHotel } from '@/types/reservation'
import { useAuth } from '@/contexts/AuthContext'
import { Printer } from 'lucide-react'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import { ReservationFormEmailSendButtons } from '@/components/reservation/ReservationFormEmailSendButtons'
import { ReservationFormSmsSendButton } from '@/components/reservation/ReservationFormSmsSendButton'
import { mapDbReservationRowsToReservations } from '@/lib/mapDbReservationRowsToReservations'

async function fetchReservationById(reservationId: string): Promise<Reservation | null> {
  const { data, error } = await supabase.from('reservations').select('*').eq('id', reservationId).single()
  if (error || !data) {
    if (error) console.error('Failed to fetch reservation:', error)
    return null
  }
  return mapDbReservationRowsToReservations([data as Record<string, unknown>], new Map(), new Map())[0]
}

export function ReservationDetailPageView({
  reservationId,
  modalLightLoad = false,
  onCancel,
}: {
  reservationId: string
  modalLightLoad?: boolean
  onCancel?: () => void
}) {
  const t = useTranslations('reservations')
  const locale = useLocale()
  const { user, userPosition } = useAuth()
  const isSuper = userPosition === 'super'

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
    refreshCustomers,
  } = useReservationData({
    disableReservationsAutoLoad: true,
    deferFormCatalogs: modalLightLoad,
  })

  const [loadingReservation, setLoadingReservation] = useState(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [tourCreated, setTourCreated] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [followUpFormPipelineRefresh, setFollowUpFormPipelineRefresh] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!reservationId) return
      const found = reservations.find((r) => r.id === reservationId)
      if (found) {
        setReservation(found)
        return
      }
      setLoadingReservation(true)
      try {
        const mapped = await fetchReservationById(reservationId)
        setReservation(mapped)
      } finally {
        setLoadingReservation(false)
      }
    }
    void load()
  }, [reservationId, reservations])

  const handleSubmit = useCallback(
    async (payload: Omit<Reservation, 'id'>) => {
      if (!reservation) return
      try {
        const fullPayload = {
          ...payload,
          pricingInfo: (payload as ReservationUpdatePayload).pricingInfo,
          customerLanguage: (payload as ReservationUpdatePayload).customerLanguage,
          variantKey: (payload as ReservationUpdatePayload).variantKey,
          selectedChoices: Array.isArray((payload as ReservationUpdatePayload).selectedChoices)
            ? (payload as ReservationUpdatePayload).selectedChoices
            : undefined,
          usResidentCount: (payload as ReservationUpdatePayload).usResidentCount,
          nonResidentCount: (payload as ReservationUpdatePayload).nonResidentCount,
          nonResidentWithPassCount: (payload as ReservationUpdatePayload).nonResidentWithPassCount,
          nonResidentUnder16Count: (payload as ReservationUpdatePayload).nonResidentUnder16Count,
        } as ReservationUpdatePayload
        const result = await updateReservation(reservation.id, fullPayload)
        if (!result.success) {
          alert(t('messages.reservationUpdateError') + (result.error ?? ''))
          return
        }

        await refreshReservations()
        const updated = await fetchReservationById(reservation.id)
        if (updated) setReservation(updated)

        alert(t('messages.reservationUpdated'))
        if (tourCreated) setTourCreated(false)
      } catch (e) {
        console.error(e)
        alert(t('messages.reservationUpdateError') + (e instanceof Error ? e.message : ''))
      }
    },
    [reservation, refreshReservations, tourCreated, t]
  )

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel()
  }, [onCancel])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(t('deleteConfirmSoft'))) return
      try {
        const { error } = await supabase.from('reservations').update({ status: 'deleted' }).eq('id', id)
        if (error) {
          alert('삭제 처리 실패: ' + error.message)
          return
        }
        await refreshReservations()
        alert('예약이 삭제됨 상태로 변경되었습니다.')
        handleCancel()
      } catch (e) {
        console.error(e)
        alert('삭제 처리 중 오류가 발생했습니다.')
      }
    },
    [t, refreshReservations, handleCancel]
  )

  const content = useMemo(() => {
    if (loading || loadingReservation) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      )
    }
    if (!reservation) {
      return (
        <div className="p-8 text-center">
          <p className="text-gray-600">예약을 찾을 수 없습니다.</p>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-col">
        <ReservationForm
          reservation={reservation}
          customers={(customers as Customer[]) || []}
          products={products || []}
          channels={(channels || []) as Channel[]}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={(pickupHotels || []) as PickupHotel[]}
          coupons={
            (coupons || []) as {
              id: string
              coupon_code: string
              discount_type: 'percentage' | 'fixed'
              [key: string]: unknown
            }[]
          }
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
          onRefreshCustomers={refreshCustomers}
          layout="page"
          allowPastDateEdit={isSuper || !!reservation}
          followUpPipelineSnapshotRefreshToken={followUpFormPipelineRefresh}
          titleAction={
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                title={t('print') || '영수증 인쇄'}
              >
                <Printer className="h-5 w-5" />
              </button>
              <div className="hidden h-6 w-px shrink-0 bg-gray-200 sm:block" aria-hidden />
              <ReservationFormEmailSendButtons
                reservation={reservation}
                customers={(customers as Customer[]) || []}
                sentBy={user?.email ?? null}
                uiLocale={locale === 'en' ? 'en' : 'ko'}
                onSendSuccess={() => setFollowUpFormPipelineRefresh((n) => n + 1)}
              />
              <ReservationFormSmsSendButton
                reservation={reservation}
                customers={(customers as Customer[]) || []}
                sentBy={user?.email ?? null}
                uiLocale={locale === 'en' ? 'en' : 'ko'}
                onSendSuccess={() => setFollowUpFormPipelineRefresh((n) => n + 1)}
              />
            </div>
          }
        />
      </div>
    )
  }, [
    loading,
    loadingReservation,
    reservation,
    customers,
    products,
    channels,
    productOptions,
    options,
    pickupHotels,
    coupons,
    handleSubmit,
    handleCancel,
    handleDelete,
    refreshCustomers,
    user?.email,
    locale,
    t,
    isSuper,
    followUpFormPipelineRefresh,
  ])

  return (
    <>
      {content}
      {reservation ? (
        <CustomerReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          reservationId={reservation.id}
        />
      ) : null}
    </>
  )
}
