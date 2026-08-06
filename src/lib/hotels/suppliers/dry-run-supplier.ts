import type {
  AvailabilityParams,
  AvailabilityResult,
  CancelReservationParams,
  CancelResult,
  CreateReservationParams,
  HotelRateQuote,
  HotelSearchParams,
  HotelSearchResult,
  HotelSupplierCode,
  RateQueryParams,
  ReservationStatusResult,
  StatusParams,
  SupplierReservationResult,
} from '@/lib/hotels/types'
import type { HotelSupplier } from '@/lib/hotels/suppliers/types'

/**
 * Safe default supplier used when live credentials are off or for unknown codes.
 */
export function createDryRunSupplier(code: HotelSupplierCode): HotelSupplier {
  return {
    code,

    async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]> {
      return [
        {
          supplier: code,
          supplierHotelId: `dryrun-${code}-demo`,
          name: `[Dry-run] Sample hotel (${code})`,
          city: params.city || 'Page',
          state: 'AZ',
          country: 'US',
          raw: { dryRun: true, params },
        },
      ]
    },

    async getRates(params: RateQueryParams): Promise<HotelRateQuote[]> {
      const nights = enumerateStayDates(params.checkIn, params.checkOut)
      return nights.map((stayDate) => ({
        supplier: code,
        supplierHotelId: params.supplierHotelId,
        supplierRoomId: 'dryrun-std',
        roomType: params.roomType || 'Standard Queen',
        bedType: 'Queen',
        capacity: params.guests || 2,
        stayDate,
        price: 129,
        currency: 'USD',
        cancellationPolicy: 'Free cancellation until 24h before check-in (dry-run)',
        raw: { dryRun: true },
      }))
    },

    async checkAvailability(params: AvailabilityParams): Promise<AvailabilityResult> {
      const quotes = await this.getRates(params)
      return {
        available: true,
        supplier: code,
        supplierHotelId: params.supplierHotelId,
        message: 'Dry-run availability (always available)',
        quotes,
      }
    },

    async createReservation(
      params: CreateReservationParams
    ): Promise<SupplierReservationResult> {
      return {
        ok: true,
        status: 'confirmed',
        supplier: code,
        confirmationNumber: `DRY-${code.toUpperCase()}-${Date.now()}`,
        totalCost: 129 * Math.max(1, nightsBetween(params.checkIn, params.checkOut)),
        currency: 'USD',
        message: 'Dry-run reservation — not sent to supplier',
        raw: { dryRun: true, params },
      }
    },

    async cancelReservation(params: CancelReservationParams): Promise<CancelResult> {
      return {
        ok: true,
        status: 'cancelled',
        message: `Dry-run cancel for ${params.confirmationNumber}`,
      }
    },

    async getReservationStatus(params: StatusParams): Promise<ReservationStatusResult> {
      return {
        status: 'confirmed',
        confirmationNumber: params.confirmationNumber,
        supplier: code,
        message: 'Dry-run status',
        raw: { dryRun: true },
      }
    },
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`)
  const b = new Date(`${checkOut}T00:00:00Z`)
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000)
  return Math.max(1, diff)
}

export function enumerateStayDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}
