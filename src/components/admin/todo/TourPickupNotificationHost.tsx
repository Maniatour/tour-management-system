'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { useTourDetailData } from '@/hooks/useTourDetailData'
import {
  buildPickupResolveContextFromTour,
  fetchPickupGroupPresetWithReps,
  normalizeGroupModeOverrides,
  normalizeGroupRepresentativeOverrides,
  type PickupGroupPresetWithReps,
} from '@/lib/pickupGroupPreset'

const PickupScheduleAutoGenerateModal = dynamic(
  () => import('@/components/tour/modals/PickupScheduleAutoGenerateModal'),
  { ssr: false }
)

const PickupScheduleEmailPreviewModal = dynamic(
  () => import('@/components/tour/modals/PickupScheduleEmailPreviewModal'),
  { ssr: false }
)

export type TourPickupNotificationKind = 'autoGenerate' | 'email'

export type TourPickupNotificationRequest = {
  tourId: string
  kind: TourPickupNotificationKind
} | null

type TourPickupNotificationHostProps = {
  locale: string
  request: TourPickupNotificationRequest
  onClose: () => void
}

export function TourPickupNotificationHost({ locale, request, onClose }: TourPickupNotificationHostProps) {
  const t = useTranslations('tours.pickupSchedule')
  const isKo = locale === 'ko'
  const tourId = request?.tourId ?? null
  const kind = request?.kind ?? null

  const tourData = useTourDetailData({ tourId, modalLightLoad: true })
  const [activePickupPreset, setActivePickupPreset] = useState<PickupGroupPresetWithReps | null>(null)
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [opened, setOpened] = useState(false)
  const [sawLoading, setSawLoading] = useState(false)

  useEffect(() => {
    const presetId = tourData.tour?.pickup_group_preset_id ?? null
    if (!presetId) {
      setActivePickupPreset(null)
      return
    }
    void fetchPickupGroupPresetWithReps(supabase, presetId).then(setActivePickupPreset)
  }, [tourData.tour?.pickup_group_preset_id])

  const pickupResolveContext = useMemo(
    () =>
      buildPickupResolveContextFromTour(
        {
          use_representative_pickup: tourData.tour?.use_representative_pickup ?? null,
          pickup_group_preset_id: tourData.tour?.pickup_group_preset_id ?? null,
          pickup_group_mode_overrides: normalizeGroupModeOverrides(tourData.tour?.pickup_group_mode_overrides),
          pickup_group_representative_overrides: normalizeGroupRepresentativeOverrides(
            tourData.tour?.pickup_group_representative_overrides
          ),
        },
        activePickupPreset
      ),
    [tourData.tour, activePickupPreset]
  )

  useEffect(() => {
    if (!request) {
      setOpened(false)
      setShowAutoGenerateModal(false)
      setShowEmailModal(false)
      setSawLoading(false)
      return
    }
    setOpened(false)
    setShowAutoGenerateModal(false)
    setShowEmailModal(false)
    setSawLoading(false)
  }, [request])

  useEffect(() => {
    if (!request) return
    if (tourData.pageLoading) {
      setSawLoading(true)
    }
  }, [request, tourData.pageLoading])

  const requestTourId = request?.tourId ?? null
  const tourMatchesRequest = Boolean(
    requestTourId && tourData.tour?.id && tourData.tour.id === requestTourId
  )

  useEffect(() => {
    if (!request || opened || tourData.pageLoading) return
    if (!tourMatchesRequest) {
      if (!sawLoading) return
      alert(isKo ? '투어 정보를 불러올 수 없습니다.' : 'Could not load tour.')
      onClose()
      return
    }

    if (request.kind === 'autoGenerate') {
      setShowAutoGenerateModal(true)
      setOpened(true)
      return
    }
    if (request.kind === 'email') {
      setShowEmailModal(true)
      setOpened(true)
    }
  }, [request, opened, tourData.pageLoading, tourMatchesRequest, sawLoading, isKo, onClose])

  const waiting = Boolean(request) && !opened && (!sawLoading || tourData.pageLoading)

  const handleClose = useCallback(() => {
    setShowAutoGenerateModal(false)
    setShowEmailModal(false)
    onClose()
  }, [onClose])

  const handleSavePickupSchedule = useCallback(
    async (pickupTimes: Record<string, string>) => {
      const updates = Object.entries(pickupTimes).map(([reservationId, pickupTime]) => ({
        id: reservationId,
        pickup_time: pickupTime,
      }))

      for (const update of updates) {
        const { error } = await supabase
          .from('reservations')
          .update({ pickup_time: update.pickup_time })
          .eq('id', update.id)
        if (error) throw error
      }

      if (tourData.refreshReservations) {
        await tourData.refreshReservations()
      }
    },
    [tourData]
  )

  const handleBatchSendPickupScheduleNotifications = useCallback(async () => {
    const reservationsWithPickupTime = tourData.assignedReservations.filter(
      (res: { pickup_time?: string | null }) => res.pickup_time && res.pickup_time.trim() !== ''
    )

    if (reservationsWithPickupTime.length === 0) {
      alert(isKo ? '픽업 시간이 설정된 예약이 없습니다.' : 'No reservations with pickup times.')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const sentBy = user?.email || null

    let successCount = 0
    let failCount = 0

    for (const reservation of reservationsWithPickupTime) {
      try {
        const tourDate =
          (reservation as { tour_date?: string | null }).tour_date || tourData.tour?.tour_date
        if (!tourDate) {
          failCount++
          continue
        }

        const response = await fetchApiWithAuth('/api/send-pickup-schedule-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: reservation.id,
            pickupTime:
              reservation.pickup_time && reservation.pickup_time.includes(':')
                ? reservation.pickup_time
                : reservation.pickup_time
                  ? `${reservation.pickup_time}:00`
                  : '',
            tourDate,
            sentBy,
          }),
        })

        if (!response.ok) failCount++
        else successCount++
      } catch (error) {
        console.error(`Pickup notification send failed for ${reservation.id}`, error)
        failCount++
      }
    }

    if (successCount > 0) {
      alert(
        t('notificationSent', { count: successCount }) +
          (failCount > 0 ? t('notificationSentPartial', { failed: failCount }) : '')
      )
      if (tourData.refreshReservations) {
        await tourData.refreshReservations()
      }
    } else {
      alert(t('notificationSendFailed'))
    }
  }, [isKo, t, tourData])

  if (!request) return null

  if (waiting) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
        <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-gray-600 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isKo ? '투어 정보 불러오는 중…' : 'Loading tour…'}
        </div>
      </div>
    )
  }

  if (!tourData.tour || !tourMatchesRequest) {
    return null
  }

  return (
    <>
      {kind === 'autoGenerate' && (
        <PickupScheduleAutoGenerateModal
          isOpen={showAutoGenerateModal}
          tourDate={tourData.tour.tour_date}
          productId={tourData.tour.product_id ?? tourData.product?.id ?? null}
          assignedReservations={tourData.assignedReservations}
          pickupHotels={tourData.pickupHotels as never[]}
          onClose={handleClose}
          onSave={handleSavePickupSchedule}
          getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || 'Unknown'}
          useRepresentativePickup={
            !!tourData.tour.pickup_group_preset_id || tourData.tour.use_representative_pickup === true
          }
          pickupResolveContext={pickupResolveContext}
        />
      )}

      {kind === 'email' && (
        <PickupScheduleEmailPreviewModal
          isOpen={showEmailModal}
          onClose={handleClose}
          reservations={tourData.assignedReservations.map((res: { id: string; customer_id: string | null; pickup_time: string | null; tour_date?: string | null }) => ({
            id: res.id,
            customer_id: res.customer_id,
            pickup_time: res.pickup_time,
            tour_date: res.tour_date ?? tourData.tour?.tour_date ?? null,
          }))}
          tourDate={tourData.tour.tour_date}
          tourId={tourData.tour.id}
          onSend={handleBatchSendPickupScheduleNotifications}
        />
      )}
    </>
  )
}
