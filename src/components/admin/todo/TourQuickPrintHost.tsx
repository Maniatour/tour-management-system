'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CustomerReceiptModal from '@/components/receipt/CustomerReceiptModal'
import TourEnvelopeModal, { type EnvelopeVariant } from '@/components/receipt/TourEnvelopeModal'
import TourPrintModal from '@/components/tour/modals/TourPrintModal'
import { useTourDetailData } from '@/hooks/useTourDetailData'
import { filterTicketBookingsExcludedFromMainUi } from '@/lib/ticketBookingSoftDelete'
import {
  buildPickupResolveContextFromTour,
  fetchPickupGroupPresetWithReps,
  normalizeGroupModeOverrides,
  normalizeGroupRepresentativeOverrides,
  type PickupGroupPresetWithReps,
} from '@/lib/pickupGroupPreset'
import { normalizeReservationIds } from '@/utils/tourUtils'

export type TourQuickPrintKind = 'tourInfo' | 'receipts' | 'tip' | 'balance'

export type TourQuickPrintRequest = {
  tourId: string
  kind: TourQuickPrintKind
} | null

type TourQuickPrintHostProps = {
  locale: string
  request: TourQuickPrintRequest
  onClose: () => void
}

type LocalTicketBooking = {
  id: string
  company?: string | null
  category?: string | null
  check_in_date?: string | null
  time?: string | null
  ea?: number | null
  reservation_id?: string | null
  rn_number?: string | null
  status?: string | null
}

type LocalTourHotelBooking = {
  id: string
  hotel?: string | null
  room_type?: string | null
  rooms?: number | null
  check_in_date?: string | null
  check_out_date?: string | null
  rn_number?: string | null
  booking_reference?: string | null
  reservation_name?: string | null
}

function aggregateTicketBookingsForPrint(ticketBookings: LocalTicketBooking[]): LocalTicketBooking[] {
  const companyMap = new Map<string, { company: string; totalEa: number; bookings: LocalTicketBooking[] }>()
  for (const booking of ticketBookings) {
    const company = booking.company || 'Unknown'
    const ea = booking.ea || 0
    if (!companyMap.has(company)) {
      companyMap.set(company, { company, totalEa: 0, bookings: [] })
    }
    const companyData = companyMap.get(company)!
    companyData.totalEa += ea
    companyData.bookings.push(booking)
  }
  return Array.from(companyMap.values()).map((companyData, index) => ({
    id: `aggregated-${companyData.company}-${index}`,
    company: companyData.company,
    ea: companyData.totalEa,
    bookingDetails: companyData.bookings.map((b) => ({
      check_in_date: b.check_in_date ?? null,
      time: b.time ?? null,
      ea: b.ea || 0,
      reservation_id: b.reservation_id ?? null,
      rn_number: b.rn_number ?? null,
    })),
  }))
}

