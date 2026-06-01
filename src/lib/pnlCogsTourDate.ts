import { COGS_STANDARD_ROOT_ID } from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import type { TourReferenceSnapshot } from '@/lib/expense-unified-duplicate-scan'
import { PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID } from '@/lib/pnlReportDataFetch'
import { ticketBookingCanyonKeyFromBooking } from '@/lib/ticketBookingDateView'
import type { PnlExpenseSource } from '@/components/reports/PnlUnifiedExpenseDetailDialog'

export { COGS_STANDARD_ROOT_ID, PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID }

export type PnlExpenseSourceForTourDate = Extract<
  PnlExpenseSource,
  'tour_expenses' | 'ticket_bookings' | 'company_expenses' | 'reservation_expenses' | 'tour_hotel_bookings'
>

/** 표준 트리에서 COGS(Part III · CAT024) 하위 리프 id */
export function buildCogsLeafIdSet(
  cats: ExpenseStandardCategoryPickRow[],
  leafIdSet: Set<string>
): Set<string> {
  const byId = new Map(cats.map((c) => [c.id, c]))
  const out = new Set<string>()
  for (const leafId of leafIdSet) {
    if (leafId === COGS_STANDARD_ROOT_ID || leafId.startsWith(`${COGS_STANDARD_ROOT_ID}-`)) {
      out.add(leafId)
      continue
    }
    let cur = byId.get(leafId)
    while (cur?.parent_id) {
      if (cur.parent_id === COGS_STANDARD_ROOT_ID) {
        out.add(leafId)
        break
      }
      cur = byId.get(cur.parent_id)
    }
  }
  return out
}

/** expense_category_mappings → CAT024 하위 리프인 original_value (소스별) */
export function buildCogsMappingOriginals(
  mapToLeaf: Map<string, string>,
  cogsLeafIds: Set<string>
): Record<PnlExpenseSourceForTourDate, Set<string>> {
  const out: Record<PnlExpenseSourceForTourDate, Set<string>> = {
    tour_expenses: new Set(),
    ticket_bookings: new Set(),
    company_expenses: new Set(),
    reservation_expenses: new Set(),
    tour_hotel_bookings: new Set(),
  }
  for (const [key, leafId] of mapToLeaf) {
    if (!cogsLeafIds.has(leafId)) continue
    const sep = key.lastIndexOf('::')
    if (sep <= 0) continue
    const orig = key.slice(0, sep)
    const source = key.slice(sep + 2) as PnlExpenseSourceForTourDate
    if (source in out) out[source].add(orig)
  }
  return out
}

export function isPnlCogsLeaf(leafId: string | null | undefined, cogsLeafIds: Set<string>): boolean {
  if (!leafId) return false
  return cogsLeafIds.has(leafId)
}

function isAntelopeTicketBookingForPnl(booking: {
  category?: string | null
  company?: string | null
}): boolean {
  const cat = (booking.category || '').trim().toLowerCase()
  if (cat) {
    if (cat === 'antelope_canyon' || cat === 'antelope' || cat === 's_antelope') return true
    if (cat.includes('antelope') || cat.includes('entrance')) return true
  }
  return ticketBookingCanyonKeyFromBooking(booking) != null
}

/** 입장권 → 표준 리프 (캐년 입장권은 매핑 없을 때 CAT024-003) */
export function resolveTicketBookingPnlLeafId(
  row: { category?: string | null; company?: string | null },
  mappingOriginal: string,
  mapToLeaf: Map<string, string>,
  leafIdSet: Set<string>
): string | null {
  const mapped = mapToLeaf.get(`${mappingOriginal}::ticket_bookings`) ?? null
  if (mapped && leafIdSet.has(mapped)) return mapped
  if (
    isAntelopeTicketBookingForPnl(row) &&
    leafIdSet.has(PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID)
  ) {
    return PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID
  }
  return null
}

/** COGS(Part III) 행 — 투어일(체크인·tour_date·예약 tour_date·회계기간)로 집계 */
export function pnlUsesTourDateBasis(args: {
  resolvedLeafId: string | null
  bucketKey: string
  cogsLeafIds: Set<string>
}): boolean {
  return (
    isPnlCogsLeaf(args.resolvedLeafId, args.cogsLeafIds) ||
    isPnlCogsLeaf(args.bucketKey, args.cogsLeafIds)
  )
}

