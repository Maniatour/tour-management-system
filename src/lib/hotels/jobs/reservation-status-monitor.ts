import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import { updateReservationStatus } from '@/lib/hotels/services/reservation-service'
import type { HotelSupplierCode } from '@/lib/hotels/types'

/**
 * Poll supplier status for open reservations (pending / confirmed / needs_manual).
 */
export async function runReservationStatusMonitor(opts?: { limit?: number }) {
  const db = getHotelAdminClient()
  const { data: rows, error } = await db
    .from('hotel_reservations')
    .select('*')
    .in('status', ['pending', 'confirmed', 'needs_manual'])
    .not('supplier_confirmation_number', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(opts?.limit ?? 50)

  if (error) throw new Error(error.message)

  let updated = 0
  let skipped = 0
  const notes: string[] = []

  for (const row of rows || []) {
    const confirmation = row.supplier_confirmation_number as string | null
    if (!confirmation) {
      skipped += 1
      continue
    }
    try {
      const supplier = getHotelSupplier(row.supplier as HotelSupplierCode)
      const status = await supplier.getReservationStatus({
        confirmationNumber: confirmation,
      })
      if (status.status !== row.status) {
        await updateReservationStatus(row.reservation_id as string, status.status)
        updated += 1
        notes.push(`${confirmation}: ${row.status} → ${status.status}`)
      } else {
        skipped += 1
      }
    } catch (err) {
      notes.push(
        `${confirmation}: error ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  await db.from('hotel_automation_jobs').insert({
    job_type: 'reservation_status_monitor',
    status: 'succeeded',
    summary: { updated, skipped, notes },
    finished_at: new Date().toISOString(),
  })

  return { updated, skipped, notes }
}
