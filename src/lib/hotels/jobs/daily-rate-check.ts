import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import { hotelManager } from '@/lib/hotels/hotel-manager'
import type { HotelSupplierCode } from '@/lib/hotels/types'

export type DailyRateCheckOptions = {
  /** How many days ahead to check from today */
  daysAhead?: number
  suppliers?: HotelSupplierCode[]
  hotelIds?: string[]
}

/**
 * Daily hotel price checking job.
 * Loads active catalog hotels and refreshes rates via each hotel's supplier adapter.
 */
export async function runDailyHotelRateCheck(opts: DailyRateCheckOptions = {}) {
  const db = getHotelAdminClient()
  const daysAhead = opts.daysAhead ?? 30
  const job = await startJob('daily_rate_check')

  try {
    let q = db.from('hotels').select('*').eq('is_active', true)
    if (opts.hotelIds?.length) q = q.in('hotel_id', opts.hotelIds)
    if (opts.suppliers?.length) q = q.in('supplier', opts.suppliers)

    const { data: hotels, error } = await q
    if (error) throw new Error(error.message)

    const today = new Date()
    const checkIn = today.toISOString().slice(0, 10)
    const checkOutDate = new Date(today)
    checkOutDate.setUTCDate(checkOutDate.getUTCDate() + Math.min(daysAhead, 2))
    const checkOut = checkOutDate.toISOString().slice(0, 10)

    const alerts: string[] = []
    let checked = 0
    let failures = 0

    for (const hotel of hotels || []) {
      try {
        const result = await hotelManager.compareRates({
          supplier: hotel.supplier as HotelSupplierCode,
          hotelId: hotel.hotel_id as string,
          supplierHotelId: hotel.supplier_hotel_id as string,
          checkIn,
          checkOut,
          rooms: 1,
          guests: 2,
        })
        checked += 1
        for (const alert of result.persisted.alerts) {
          alerts.push(alert.message)
          console.info('[hotel-rate-check]', alert.message)
        }
      } catch (err) {
        failures += 1
        console.error(
          '[hotel-rate-check] failed for',
          hotel.hotel_id,
          err instanceof Error ? err.message : err
        )
      }
    }

    await finishJob(job.id, failures > 0 && checked > 0 ? 'partial' : failures ? 'failed' : 'succeeded', {
      checked,
      failures,
      alerts,
      checkIn,
      checkOut,
    })

    return { checked, failures, alerts }
  } catch (error) {
    await finishJob(
      job.id,
      'failed',
      {},
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }
}

async function startJob(jobType: string) {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_automation_jobs')
    .insert({ job_type: jobType, status: 'running' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

async function finishJob(
  id: string,
  status: 'succeeded' | 'failed' | 'partial',
  summary: Record<string, unknown>,
  errorMessage?: string
) {
  const db = getHotelAdminClient()
  await db
    .from('hotel_automation_jobs')
    .update({
      status,
      summary,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
}