/** 회사 지출 COGS — accounting_period(YYYY-MM) 우선, 없으면 submit_on 일자 */
export function companyExpenseTourAnchorYmd(row: {
  submit_on: string | null
  accounting_period?: string | null
}): string {
  const ap = String(row.accounting_period ?? '').trim()
  const m = ap.match(/^(\d{4})-(\d{2})/)
  if (m) {
    const day = ap.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(ap) ? ap.slice(0, 10) : `${m[1]}-${m[2]}-01`
    return day
  }
  if (!row.submit_on) return ''
  const d = new Date(row.submit_on)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizePnlTourDateYmd(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export type PnlTourDateRowLike = {
  id: string
  tour_date?: string | null
  check_in_date?: string | null
  reservation_id?: string | null
  tour_id?: string | null
  rn_number?: string | null
  rooms?: unknown
  submit_on?: string | null
  accounting_period?: string | null
}

export type PnlDetailEnrichment = {
  tour_id: string | null
  reservation_id: string | null
  rn_number: string | null
  booking_rooms: number | null
}

function normalizePnlLinkId(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  return s || null
}

export function buildPnlDetailEnrichmentLookup(
  groups: { source: PnlExpenseSourceForTourDate; rows: PnlTourDateRowLike[] | null | undefined }[]
): Map<string, PnlDetailEnrichment> {
  const out = new Map<string, PnlDetailEnrichment>()
  for (const { source, rows } of groups) {
    for (const r of rows || []) {
      const roomsRaw = r.rooms
      const roomsNum =
        roomsRaw == null || roomsRaw === '' ? null : Number.isFinite(Number(roomsRaw)) ? Number(roomsRaw) : null
      out.set(`${source}:${String(r.id)}`, {
        tour_id: normalizePnlLinkId(r.tour_id),
        reservation_id: normalizePnlLinkId(r.reservation_id),
        rn_number: normalizePnlLinkId(r.rn_number),
        booking_rooms: roomsNum,
      })
    }
  }
  return out
}

export function attachPnlDetailEnrichment<
  T extends { id: string; source: PnlExpenseSourceForTourDate },
>(lines: T[], lookup: ReadonlyMap<string, PnlDetailEnrichment>): (T & PnlDetailEnrichment)[] {
  return lines.map((l) => {
    const hit = lookup.get(`${l.source}:${l.id}`)
    return {
      ...l,
      tour_id: hit?.tour_id ?? null,
      reservation_id: hit?.reservation_id ?? null,
      rn_number: hit?.rn_number ?? null,
      booking_rooms: hit?.booking_rooms ?? null,
    }
  })
}

/** 통합 PNL 지출 상세 — 출처별 PNL 집계에 쓰는 투어일·체크인·회계기간 앵커 */
export function pnlDetailTourDateYmd(
  source: PnlExpenseSourceForTourDate,
  row: PnlTourDateRowLike,
  tourDateByReservationId?: ReadonlyMap<string, string>
): string | null {
  if (source === 'tour_expenses') {
    return normalizePnlTourDateYmd(row.tour_date)
  }
  if (source === 'reservation_expenses') {
    const direct = normalizePnlTourDateYmd(row.tour_date)
    if (direct) return direct
    const rid = String(row.reservation_id ?? '').trim()
    if (rid && tourDateByReservationId?.has(rid)) {
      return normalizePnlTourDateYmd(tourDateByReservationId.get(rid))
    }
    return null
  }
  if (source === 'ticket_bookings' || source === 'tour_hotel_bookings') {
    return normalizePnlTourDateYmd(row.check_in_date)
  }
  if (source === 'company_expenses') {
    return normalizePnlTourDateYmd(
      companyExpenseTourAnchorYmd({
        submit_on: row.submit_on ?? null,
        accounting_period: row.accounting_period,
      })
    )
  }
  return null
}

export function buildPnlTourDateLookup(
  groups: { source: PnlExpenseSourceForTourDate; rows: PnlTourDateRowLike[] | null | undefined }[],
  tourDateByReservationId?: ReadonlyMap<string, string>
): Map<string, string> {
  const out = new Map<string, string>()
  for (const { source, rows } of groups) {
    for (const r of rows || []) {
      const ymd = pnlDetailTourDateYmd(source, r, tourDateByReservationId)
      if (ymd) out.set(`${source}:${String(r.id)}`, ymd)
    }
  }
  return out
}

export function attachPnlDetailTourDateYmd<
  T extends { id: string; source: PnlExpenseSourceForTourDate; tour_date_ymd?: string | null },
>(lines: T[], lookup: ReadonlyMap<string, string>): (T & { tour_date_ymd: string | null })[] {
  return lines.map((l) => ({
    ...l,
    tour_date_ymd: lookup.get(`${l.source}:${l.id}`) ?? l.tour_date_ymd ?? null,
  }))
}

export function attachPnlDetailTourReferences<
  T extends { tour_id?: string | null; tour_reference?: TourReferenceSnapshot | null },
>(lines: T[], tourRefs: ReadonlyMap<string, TourReferenceSnapshot>): (T & { tour_reference: TourReferenceSnapshot | null })[] {
  return lines.map((l) => {
    const tid = l.tour_id?.trim() || ''
    return {
      ...l,
      tour_reference: tid ? tourRefs.get(tid) ?? null : null,
    }
  })
}
