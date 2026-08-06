import { createDryRunSupplier } from '@/lib/hotels/suppliers/dry-run-supplier'
import type { HotelSupplier } from '@/lib/hotels/suppliers/types'
import type {
  CreateReservationParams,
  SupplierReservationResult,
} from '@/lib/hotels/types'

/**
 * Hotelbeds supplier stub — implement API client here when credentials are ready.
 * Env: HOTEL_HOTELBEDS_LIVE=1, HOTELBEDS_API_KEY, HOTELBEDS_API_SECRET
 */
export function createHotelbedsProvider(opts?: { live?: boolean }): HotelSupplier {
  const live = opts?.live === true || process.env.HOTEL_HOTELBEDS_LIVE === '1'
  const dry = createDryRunSupplier('hotelbeds')

  if (!live) {
    return {
      ...dry,
      code: 'hotelbeds',
      async createReservation(
        params: CreateReservationParams
      ): Promise<SupplierReservationResult> {
        const result = await dry.createReservation(params)
        return {
          ...result,
          status: 'needs_manual',
          message: 'Hotelbeds live API not enabled.',
          needsManualIntervention: true,
        }
      },
    }
  }

  return {
    ...dry,
    code: 'hotelbeds',
    async createReservation(): Promise<SupplierReservationResult> {
      return {
        ok: false,
        status: 'failed',
        supplier: 'hotelbeds',
        message: 'Hotelbeds live API client not implemented yet',
      }
    },
  }
}
