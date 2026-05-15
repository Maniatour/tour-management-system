import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeReservationIds(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter((v) => v.length > 0)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed)
          ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
          : []
      } catch {
        return []
      }
    }
    if (trimmed.includes(',')) return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

type ReservationTourLookup = {
  tour_id?: string | null
  product_id?: string | null
}

export async function resolveTourIdForReservation(
  db: SupabaseClient,
  reservationId: string,
  reservation: ReservationTourLookup,
  tourDate?: string | null,
  explicitTourId?: string | null
): Promise<string | null> {
  const normalizedReservationId = String(reservationId).trim()

  if (explicitTourId) {
    const { data: tourDataById } = await db
      .from('tours')
      .select('id, reservation_ids')
      .eq('id', explicitTourId)
      .maybeSingle()
    if (tourDataById?.id) return tourDataById.id
  }

  if (reservation.tour_id) {
    const { data: tourDataById } = await db
      .from('tours')
      .select('id, reservation_ids')
      .eq('id', reservation.tour_id)
      .maybeSingle()
    if (tourDataById?.id) {
      const reservationIds = normalizeReservationIds((tourDataById as { reservation_ids?: unknown }).reservation_ids)
      if (reservationIds.includes(normalizedReservationId)) {
        return tourDataById.id
      }
    }
  }

  if (!reservation.product_id || !tourDate) return null

  const { data: toursByProduct } = await db
    .from('tours')
    .select('id, reservation_ids')
    .eq('product_id', reservation.product_id)
    .eq('tour_date', tourDate)

  for (const tour of toursByProduct ?? []) {
    const reservationIds = normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)
    if (reservationIds.includes(normalizedReservationId)) {
      return tour.id
    }
  }

  return null
}

export async function resolveChatRoomCodeForTour(
  db: SupabaseClient,
  tourId: string
): Promise<string | null> {
  const { data: chatRoomData } = await db
    .from('chat_rooms')
    .select('room_code')
    .eq('tour_id', tourId)
    .eq('is_active', true)
    .maybeSingle()

  return chatRoomData?.room_code?.trim() || null
}

export async function resolveChatRoomCodeForReservation(
  db: SupabaseClient,
  reservationId: string,
  reservation: ReservationTourLookup & { tour_date?: string | null },
  options?: { tourDate?: string | null; tourId?: string | null }
): Promise<{ tourId: string | null; chatRoomCode: string | null }> {
  const tourDate = options?.tourDate ?? reservation.tour_date ?? null
  const tourId = await resolveTourIdForReservation(
    db,
    reservationId,
    reservation,
    tourDate,
    options?.tourId ?? null
  )
  if (!tourId) return { tourId: null, chatRoomCode: null }
  const chatRoomCode = await resolveChatRoomCodeForTour(db, tourId)
  return { tourId, chatRoomCode }
}
