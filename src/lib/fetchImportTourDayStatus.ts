import { supabase, isAbortLikeError } from '@/lib/supabase'
import { getReservationPartySize } from '@/utils/reservationUtils'
import { normalizeReservationIds } from '@/utils/tourUtils'
import {
  buildImportTourDayStatusSummary,
  importTourDayStatusKey,
  parseImportTourDate,
  type ImportTourDayReservationInput,
  type ImportTourDayStaffRow,
  type ImportTourDayStatusLookupKey,
  type ImportTourDayStatusSummary,
  type ImportTourDayTourInput,
} from '@/lib/importTourDayStatus'

const IN_CHUNK = 200

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function uniqueKeys(keys: ImportTourDayStatusLookupKey[]): ImportTourDayStatusLookupKey[] {
  const seen = new Set<string>()
  const out: ImportTourDayStatusLookupKey[] = []
  for (const key of keys) {
    const productId = String(key.productId || '').trim()
    const tourDate = parseImportTourDate(key.tourDate)
    if (!productId || !tourDate) continue
    const mapKey = importTourDayStatusKey(productId, tourDate)
    if (seen.has(mapKey)) continue
    seen.add(mapKey)
    out.push({ productId, tourDate })
  }
  return out
}

export async function fetchImportTourDayStatusMap(
  keys: ImportTourDayStatusLookupKey[]
): Promise<Map<string, ImportTourDayStatusSummary>> {
  const result = new Map<string, ImportTourDayStatusSummary>()
  const unique = uniqueKeys(keys)
  if (unique.length === 0) return result

  const productIds = [...new Set(unique.map((k) => k.productId))]
  const tourDates = [...new Set(unique.map((k) => k.tourDate))]
  const wanted = new Set(unique.map((k) => importTourDayStatusKey(k.productId, k.tourDate)))

  const tours: ImportTourDayTourInput[] = []
  for (const productChunk of chunkArray(productIds, IN_CHUNK)) {
    for (const dateChunk of chunkArray(tourDates, IN_CHUNK)) {
      const { data, error } = await supabase
        .from('tours')
        .select(
          'id, tour_date, product_id, tour_status, tour_guide_id, assistant_id, tour_car_id, reservation_ids, max_participants, created_at'
        )
        .in('product_id', productChunk)
        .in('tour_date', dateChunk)
        .order('created_at', { ascending: true })
      if (error) {
        if (isAbortLikeError(error)) return result
        throw error
      }
      for (const row of data || []) {
        const tour = row as ImportTourDayTourInput
        const pairKey = importTourDayStatusKey(String(tour.product_id || ''), parseImportTourDate(tour.tour_date))
        if (!wanted.has(pairKey)) continue
        tours.push(tour)
      }
    }
  }

  const staffEmails = new Set<string>()
  const vehicleIds = new Set<string>()
  const reservationIds = new Set<string>()
  for (const tour of tours) {
    if (tour.tour_guide_id?.trim()) staffEmails.add(tour.tour_guide_id.trim())
    if (tour.assistant_id?.trim()) staffEmails.add(tour.assistant_id.trim())
    if (tour.tour_car_id?.trim()) vehicleIds.add(tour.tour_car_id.trim())
    for (const id of normalizeReservationIds(tour.reservation_ids)) reservationIds.add(id)
  }

  const staffByEmail = new Map<string, ImportTourDayStaffRow>()
  const emailList = [...staffEmails]
  for (const chunk of chunkArray(emailList, IN_CHUNK)) {
    const { data, error } = await supabase
      .from('team')
      .select('email, nick_name, name_ko, name_en')
      .in('email', chunk)
    if (error) {
      if (isAbortLikeError(error)) continue
      throw error
    }
    for (const row of data || []) {
      const email = String((row as { email?: string | null }).email || '')
        .trim()
        .toLowerCase()
      if (!email) continue
      staffByEmail.set(email, row as ImportTourDayStaffRow)
    }
  }

  const vehicleCapacityById = new Map<string, number>()
  const vehicleList = [...vehicleIds]
  for (const chunk of chunkArray(vehicleList, IN_CHUNK)) {
    const { data, error } = await supabase.from('vehicles').select('id, capacity').in('id', chunk)
    if (error) {
      if (isAbortLikeError(error)) continue
      throw error
    }
    for (const row of data || []) {
      const id = String((row as { id?: string }).id || '')
      const capacity = Number((row as { capacity?: number | null }).capacity)
      if (!id) continue
      if (Number.isFinite(capacity) && capacity > 0) vehicleCapacityById.set(id, capacity)
    }
  }

  const reservations: ImportTourDayReservationInput[] = []
  const reservationList = [...reservationIds]
  for (const chunk of chunkArray(reservationList, IN_CHUNK)) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, adults, child, infant, total_people, status, tour_date, product_id')
      .in('id', chunk)
    if (error) {
      if (isAbortLikeError(error)) continue
      throw error
    }
    for (const row of data || []) {
      reservations.push({
        ...(row as ImportTourDayReservationInput),
        total_people: getReservationPartySize(row as Record<string, unknown>),
      })
    }
  }

  for (const key of unique) {
    const pairKey = importTourDayStatusKey(key.productId, key.tourDate)
    result.set(
      pairKey,
      buildImportTourDayStatusSummary(tours, reservations, staffByEmail, vehicleCapacityById, key.productId, key.tourDate)
    )
  }
  return result
}
