import { createDryRunSupplier } from '@/lib/hotels/suppliers/dry-run-supplier'
import { createExpediaTaapProvider } from '@/lib/hotels/suppliers/expedia-taap'
import { createHotelbedsProvider } from '@/lib/hotels/suppliers/hotelbeds/hotelbeds-provider'
import type { HotelSupplier, HotelSupplierFactoryOptions } from '@/lib/hotels/suppliers/types'
import { createWyndhamProvider } from '@/lib/hotels/suppliers/wyndham/wyndham-provider'
import type { HotelSupplierCode } from '@/lib/hotels/types'

/**
 * Resolve a hotel supplier adapter.
 * Core code must call this instead of importing Wyndham/Expedia directly.
 *
 * Live flags:
 * - HOTEL_WYNDHAM_LIVE=1
 * - HOTEL_EXPEDIA_TAAP_LIVE=1
 * - HOTEL_HOTELBEDS_LIVE=1
 */
export function getHotelSupplier(
  code: HotelSupplierCode,
  opts?: HotelSupplierFactoryOptions
): HotelSupplier {
  if (opts?.dryRun || code === 'manual') {
    return createDryRunSupplier(code === 'manual' ? 'manual' : code)
  }

  switch (code) {
    case 'wyndham':
      return createWyndhamProvider(
        opts?.forceLive === true ? { live: true } : undefined
      )
    case 'expedia_taap':
      return createExpediaTaapProvider(
        opts?.forceLive === true ? { live: true } : undefined
      )
    case 'hotelbeds':
      return createHotelbedsProvider(
        opts?.forceLive === true ? { live: true } : undefined
      )
    default:
      return createDryRunSupplier(code)
  }
}

export function listHotelSupplierCodes(): HotelSupplierCode[] {
  return ['wyndham', 'expedia_taap', 'hotelbeds', 'manual']
}
