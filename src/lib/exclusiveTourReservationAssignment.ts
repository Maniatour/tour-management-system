import { supabase } from '@/lib/supabase'
import { reservationExcludedFromTourAssignment } from '@/lib/reservationStatus'
import { chunkStrings } from '@/lib/supabaseInChunks'
import {
  canonicalReservationIdKey,
  dedupeReservationIdsPreservingOrder,
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeTourDateKey,
  reservationIdsLooselyEqual,
  sameTourProductAndDate,
} from '@/utils/tourUtils'

export type TourReservationIdsRow = {
  id: string
  reservation_ids?: unknown
}

export type SamePartyReservationRow = {
  id: string
  customer_id?: string | null
  product_id?: string | null
  tour_date?: string | null
  status?: string | null
}

export type SamePartyGuestRow = {
  reservation_id?: string | null
  customer_id?: string | null
}

function productDateKey(productId: string | null | undefined, tourDate: unknown): string {
  const pid = String(productId ?? '').trim()
  const date = normalizeTourDateKey(tourDate)
  if (!pid || !date) return ''
  return `${pid}|${date}`
}

function isInactiveAssignmentStatus(status: string | null | undefined): boolean {
  return (
    isReservationCancelledStatus(status) ||
    isReservationDeletedStatus(status) ||
    reservationExcludedFromTourAssignment(status)
  )
}

export function reservationIdListsEqual(a: unknown, b: unknown): boolean {
  const left = dedupeReservationIdsPreservingOrder(a)
  const right = dedupeReservationIdsPreservingOrder(b)
  if (left.length !== right.length) return false
  const rightKeys = new Set(right.map((id) => canonicalReservationIdKey(id)))
  return left.every((id) => rightKeys.has(canonicalReservationIdKey(id)))
}

export function applyExclusiveReservationOwnership(
  tours: TourReservationIdsRow[],
  targetTourId: string,
  reservationIds: string[]
): Array<{ id: string; reservation_ids: string[] }> {
  const ownIds = dedupeReservationIdsPreservingOrder(reservationIds)
  const ownKeys = new Set(ownIds.map((id) => canonicalReservationIdKey(id)).filter(Boolean))

  return tours.map((tour) => {
    const current = dedupeReservationIdsPreservingOrder(tour.reservation_ids)
    if (tour.id === targetTourId) {
      const kept = current.filter((id) => !ownKeys.has(canonicalReservationIdKey(id)))
      return {
        id: tour.id,
        reservation_ids: dedupeReservationIdsPreservingOrder([...kept, ...ownIds]),
      }
    }
    return {
      id: tour.id,
      reservation_ids: current.filter((id) => !ownKeys.has(canonicalReservationIdKey(id))),
    }
  })
}

export function collectSamePartyReservationIds(args: {
  seedIds: string[]
  seedRows: SamePartyReservationRow[]
  guestRows: SamePartyGuestRow[]
  customerReservations: SamePartyReservationRow[]
  guestReservationRows: SamePartyReservationRow[]
}): string[] {
  const seed = dedupeReservationIdsPreservingOrder(args.seedIds)
  if (seed.length === 0) return []

  const productDateKeys = new Set<string>()
  const customerIds = new Set<string>()

  for (const row of args.seedRows) {
    const key = productDateKey(row.product_id, row.tour_date)
    if (key) productDateKeys.add(key)
    if (row.customer_id) customerIds.add(String(row.customer_id).trim())
  }
  for (const guest of args.guestRows) {
    if (guest.customer_id) customerIds.add(String(guest.customer_id).trim())
  }

  const outKeys = new Set(seed.map((id) => canonicalReservationIdKey(id)))
  const out = [...seed]

  const consider = (row: SamePartyReservationRow) => {
    if (!row?.id || isInactiveAssignmentStatus(row.status)) return
    const key = productDateKey(row.product_id, row.tour_date)
    if (!key || !productDateKeys.has(key)) return
    const id = String(row.id).trim()
    const canon = canonicalReservationIdKey(id)
    if (!canon || outKeys.has(canon)) return
    outKeys.add(canon)
    out.push(id)
  }

  for (const row of args.customerReservations) consider(row)
  for (const row of args.guestReservationRows) consider(row)
  return out
}

export function coalesceRelatedReservationsOntoOneTour<
  T extends { id: string; reservation_ids?: string[] | null }
