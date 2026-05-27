import { COGS_STANDARD_ROOT_ID } from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
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
