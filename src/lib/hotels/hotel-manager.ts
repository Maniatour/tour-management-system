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
import { pickQuotesForHotel } from '@/lib/hotels/suppliers/wyndham/match-hotel'
import type {
  CreateReservationParams,
  HotelRateQuote,
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

    // Call getRates once — Wyndham checkAvailability also scrapes via getRates,
    // so the old checkAvailability→getRates fallback ran Playwright twice (or hung twice).
    let allQuotes: HotelRateQuote[]
    try {
      allQuotes = await supplier.getRates(params)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Rate fetch failed'
      throw new Error(message)
    }

    // SRP returns every hotel in the city — keep only this catalog hotel's property
    const quotes = pickQuotesForHotel(
      {
        name: input.supplierHotelId,
        supplierHotelId: input.supplierHotelId,
      },
      allQuotes
    )

    if (quotes.length === 0) {
      throw new Error(
        `"${input.supplierHotelId}"에 맞는 요금을 결과에서 찾지 못했습니다. 호텔명/목적지(Page·Kanab)를 확인하세요.`
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

    return {
      availability: {
        available: quotes.some((q) => q.price > 0),
        supplier: input.supplier,
        supplierHotelId: input.supplierHotelId,
        quotes,
      },
      quotes,
      persisted,
    }
  }

  /**
   * Fetch rates for many catalog hotels with one scrape per destination (Page / Kanab).
   * Typical ops set: Wingate + Days Inn Page + La Quinta Kanab + Days Inn Kanab.
   */
  async compareRatesBatch(input: {
    checkIn: string
    checkOut: string
    forceLive?: boolean | undefined
    hotels: Array<{
      hotelId: string
      supplier: HotelSupplierCode
      supplierHotelId: string
      name: string
      city?: string | null
      state?: string | null
    }>
  }) {
    if (!input.hotels.length) {
      throw new Error('호텔 목록이 비어 있습니다.')
    }

    type BatchHotel = (typeof input.hotels)[number]
    const groups = new Map<string, BatchHotel[]>()
    for (const hotel of input.hotels) {
      const key =
        [hotel.city, hotel.state].filter(Boolean).join(' ').trim().toLowerCase() ||
        'unknown'
      const list = groups.get(key) || []
      list.push(hotel)
      groups.set(key, list)
    }

    const results: Array<{
      hotelId: string
      name: string
      ok: boolean
      price?: number
      roomType?: string
      error?: string
      saved?: number
    }> = []

    for (const [destinationKey, group] of groups) {
      const destination =
        [group[0]?.city, group[0]?.state].filter(Boolean).join(' ').trim() ||
        group[0]?.name ||
        destinationKey

      const supplierCode = group[0]?.supplier || 'wyndham'
      const supplier = getHotelSupplier(supplierCode, {
        forceLive: input.forceLive === true || supplierCode === 'wyndham',
      })

      let allQuotes: HotelRateQuote[] = []
      try {
        allQuotes = await supplier.getRates({
          supplierHotelId: `batch:${destination}`,
          destination,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: 1,
          guests: 2,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rate fetch failed'
        for (const hotel of group) {
          results.push({
            hotelId: hotel.hotelId,
            name: hotel.name,
            ok: false,
            error: message,
          })
        }
        continue
      }

      for (const hotel of group) {
        try {
          const quotes = pickQuotesForHotel(
            { name: hotel.name, supplierHotelId: hotel.supplierHotelId },
            allQuotes
          )
          if (quotes.length === 0) {
            results.push({
              hotelId: hotel.hotelId,
              name: hotel.name,
              ok: false,
              error: '검색 결과에서 해당 호텔을 찾지 못했습니다.',
            })
            continue
          }

          for (const quote of quotes) {
            if (quote.roomType) {
              await upsertRoom({
                hotelId: hotel.hotelId,
                roomType: quote.roomType,
                bedType: quote.bedType,
                capacity: quote.capacity,
                supplierRoomId: quote.supplierRoomId,
              })
            }
          }

          const persisted = await persistRateQuotes({
            hotelId: hotel.hotelId,
            quotes,
          })

          const sample = quotes[0]
          results.push({
            hotelId: hotel.hotelId,
            name: hotel.name,
            ok: true,
            price: sample?.price,
            roomType: sample?.roomType,
            saved: persisted.saved,
          })
        } catch (error) {
          results.push({
            hotelId: hotel.hotelId,
            name: hotel.name,
            ok: false,
            error: error instanceof Error ? error.message : '저장 실패',
          })
        }
      }
    }

    const okCount = results.filter((r) => r.ok).length
    return {
      success: okCount > 0,
      okCount,
      total: results.length,
      destinations: groups.size,
      results,
    }
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
