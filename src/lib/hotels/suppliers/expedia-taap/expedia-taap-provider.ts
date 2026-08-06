import { createDryRunSupplier } from '@/lib/hotels/suppliers/dry-run-supplier'
import type { HotelSupplier } from '@/lib/hotels/suppliers/types'
import type {
  AvailabilityParams,
  AvailabilityResult,
  CancelReservationParams,
  CancelResult,
  CreateReservationParams,
  HotelRateQuote,
  HotelSearchParams,
  HotelSearchResult,
  RateQueryParams,
  ReservationStatusResult,
  StatusParams,
  SupplierReservationResult,
} from '@/lib/hotels/types'

/**
 * Expedia TAAP supplier adapter (API-ready stub).
 *
 * Future live implementation should call Expedia TAAP REST endpoints only inside
 * this folder. HotelManager / core services must not import Expedia SDK types.
 *
 * Env (planned):
 * - HOTEL_EXPEDIA_TAAP_LIVE=1
 * - EXPEDIA_TAAP_API_KEY / EXPEDIA_TAAP_SECRET (via vault/env refs)
 * - EXPEDIA_TAAP_BASE_URL
 */
export function createExpediaTaapProvider(opts?: {
  live?: boolean
}): HotelSupplier {
  const live =
    opts?.live === true || process.env.HOTEL_EXPEDIA_TAAP_LIVE === '1'
  const dry = createDryRunSupplier('expedia_taap')

  if (!live) {
    return {
      ...dry,
      code: 'expedia_taap',
      async createReservation(
        params: CreateReservationParams
      ): Promise<SupplierReservationResult> {
        const result = await dry.createReservation(params)
        return {
          ...result,
          status: 'needs_manual',
          message:
            'Expedia TAAP live API not enabled. Set HOTEL_EXPEDIA_TAAP_LIVE=1 when credentials are ready.',
          needsManualIntervention: true,
        }
      },
    }
  }

  return {
    code: 'expedia_taap',

    async searchHotels(params: HotelSearchParams): Promise<HotelSearchResult[]> {
      // TODO: GET /properties or equivalent TAAP search
      throw new ExpediaTaapNotImplementedError('searchHotels', params)
    },

    async getRates(params: RateQueryParams): Promise<HotelRateQuote[]> {
      // TODO: TAAP availability/rates by property + dates
      throw new ExpediaTaapNotImplementedError('getRates', params)
    },

    async checkAvailability(params: AvailabilityParams): Promise<AvailabilityResult> {
      throw new ExpediaTaapNotImplementedError('checkAvailability', params)
    },

    async createReservation(
      params: CreateReservationParams
    ): Promise<SupplierReservationResult> {
      // TODO: TAAP booking create — return supplier confirmation number
      throw new ExpediaTaapNotImplementedError('createReservation', params)
    },

    async cancelReservation(params: CancelReservationParams): Promise<CancelResult> {
      throw new ExpediaTaapNotImplementedError('cancelReservation', params)
    },

    async getReservationStatus(params: StatusParams): Promise<ReservationStatusResult> {
      throw new ExpediaTaapNotImplementedError('getReservationStatus', params)
    },
  }
}

export class ExpediaTaapNotImplementedError extends Error {
  constructor(method: string, context?: unknown) {
    super(
      `Expedia TAAP provider: ${method} live path not implemented yet. ` +
        `Wire TAAP API inside suppliers/expedia-taap/. Context: ${JSON.stringify(context ?? {})}`
    )
    this.name = 'ExpediaTaapNotImplementedError'
  }
}