export function TourQuickPrintHost({ locale, request, onClose }: TourQuickPrintHostProps) {
  const isKo = locale === 'ko'
  const tourId = request?.tourId ?? null

  const tourData = useTourDetailData({ tourId, modalLightLoad: true })

  const [activePickupPreset, setActivePickupPreset] = useState<PickupGroupPresetWithReps | null>(null)
  const [ticketBookings, setTicketBookings] = useState<LocalTicketBooking[]>([])
  const [tourHotelBookings, setTourHotelBookings] = useState<LocalTourHotelBooking[]>([])
  const [bookingsLoaded, setBookingsLoaded] = useState(false)
  const [bookingsLoading, setBookingsLoading] = useState(false)

  const [showTourPrintModal, setShowTourPrintModal] = useState(false)
  const [showBatchReceiptModal, setShowBatchReceiptModal] = useState(false)
  const [envelopeVariant, setEnvelopeVariant] = useState<EnvelopeVariant | null>(null)
  const [opened, setOpened] = useState(false)

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

  const loadBookings = useCallback(async () => {
    if (!tourData.tour?.id) return
    setBookingsLoading(true)
    try {
      const [ticketRes, hotelRes] = await Promise.all([
        supabase
          .from('ticket_bookings')
          .select('*')
          .eq('tour_id', tourData.tour.id)
          .order('check_in_date', { ascending: false }),
        supabase
          .from('tour_hotel_bookings')
          .select('*')
          .eq('tour_id', tourData.tour.id)
          .order('check_in_date', { ascending: false }),
      ])
      if (!ticketRes.error) {
        setTicketBookings(filterTicketBookingsExcludedFromMainUi(ticketRes.data || []))
      }
      if (!hotelRes.error) {
        setTourHotelBookings((hotelRes.data || []) as LocalTourHotelBooking[])
      }
      setBookingsLoaded(true)
    } catch (e) {
      console.error('TourQuickPrintHost bookings', e)
      setBookingsLoaded(true)
    } finally {
      setBookingsLoading(false)
    }
  }, [tourData.tour?.id])

  useEffect(() => {
    if (!request) {
      setOpened(false)
      setShowTourPrintModal(false)
      setShowBatchReceiptModal(false)
      setEnvelopeVariant(null)
      setBookingsLoaded(false)
      setTicketBookings([])
      setTourHotelBookings([])
      return
    }
    setOpened(false)
    setShowTourPrintModal(false)
    setShowBatchReceiptModal(false)
    setEnvelopeVariant(null)
    setBookingsLoaded(false)
    if (request.kind === 'tourInfo') {
      void loadBookings()
    }
  }, [request, loadBookings])

  const receiptReservationIds = useMemo(() => {
    const fromAssigned = (tourData.assignedReservations || []).map((r: { id: string }) => r.id).filter(Boolean)
    const fromTour = normalizeReservationIds(tourData.tour?.reservation_ids)
    return fromAssigned.length > 0 ? fromAssigned : fromTour
  }, [tourData.assignedReservations, tourData.tour?.reservation_ids])

  const tourReady = Boolean(tourData.tour?.id)
  const reservationsReady = !tourData.pageLoading

  useEffect(() => {
    if (!request || opened || !tourReady || !reservationsReady) return

    if (request.kind === 'receipts') {
      setShowBatchReceiptModal(true)
      setOpened(true)
      return
    }
    if (request.kind === 'tip') {
      setEnvelopeVariant('tip')
      setOpened(true)
      return
    }
    if (request.kind === 'balance') {
      setEnvelopeVariant('balance')
      setOpened(true)
      return
    }
    if (request.kind === 'tourInfo' && bookingsLoaded && !tourData.loadingStates.reservations) {
      setShowTourPrintModal(true)
      setOpened(true)
    }
  }, [
    request,
    opened,
    tourReady,
    reservationsReady,
    bookingsLoaded,
    tourData.loadingStates.reservations,
  ])

  const getVehicleName = (vehicleId: string) => {
    const vehicle = tourData.vehicles?.find((v: { id: string }) => v.id === vehicleId)
    if (!vehicle) return null
    const v = vehicle as { vehicle_type?: string; vehicle_number?: string }
    return [v.vehicle_type, v.vehicle_number].filter(Boolean).join(' ') || vehicleId
  }

  const filteredTicketBookings = useMemo(
    () => aggregateTicketBookingsForPrint(ticketBookings),
    [ticketBookings]
  )

  const handleCloseAll = () => {
    setShowTourPrintModal(false)
    setShowBatchReceiptModal(false)
    setEnvelopeVariant(null)
    onClose()
  }

  const waiting =
    Boolean(request) &&
    !opened &&
    (tourData.pageLoading ||
      (request?.kind === 'tourInfo' && (bookingsLoading || !bookingsLoaded || tourData.loadingStates.reservations)))

  if (!request) return null

  return (
    <>
      {waiting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-gray-700 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            {isKo ? '인쇄 준비 중…' : 'Preparing print…'}
          </div>
        </div>
      )}

      <CustomerReceiptModal
        isOpen={showBatchReceiptModal}
        onClose={handleCloseAll}
        reservationId={receiptReservationIds[0] || ''}
        reservationIds={receiptReservationIds}
      />

      <TourEnvelopeModal
        isOpen={envelopeVariant !== null}
        onClose={handleCloseAll}
        variant={envelopeVariant ?? 'tip'}
        reservationIds={receiptReservationIds}
        tourDate={tourData.tour?.tour_date || ''}
        productNameKo={tourData.product?.name_ko || tourData.product?.name_en || ''}
        productNameEn={tourData.product?.name_en || tourData.product?.name_ko || ''}
        guideAndAssistantKo={
          [
            tourData.selectedGuide ? tourData.getTeamMemberNameForLocale(tourData.selectedGuide, 'ko') : null,
            tourData.selectedAssistant
              ? tourData.getTeamMemberNameForLocale(tourData.selectedAssistant, 'ko')
              : null,
          ]
            .filter(Boolean)
            .join(' & ') || '—'
        }
        guideAndAssistantEn={
          [
            tourData.selectedGuide ? tourData.getTeamMemberNameForLocale(tourData.selectedGuide, 'en') : null,
            tourData.selectedAssistant
              ? tourData.getTeamMemberNameForLocale(tourData.selectedAssistant, 'en')
              : null,
          ]
            .filter(Boolean)
            .join(' & ') || '—'
        }
        locale={locale}
      />

      <TourPrintModal
        isOpen={showTourPrintModal}
        onClose={handleCloseAll}
        locale={locale}
        tourDate={tourData.tour?.tour_date || ''}
        productNameKo={tourData.product?.name_ko || tourData.product?.name_en || ''}
        productNameEn={tourData.product?.name_en || tourData.product?.name_ko || ''}
        guideName={tourData.selectedGuide ? tourData.getTeamMemberName(tourData.selectedGuide) : null}
        teamType={tourData.teamType}
        secondMemberName={
          tourData.selectedAssistant ? tourData.getTeamMemberName(tourData.selectedAssistant) : null
        }
        vehicleLabel={tourData.selectedVehicleId ? getVehicleName(tourData.selectedVehicleId) : null}
        assignedReservations={tourData.assignedReservations}
        pickupHotels={tourData.pickupHotels}
        useRepresentativePickup={
          pickupResolveContext.useRepresentativePickup === true || !!pickupResolveContext.preset
        }
        pickupResolveContext={pickupResolveContext}
        getCustomerName={(customerId: string) => tourData.getCustomerName(customerId) || ''}
        ticketBookings={filteredTicketBookings}
        tourHotelBookings={tourHotelBookings}
      />
    </>
  )
}