>(
  tours: T[],
  reservations: Array<{ id: string; customer_id?: string | null }>
): T[] {
  const reservationById = new Map(
    reservations.map((row) => [canonicalReservationIdKey(row.id), row] as const)
  )
  const tourIdByReservation = new Map<string, string>()
  for (const tour of tours) {
    for (const rid of dedupeReservationIdsPreservingOrder(tour.reservation_ids)) {
      tourIdByReservation.set(canonicalReservationIdKey(rid), tour.id)
    }
  }

  const groups = new Map<string, string[]>()
  for (const tour of tours) {
    for (const rid of dedupeReservationIdsPreservingOrder(tour.reservation_ids)) {
      const reservation = reservationById.get(canonicalReservationIdKey(rid))
      const customerId = String(reservation?.customer_id ?? '').trim()
      if (!customerId) continue
      const list = groups.get(customerId) ?? []
      list.push(rid)
      groups.set(customerId, list)
    }
  }

  const nextByTour = new Map(
    tours.map((tour) => [tour.id, new Set(dedupeReservationIdsPreservingOrder(tour.reservation_ids))] as const)
  )

  for (const ids of groups.values()) {
    const uniqueIds = dedupeReservationIdsPreservingOrder(ids)
    if (uniqueIds.length < 2) continue
    const tourCounts = new Map<string, number>()
    for (const rid of uniqueIds) {
      const tourId = tourIdByReservation.get(canonicalReservationIdKey(rid))
      if (!tourId) continue
      tourCounts.set(tourId, (tourCounts.get(tourId) ?? 0) + 1)
    }
    if (tourCounts.size < 2) continue
    let targetTourId = uniqueIds
      .map((rid) => tourIdByReservation.get(canonicalReservationIdKey(rid)))
      .find(Boolean)
    let bestCount = -1
    for (const [tourId, count] of tourCounts) {
      if (count > bestCount) {
        bestCount = count
        targetTourId = tourId
      }
    }
    if (!targetTourId) continue
    for (const rid of uniqueIds) {
      const fromTourId = tourIdByReservation.get(canonicalReservationIdKey(rid))
      if (!fromTourId || fromTourId === targetTourId) continue
      nextByTour.get(fromTourId)?.delete(rid)
      for (const existing of [...(nextByTour.get(fromTourId) ?? [])]) {
        if (reservationIdsLooselyEqual(existing, rid)) nextByTour.get(fromTourId)?.delete(existing)
      }
      nextByTour.get(targetTourId)?.add(rid)
      tourIdByReservation.set(canonicalReservationIdKey(rid), targetTourId)
    }
  }

  return tours.map((tour) => ({
    ...tour,
    reservation_ids: dedupeReservationIdsPreservingOrder([...(nextByTour.get(tour.id) ?? [])]),
  }))
}

export function ensureUniqueReservationIdsAcrossTours<
  T extends { id: string; reservation_ids?: string[] | null }
>(tours: T[]): T[] {
  const seen = new Set<string>()
  return tours.map((tour) => {
    const kept: string[] = []
    for (const rid of dedupeReservationIdsPreservingOrder(tour.reservation_ids)) {
      const key = canonicalReservationIdKey(rid)
      if (!key || seen.has(key)) continue
      seen.add(key)
      kept.push(rid)
    }
    return { ...tour, reservation_ids: kept }
  })
}

async function fetchRowsByIds<T>(
  table: 'reservations' | 'reservation_customers',
  columns: string,
  column: string,
  ids: string[]
): Promise<T[]> {
  const out: T[] = []
  for (const chunk of chunkStrings(ids)) {
    const { data, error } = await supabase.from(table).select(columns).in(column, chunk)
    if (error) {
      console.error(`exclusive assignment fetch ${table}:`, error)
      continue
    }
    if (data?.length) out.push(...(data as T[]))
  }
  return out
}

export async function expandSamePartyReservationIds(reservationIds: string[]): Promise<string[]> {
  const seed = dedupeReservationIdsPreservingOrder(reservationIds)
  if (seed.length === 0) return []

  const seedRows = await fetchRowsByIds<SamePartyReservationRow>(
    'reservations',
    'id, customer_id, product_id, tour_date, status',
    'id',
    seed
  )
  const guestRows = await fetchRowsByIds<SamePartyGuestRow>(
    'reservation_customers',
    'reservation_id, customer_id',
    'reservation_id',
    seed
  )

  const customerIds = [
    ...new Set(
      [
        ...seedRows.map((row) => String(row.customer_id ?? '').trim()),
        ...guestRows.map((row) => String(row.customer_id ?? '').trim()),
      ].filter(Boolean)
    ),
  ]

  let customerReservations: SamePartyReservationRow[] = []
  let guestLinks: SamePartyGuestRow[] = []
  if (customerIds.length > 0) {
    customerReservations = await fetchRowsByIds<SamePartyReservationRow>(
      'reservations',
      'id, customer_id, product_id, tour_date, status',
      'customer_id',
      customerIds
    )
    guestLinks = await fetchRowsByIds<SamePartyGuestRow>(
      'reservation_customers',
      'reservation_id, customer_id',
      'customer_id',
      customerIds
    )
  }

  const extraReservationIds = dedupeReservationIdsPreservingOrder(
    guestLinks.map((row) => String(row.reservation_id ?? '').trim()).filter(Boolean)
  )
  const guestReservationRows =
    extraReservationIds.length > 0
      ? await fetchRowsByIds<SamePartyReservationRow>(
          'reservations',
          'id, customer_id, product_id, tour_date, status',
          'id',
          extraReservationIds
        )
      : []

  return collectSamePartyReservationIds({
    seedIds: seed,
    seedRows,
    guestRows,
    customerReservations,
    guestReservationRows,
  })
}

export type ExclusiveAssignResult = {
  targetReservationIds: string[]
  fromTourIds: string[]
  changed: boolean
}

