import { ticketBookingCanyonKeyFromBooking } from '@/lib/ticketBookingDateView'
import { PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID } from '@/lib/pnlReportDataFetch'

export { PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID }

export type PnlExpenseSourceForTourDate =
  | 'tour_expenses'
  | 'ticket_bookings'
  | 'company_expenses'

/** expense_category_mappings → CAT024-003 인 original_value (소스별) */
export function buildAntelopeAdmissionMappingOriginals(
  mapToLeaf: Map<string, string>
): Record<PnlExpenseSourceForTourDate, Set<string>> {
  const out: Record<PnlExpenseSourceForTourDate, Set<string>> = {
    tour_expenses: new Set(),
    ticket_bookings: new Set(),
    company_expenses: new Set(),
  }
  for (const [key, leafId] of mapToLeaf) {
    if (leafId !== PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID) continue
    const sep = key.lastIndexOf('::')
    if (sep <= 0) continue
    const orig = key.slice(0, sep)
    const source = key.slice(sep + 2) as PnlExpenseSourceForTourDate
    if (source in out) out[source].add(orig)
  }
  return out
}

export function isPnlAntelopeAdmissionLeaf(leafId: string | null | undefined): boolean {
  return leafId === PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID
}

export function isAntelopeTicketBookingForPnl(booking: {
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

export function isAntelopeAdmissionPnlRow(args: {
  resolvedLeafId: string | null
  bucketKey: string
  source: PnlExpenseSourceForTourDate
  mappingOriginal: string
  antelopeOriginals: Record<PnlExpenseSourceForTourDate, Set<string>>
  ticketRow?: { category?: string | null; company?: string | null }
}): boolean {
  const { resolvedLeafId, bucketKey, source, mappingOriginal, antelopeOriginals, ticketRow } = args
  if (isPnlAntelopeAdmissionLeaf(resolvedLeafId) || bucketKey === PNL_ANTELOPE_CANYON_ADMISSION_LEAF_ID) {
    return true
  }
  if (antelopeOriginals[source].has(mappingOriginal)) return true
  if (source === 'ticket_bookings' && ticketRow && isAntelopeTicketBookingForPnl(ticketRow)) {
    return true
  }
  return false
}

/** 입장권·앤텔롭 투어지출: 투어일(체크인·tour_date)로 기간·월 집계 */
/** 입장권 → 표준 리프 (매핑 없으면 캐년 입장권은 CAT024-003으로 귀속) */
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

export function pnlUsesTourDateBasis(args: {
  resolvedLeafId: string | null
  bucketKey: string
  source: PnlExpenseSourceForTourDate
  mappingOriginal: string
  antelopeOriginals: Record<PnlExpenseSourceForTourDate, Set<string>>
  ticketRow?: { category?: string | null; company?: string | null }
}): boolean {
  if (args.source === 'ticket_bookings' || args.source === 'tour_expenses') {
    return isAntelopeAdmissionPnlRow(args)
  }
  return false
}
