import { normalizeReservationIds, normalizeTourDateKey } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { getReservationPartySize } from '@/utils/reservationUtils'
import { computePerTourCapacityRows } from '@/lib/scheduleTourCapacity'
import { normalizeTourDateForDb } from '@/lib/utils'

export const IMPORT_TOUR_DAY_DEFAULT_MAX = 12

export type ImportTourDayTeamStatus = {
  index: number
  staffLabel: string
  assigned: number
  max: number
  spotsLeft: number
}

export type ImportTourDayStatusSummary = {
  tourCount: number
  totalSpotsLeft: number
  teams: ImportTourDayTeamStatus[]
}

export type ImportTourDayStatusLookupKey = {
  productId: string
  tourDate: string
}

export type ImportTourDayStaffRow = {
  nick_name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

export type ImportTourDayTourInput = {
  id: string
  tour_date: string
  product_id: string | null
  tour_status: string | null
  tour_guide_id: string | null
  assistant_id: string | null
  tour_car_id: string | null
  reservation_ids: unknown
  max_participants?: number | null
  created_at?: string | null
}

export type ImportTourDayReservationInput = {
  id: string
  tour_date?: string | null
  product_id?: string | null
  status?: string | null
  adults?: number | null
  child?: number | null
  infant?: number | null
  total_people?: number | null
}

export function importTourDayStatusKey(productId: string, tourDate: string): string {
  return `${productId}__${tourDate}`
}

export function parseImportTourDate(value: string | null | undefined): string {
  return normalizeTourDateForDb(value) || normalizeTourDateKey(value)
}

export function resolveImportProductId(
  extracted: { product_id?: string | null; product_name?: string | null },
  products: Array<{
    id: string
    name?: string | null
    name_ko?: string | null
    name_en?: string | null
  }>
): string | null {
  const direct = String(extracted.product_id ?? '').trim()
  if (direct) return direct
  const name = (extracted.product_name ?? '').trim()
  if (!name || products.length === 0) return null
  const nameLower = name.toLowerCase()
  const matched = products.find(
    (p) =>
      (p.name &&
        (p.name.toLowerCase() === nameLower ||
          nameLower.includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(nameLower))) ||
      (p.name_ko &&
        (p.name_ko.toLowerCase() === nameLower ||
          nameLower.includes(p.name_ko.toLowerCase()) ||
          p.name_ko.toLowerCase().includes(nameLower))) ||
      (p.name_en &&
        (p.name_en.toLowerCase() === nameLower ||
          nameLower.includes(p.name_en.toLowerCase()) ||
          p.name_en.toLowerCase().includes(nameLower)))
  )
  return matched?.id ?? null
}

/** 차량이 있으면 차량 정원, 없으면 투어 정원(없으면 12) */
export function resolveImportTourMaxCapacity(
  maxParticipants: number | null | undefined,
  vehicleCapacity: number | null | undefined
): number {
  if (typeof vehicleCapacity === 'number' && Number.isFinite(vehicleCapacity) && vehicleCapacity > 0) {
    return vehicleCapacity
  }
  if (typeof maxParticipants === 'number' && Number.isFinite(maxParticipants) && maxParticipants > 0) {
    return maxParticipants
  }
  return IMPORT_TOUR_DAY_DEFAULT_MAX
}

export function displayImportTourStaffName(
  row: ImportTourDayStaffRow | null | undefined,
  fallbackEmail: string | null | undefined
): string | null {
  if (row) {
    const nick = row.nick_name?.trim()
    if (nick) return nick
    const ko = row.name_ko?.trim()
    if (ko) return ko
    const en = row.name_en?.trim()
    if (en) return en
  }
  const email = fallbackEmail?.trim()
  if (!email) return null
  const local = email.split('@')[0]?.trim()
  return local || null
}

export function formatImportTourStaffLabel(guideName: string | null, assistantName: string | null): string {
  const g = guideName?.trim() || ''
  const a = assistantName?.trim() || ''
  if (g && a) return `${g}/${a}`
  if (g) return g
  if (a) return a
  return '미정'
}

export function formatImportTourDayStatusLine(summary: ImportTourDayStatusSummary): string {
  if (summary.tourCount === 0) return '투어 없음'
  const teams = summary.teams
    .map((team) => `${team.index}. ${team.staffLabel} ${team.assigned}/${team.max}`)
    .join(' , ')
  return `투어 X ${summary.tourCount}, 잔여 좌석 X ${summary.totalSpotsLeft} (${teams})`
}

export function buildImportTourDayStatusSummary(
  tours: ImportTourDayTourInput[],
  reservations: ImportTourDayReservationInput[],
  staffByEmail: Map<string, ImportTourDayStaffRow>,
  vehicleCapacityById: Map<string, number>,
  productId: string,
  tourDate: string
): ImportTourDayStatusSummary {
  const dateYmd = parseImportTourDate(tourDate)
  const activeTours = tours
    .filter((tour) => String(tour.product_id || '') === productId)
    .filter((tour) => parseImportTourDate(tour.tour_date) === dateYmd)
    .filter((tour) => !isTourCancelled(tour.tour_status))
    .sort((a, b) => {
      const ac = String(a.created_at || '')
      const bc = String(b.created_at || '')
      if (ac !== bc) return ac.localeCompare(bc)
      return String(a.id).localeCompare(String(b.id))
    })

  if (activeTours.length === 0) {
    return { tourCount: 0, totalSpotsLeft: 0, teams: [] }
  }

  const reservationRows = reservations.map((row) => ({
    id: row.id,
    tour_date: parseImportTourDate(row.tour_date) || dateYmd,
    product_id: row.product_id ?? productId,
    total_people: getReservationPartySize(row as Record<string, unknown>),
    status: row.status ?? null,
  }))

  const capacityRows = computePerTourCapacityRows(
    activeTours.map((tour) => {
      const vehicleId = tour.tour_car_id?.trim() || ''
      const vehicleCapacity = vehicleId ? vehicleCapacityById.get(vehicleId) : undefined
      return {
        id: tour.id,
        tour_date: parseImportTourDate(tour.tour_date) || dateYmd,
        tour_status: tour.tour_status,
        max_participants: resolveImportTourMaxCapacity(tour.max_participants, vehicleCapacity),
        reservation_ids: normalizeReservationIds(tour.reservation_ids),
        product_id: tour.product_id,
      }
    }),
    reservationRows,
    dateYmd,
    productId
  )
  const capacityByTourId = new Map(capacityRows.map((row) => [row.tourId, row]))

  const teams: ImportTourDayTeamStatus[] = activeTours.map((tour, index) => {
    const capacity = capacityByTourId.get(String(tour.id))
    const assigned = capacity?.assigned ?? 0
    const vehicleId = tour.tour_car_id?.trim() || ''
    const vehicleCapacity = vehicleId ? vehicleCapacityById.get(vehicleId) : undefined
    const max = capacity?.max ?? resolveImportTourMaxCapacity(tour.max_participants, vehicleCapacity)
    const guide = displayImportTourStaffName(
      staffByEmail.get((tour.tour_guide_id || '').trim().toLowerCase()) ?? null,
      tour.tour_guide_id
    )
    const assistant = displayImportTourStaffName(
      staffByEmail.get((tour.assistant_id || '').trim().toLowerCase()) ?? null,
      tour.assistant_id
    )
    return {
      index: index + 1,
      staffLabel: formatImportTourStaffLabel(guide, assistant),
      assigned,
      max,
      spotsLeft: capacity?.spotsLeft ?? Math.max(0, max - assigned),
    }
  })

  return {
    tourCount: activeTours.length,
    totalSpotsLeft: teams.reduce((sum, team) => sum + team.spotsLeft, 0),
    teams,
  }
}
