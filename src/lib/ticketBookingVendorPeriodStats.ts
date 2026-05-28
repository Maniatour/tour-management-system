import {
  isTicketBookingActiveForReports,
  isTicketBookingEaActiveForReports,
  ticketBookingLineTotalUsd,
  ticketEaAsNumber,
} from '@/lib/bookingSettlement'
import { normalizeTicketBookingStatusFromDb } from '@/lib/ticketBookingStatus'

export type TicketBookingVendorPeriodStatsRow = {
  status?: string | null
  ea?: number | string | null
  expense?: number | string | null
  income?: number | string | null
  paid_amount?: number | string | null
  category?: string | null
  tour_id?: string | null
  deletion_requested_at?: string | null
  deleted_at?: string | null
}

export type TicketBookingVendorPeriodStatsBreakdown = {
  key: string
  count: number
  ea: number
  expenseUsd: number
}

export type TicketBookingVendorPeriodStats = {
  totalRows: number
  activeRows: number
  cancelledRows: number
  totalEa: number
  totalExpenseUsd: number
  tourConnectedRows: number
  byStatus: TicketBookingVendorPeriodStatsBreakdown[]
  byCategory: TicketBookingVendorPeriodStatsBreakdown[]
}

function isCancelledStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '')
    .trim()
    .toLowerCase()
  return s === 'cancelled' || s === 'canceled'
}

function addBreakdown(
  map: Map<string, TicketBookingVendorPeriodStatsBreakdown>,
  key: string,
  ea: number,
  expenseUsd: number
) {
  const prev = map.get(key)
  if (prev) {
    prev.count += 1
    prev.ea += ea
    prev.expenseUsd += expenseUsd
    return
  }
  map.set(key, { key, count: 1, ea, expenseUsd })
}

/** 체크인 기간·벤더로 이미 걸러진 입장권 부킹 목록에서 집계 */
export function computeTicketBookingVendorPeriodStats(
  rows: TicketBookingVendorPeriodStatsRow[]
): TicketBookingVendorPeriodStats {
  let activeRows = 0
  let cancelledRows = 0
  let totalEa = 0
  let totalExpenseUsd = 0
  let tourConnectedRows = 0

  const byStatusMap = new Map<string, TicketBookingVendorPeriodStatsBreakdown>()
  const byCategoryMap = new Map<string, TicketBookingVendorPeriodStatsBreakdown>()

  for (const row of rows) {
    const statusKey = String(normalizeTicketBookingStatusFromDb(row.status))
    const categoryKey = (row.category ?? '').trim() || '(미지정)'
    const active = isTicketBookingActiveForReports(row)
    const eaActive = isTicketBookingEaActiveForReports(row)
    const ea = eaActive ? ticketEaAsNumber(row.ea) : 0
    const expenseUsd = active ? ticketBookingLineTotalUsd(row) : 0

    if (isCancelledStatus(row.status)) cancelledRows += 1
    if (active) {
      activeRows += 1
      totalEa += ea
      totalExpenseUsd += expenseUsd
    }
    if (row.tour_id) tourConnectedRows += 1

    addBreakdown(byStatusMap, statusKey, ea, expenseUsd)
    addBreakdown(byCategoryMap, categoryKey, ea, expenseUsd)
  }

  const sortBreakdown = (items: TicketBookingVendorPeriodStatsBreakdown[]) =>
    [...items].sort((a, b) => b.expenseUsd - a.expenseUsd || b.count - a.count || a.key.localeCompare(b.key))

  return {
    totalRows: rows.length,
    activeRows,
    cancelledRows,
    totalEa,
    totalExpenseUsd,
    tourConnectedRows,
    byStatus: sortBreakdown([...byStatusMap.values()]),
    byCategory: sortBreakdown([...byCategoryMap.values()]),
  }
}

export function formatTicketBookingStatsUsd(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}
