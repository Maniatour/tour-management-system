import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import type { TourHotelAssignmentRow } from '@/lib/hotels/types'

export async function assignReservationToTour(input: {
  tourId: string
  reservationId: string
  assignedDate: string
}): Promise<TourHotelAssignmentRow> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('tour_hotel_assignments')
    .upsert(
      {
        tour_id: input.tourId,
        reservation_id: input.reservationId,
        assigned_date: input.assignedDate,
      },
      { onConflict: 'tour_id,reservation_id,assigned_date' }
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as TourHotelAssignmentRow
}

export async function listAssignmentsForTour(
  tourId: string
): Promise<TourHotelAssignmentRow[]> {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('tour_hotel_assignments')
    .select('*')
    .eq('tour_id', tourId)
    .order('assigned_date')
  if (error) throw new Error(error.message)
  return (data || []) as TourHotelAssignmentRow[]
}

export async function listRecentAssignments(limit = 50) {
  const db = getHotelAdminClient()
  const { data, error } = await db
    .from('tour_hotel_assignments')
    .select('*, hotel_reservations(*), tours(id, tour_date, product_id)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}
