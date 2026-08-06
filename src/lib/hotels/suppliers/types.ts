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

/**
 * Common contract for all hotel suppliers.
 * Core HotelManager depends only on this interface — never on Wyndham/Expedia/etc.
 */
export interface HotelSupplier {
  readonly code: HotelSupplierCode

  searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]>

  getRates(params: RateQueryParams): Promise<HotelRateQuote[]>

  checkAvailability(params: AvailabilityParams): Promise<AvailabilityResult>

  createReservation(
    params: CreateReservationParams
  ): Promise<SupplierReservationResult>

  cancelReservation(params: CancelReservationParams): Promise<CancelResult>

  getReservationStatus(params: StatusParams): Promise<ReservationStatusResult>
}

export type HotelSupplierFactoryOptions = {
  /** Force dry-run even if live credentials exist */
  dryRun?: boolean
  /** Force live supplier path for this request (e.g. manual rate check) */
  forceLive?: boolean
}
