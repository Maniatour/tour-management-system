import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import {
  enrichHotelMetadata,
  upsertHotel,
  upsertRoom,
} from '@/lib/hotels/services/hotel-catalog-service'
import { persistRateQuotes } from '@/lib/hotels/services/rate-service'
import {
  applySupplierReservationResult,
  createReservationRecord,
  syncTourHotelBookingFromReservation,
} from '@/lib/hotels/services/reservation-service'
import { assignReservationToTour } from '@/lib/hotels/services/tour-hotel-assignment-service'
import type {
  CreateReservationParams,
  HotelSearchParams,
  HotelSupplierCode,
  RateQueryParams,
} from '@/lib/hotels/types'

/**
 * Core orchestration — depends only on HotelSupplier registry + services.
 * Never imports Wyndham Playwright or Expedia HTTP clients directly.
 */
export class HotelManager {
  async search(params: HotelSearchParams & { supplier: HotelSupplierCode }) {
    const supplier = getHotelSupplier(params.supplier)
    const results = await supplier.searchHotels(params)

    const cataloged = []
    for (const item of results) {
      const hotel = await upsertHotel({
        supplier: item.supplier,
        supplierHotelId: item.supplierHotelId,
        name: item.name,
        address: item.address,
        city: item.city,
        state: item.state,
        country: item.country,
      })
      cataloged.push({ search: item, hotel })
    }
    return cataloged
  }

  async compareRates(input: {
    supplier: HotelSupplierCode
    hotelId: string
    supplierHotelId: string
    checkIn: string
    checkOut: string
    rooms?: number | undefined
    guests?: number | undefined
    destination?: string | undefined
    /** Manual UI trigger: run live Wyndham/etc for this request */
    forceLive?: boolean | undefined
  }) {
    const supplier = getHotelSupplier(input.supplier, {
      forceLive: input.forceLive === true,
    })
    const params: RateQueryParams = {
      supplierHotelId: input.supplierHotelId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rooms: input.rooms,
      guests: input.guests,
      destination: input.destination,
    }
    const availability = await supplier.checkAvailability(params)
    let quotes = availability.quotes || []

    if (quotes.length === 0) {
      try {
        quotes = await supplier.getRates(params)
      } catch (error) {
        const message =
          availability.message ||
          (error instanceof Error ? error.message : 'Rate fetch failed')
        throw new Error(message)
      }
    }

    if (quotes.length === 0) {
      throw new Error(
        availability.message ||
          '요금을 가져오지 못했습니다. Wyndham 로그인·Live 설정·셀렉터를 확인하세요.'
      )
    }

    // Ensure rooms exist for quoted types
    for (const quote of quotes) {
      if (quote.roomType) {
        await upsertRoom({
          hotelId: input.hotelId,
          roomType: quote.roomType,
          bedType: quote.bedType,
          capacity: quote.capacity,
          supplierRoomId: quote.supplierRoomId,
        })
      }
    }

    const persisted = await persistRateQuotes({
      hotelId: input.hotelId,
      quotes,
    })

    return { availability, quotes, persisted }
  }

  async reserve(input: {
    supplier: HotelSupplierCode
    hotelId: string
    roomId?: string | undefined
    params: CreateReservationParams
    tourId?: string | undefined
    assignedDate?: string | undefined
    createdBy?: string | undefined
    linkTourHotelBookingId?: string | undefined
  }) {
    const record = await createReservationRecord({
      supplier: input.supplier,
      hotelId: input.hotelId,
      roomId: input.roomId,
      guestCount: input.params.guests,
      rooms: input.params.rooms,
      checkIn: input.params.checkIn,
      checkOut: input.params.checkOut,
      guestName: input.params.guestName,
      createdBy: input.createdBy,
      status: 'pending',
    })

    const supplier = getHotelSupplier(input.supplier)
    const result = await supplier.createReservation({
      ...input.params,
      hotelId: input.hotelId,
      roomId: input.roomId,
    })

    const updated = await applySupplierReservationResult(record.reservation_id, result)

    if (input.tourId && input.assignedDate) {
      await assignReservationToTour({
        tourId: input.tourId,
        reservationId: updated.reservation_id,
        assignedDate: input.assignedDate,
      })
    }

    if (input.linkTourHotelBookingId) {
      const { getHotelAdminClient } = await import('@/lib/hotels/hotel-db')
      const db = getHotelAdminClient()
      await db
        .from('tour_hotel_bookings')
        .update({
          hotel_reservation_id: updated.reservation_id,
          rn_number: updated.supplier_confirmation_number,
          total_price: updated.total_cost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.linkTourHotelBookingId)
    }

    await syncTourHotelBookingFromReservation(updated.reservation_id)
    return { reservation: updated, supplierResult: result }
  }

  async cancel(input: {
    supplier: HotelSupplierCode
    reservationId: string
    confirmationNumber: string
    reason?: string | undefined
  }) {
    const supplier = getHotelSupplier(input.supplier)
    const result = await supplier.cancelReservation({
      confirmationNumber: input.confirmationNumber,
      reason: input.reason,
    })
    const updated = await applySupplierReservationResult(input.reservationId, {
      ok: result.ok,
      status: result.status,
      supplier: input.supplier,
      message: result.message,
      artifactPath: result.artifactPath,
    })
    await syncTourHotelBookingFromReservation(updated.reservation_id)
    return { reservation: updated, cancelResult: result }
  }

  async enrichMetadata(hotelId: string) {
    return enrichHotelMetadata(hotelId)
  }
}

export const hotelManager = new HotelManager()
