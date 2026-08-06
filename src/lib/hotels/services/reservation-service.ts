import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import type {
  HotelReservationRow,
  HotelReservationStatus,
  HotelSupplierCode,
  SupplierReservationResult,
} from '@/lib/hotels/types'

export async function listReservations(opts?: {
  status?: HotelReservationStatus | undefined
  supplier?: HotelSupplierCode | undefined
  limit?: number | undefined
}): Promise<HotelReservationRow[]> {
  const db = getHotelAdminClient()
  let q = db
    .from('hotel_reservations')
    .select('*')
    .order('check_in', { ascending: true })
    .limit(opts?.limit ?? 100)
  if (opts?.status) q = q.eq('status', opts.status)
  if (opts?.supplier) q = q.eq('supplier', opts.supplier)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []) as HotelReservationRow[]
}

export async function createReservationRecord(input: {
  supplier: HotelSupplierCode
  hotelId: string
  roomId?: string | null | undefined
  guestCount: number
  rooms?: number | undefined
  checkIn: string
  checkOut: string
  guestName?: string | undefined
  createdBy?: string | undefined
  status?: HotelReservationStatus | undefined
}): Promise<HotelReservationRow> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_reservations')
    .insert({
      supplier: input.supplier,
      hotel_id: input.hotelId,
      room_id: input.roomId ?? null,
      guest_count: input.guestCount,
      rooms: input.rooms ?? 1,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guest_name: input.guestName ?? null,
      created_by: input.createdBy ?? null,
      status: input.status ?? 'pending',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HotelReservationRow
}

export async function applySupplierReservationResult(
  reservationId: string,
  result: SupplierReservationResult
): Promise<HotelReservationRow> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_reservations')
    .update({
      status: result.status,
      supplier_confirmation_number: result.confirmationNumber ?? null,
      total_cost: result.totalCost ?? null,
      currency: result.currency ?? 'USD',
      automation_artifact_path: result.artifactPath ?? null,
      supplier_payload: result.raw ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('reservation_id', reservationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HotelReservationRow
}

export async function updateReservationStatus(
  reservationId: string,
  status: HotelReservationStatus,
  extra?: Partial<{
    supplier_confirmation_number: string
    total_cost: number
    automation_artifact_path: string
  }>
): Promise<HotelReservationRow> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('hotel_reservations')
    .update({
      status,
      ...extra,
      updated_at: new Date().toISOString(),
    })
    .eq('reservation_id', reservationId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as HotelReservationRow
}

/**
 * Sync confirmation + cost into the existing tour_hotel_bookings ops ledger when linked.
 */
export async function syncTourHotelBookingFromReservation(
  reservationId: string
): Promise<void> {
  const db = getHotelAdminClient()
  const { data: reservation, error } = await db
    .from('hotel_reservations')
    .select('*')
    .eq('reservation_id', reservationId)
    .single()
  if (error || !reservation) return

  await db
    .from('tour_hotel_bookings')
    .update({
      rn_number: reservation.supplier_confirmation_number,
      total_price: reservation.total_cost,
      status:
        reservation.status === 'confirmed'
          ? 'confirmed'
          : reservation.status === 'cancelled'
            ? 'cancelled'
            : reservation.status,
      updated_at: new Date().toISOString(),
    })
    .eq('hotel_reservation_id', reservationId)
}