function tourHoldsReservation(reservationIds: unknown, reservationId: string): boolean {
  return dedupeReservationIdsPreservingOrder(reservationIds).some((id) =>
    reservationIdsLooselyEqual(id, reservationId)
  )
}

export async function exclusiveAssignReservationsToTour(args: {
  tourId: string
  reservationIds: string[]
  productId?: string | null
  tourDate?: string | null
  includeRelatedParty?: boolean
  /** true면 다른 팀에 이미 있는 관련 예약만 이 투어로 모은다 (미배정 예약은 추가하지 않음) */
  reclaimFromOtherToursOnly?: boolean
}): Promise<ExclusiveAssignResult | null> {
  const tourId = String(args.tourId ?? '').trim()
  const seedIds = dedupeReservationIdsPreservingOrder(args.reservationIds)
  if (!tourId || seedIds.length === 0) return null

  let ownedIds = args.includeRelatedParty === false ? seedIds : await expandSamePartyReservationIds(seedIds)

  const { data: targetTour, error: targetErr } = await supabase
    .from('tours')
    .select('id, product_id, tour_date, reservation_ids')
    .eq('id', tourId)
    .maybeSingle()

  if (targetErr || !targetTour) {
    console.error('exclusiveAssignReservationsToTour target tour:', targetErr)
    return null
  }

  const productId = String(args.productId ?? targetTour.product_id ?? '').trim()
  const tourDate = normalizeTourDateKey(args.tourDate ?? targetTour.tour_date)
  if (!productId || !tourDate) {
    console.error('exclusiveAssignReservationsToTour missing product/date')
    return null
  }

  const { data: siblingTours, error: siblingErr } = await supabase
    .from('tours')
    .select('id, product_id, tour_date, reservation_ids')
    .eq('product_id', productId)
    .eq('tour_date', tourDate)

  if (siblingErr) {
    console.error('exclusiveAssignReservationsToTour sibling tours:', siblingErr)
    return null
  }

  const siblings = (siblingTours || []) as Array<{
    id: string
    product_id: string | null
    tour_date: string | null
    reservation_ids?: unknown
  }>
  if (!siblings.some((row) => row.id === tourId)) {
    siblings.push(targetTour)
  }

  if (args.reclaimFromOtherToursOnly) {
    ownedIds = ownedIds.filter((id) =>
      siblings.some((tour) => tour.id !== tourId && tourHoldsReservation(tour.reservation_ids, id))
    )
    if (ownedIds.length === 0) {
      return {
        targetReservationIds: dedupeReservationIdsPreservingOrder(targetTour.reservation_ids),
        fromTourIds: [],
        changed: false,
      }
    }
  }

  for (const rid of ownedIds) {
    const { data: conflictRows, error: conflictErr } = await supabase
      .from('tours')
      .select('id, product_id, tour_date')
      .contains('reservation_ids', [rid])
      .neq('id', tourId)
      .limit(5)

    if (conflictErr) {
      console.error('exclusiveAssignReservationsToTour conflict check:', conflictErr)
      alert('다른 투어 배정 여부를 확인하지 못해 배정을 중단했습니다. 다시 시도해 주세요.')
      return null
    }

    const foreign = (conflictRows || []).find(
      (row) =>
        !sameTourProductAndDate(
          { product_id: productId, tour_date: tourDate },
          row as { product_id?: string | null; tour_date?: string | null }
        )
    )
    if (foreign) {
      alert(
        '이 예약(또는 같은 고객의 예약)은 다른 날짜·상품 투어에 이미 배정되어 있습니다. 해당 투어에서 해제한 뒤 다시 시도해 주세요.'
      )
      return null
    }
  }

  const nextRows = applyExclusiveReservationOwnership(siblings, tourId, ownedIds)
  let changed = false
  const fromTourIds: string[] = []

  for (const next of nextRows) {
    const prev = siblings.find((row) => row.id === next.id)
    if (!prev || reservationIdListsEqual(prev.reservation_ids, next.reservation_ids)) continue
    changed = true
    if (next.id !== tourId) fromTourIds.push(next.id)
    const { error: updateErr } = await supabase
      .from('tours')
      .update({ reservation_ids: next.reservation_ids })
      .eq('id', next.id)
    if (updateErr) {
      console.error('exclusiveAssignReservationsToTour update:', updateErr)
      alert('예약 배정을 저장하는 중 오류가 발생했습니다.')
      return null
    }
  }

  const targetReservationIds =
    nextRows.find((row) => row.id === tourId)?.reservation_ids ??
    dedupeReservationIdsPreservingOrder([
      ...dedupeReservationIdsPreservingOrder(targetTour.reservation_ids),
      ...ownedIds,
    ])

  for (const chunk of chunkStrings(ownedIds)) {
    const { error: tourIdErr } = await supabase
      .from('reservations')
      .update({ tour_id: tourId })
      .in('id', chunk)
    if (tourIdErr) {
      console.error('exclusiveAssignReservationsToTour reservations.tour_id:', tourIdErr)
    }
  }

  return { targetReservationIds, fromTourIds, changed }
}
